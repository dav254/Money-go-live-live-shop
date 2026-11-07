/**
 * SOCIAL ENGINE — account connection store (server-only).
 *
 * Store contract: PocketBase on the VPS is PRIMARY (`social_engine_connections`
 * via `lib/pocketbase/social-engine.ts`); Firestore is a best-effort mirror,
 * used for real only when PocketBase is not configured (development/tests).
 * Tokens stay encrypted at rest (AES-256-GCM, see crypto.ts) in both stores,
 * and no token value is ever logged.
 *
 * ## Tenant isolation (task §10)
 * A document's id embeds its owner: `{module}__{ownerId}`. Every read takes
 * the caller and either matches the owner or requires admin; every write
 * sets ownerId explicitly. A seller can therefore never read, overwrite or
 * disconnect another seller's connection — enforced HERE, server-side, not
 * in the UI.
 *
 * ## Import rule
 * API routes and server code only. Never imported by a page or component
 * (this file pulls in firebase-admin through @/firebase/server).
 */
import { db } from '@/firebase/server';
import {
  pbSocialGet,
  pbSocialWrite,
  SOCIAL_ENGINE_PB_COLLECTIONS,
  socialEnginePbEnabled,
} from '@/lib/pocketbase/social-engine';
import { openTokens, sealTokens, isSealedToken, TokenKeyMissingError, type SealedToken } from './crypto';
import type { ConnectionInfo, ModuleId, TokenState } from './types';

export const CONNECTIONS_COLLECTION = 'social_connections';

/** Tokens as stored by the OAuth callbacks (plaintext in memory only). */
export interface StoredTokens {
  access_token: string;
  refresh_token?: string;
  /** Epoch ms, when the provider declared an expiry. */
  expires_at?: number | null;
  /** OAuth scopes granted at connect time (readiness shows NAMES only). */
  scopes?: string[];
  /** Provider-specific extras (e.g. Tumblr oauth_token secret). */
  extra?: Record<string, string>;
  /**
   * Structured connection metadata that must stay WITH the secrets (and so
   * inside the sealed payload): the managed Pages list + page access tokens,
   * the linked Instagram business account, the selected destination.
   */
  meta?: Record<string, unknown>;
}

export interface ConnectionRecord {
  id: string;
  module: ModuleId;
  ownerId: string;
  status: 'connected' | 'disconnected';
  accountLabel?: string;
  scopes?: string[];
  /** Encrypted — never returned by any API. */
  tokens?: SealedToken;
  connectedAt: string;
  updatedAt: string;
  disconnectedAt?: string;
}

export function connectionId(module: ModuleId, ownerId: string): string {
  // ownerId comes from a verified Firebase token (uid charset) or 'platform'.
  const safeOwner = ownerId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 128);
  return `${module}__${safeOwner}`;
}

/** Firestore mirror — best-effort; never fails a committed VPS write. */
async function fsMirrorConnection(id: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await db.collection(CONNECTIONS_COLLECTION).doc(id).set({ ...payload, id }, { merge: true });
  } catch {
    // The primary write already succeeded; nothing else to do.
  }
}

/**
 * Owner-scoped fetch. Returns null for a missing doc OR a foreign one.
 * Throws when PocketBase is configured but unreachable — a primary-store
 * outage must not be reported as "not connected".
 */
export async function getConnection(
  module: ModuleId,
  ownerId: string,
  caller: { uid: string; isAdmin: boolean },
): Promise<ConnectionRecord | null> {
  if (!caller.isAdmin && caller.uid !== ownerId) return null; // tenant wall
  const id = connectionId(module, ownerId);

  if (socialEnginePbEnabled()) {
    const doc = await pbSocialGet(SOCIAL_ENGINE_PB_COLLECTIONS.connections, id);
    return doc ? (doc as unknown as ConnectionRecord) : null;
  }

  const snap = await db.collection(CONNECTIONS_COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return ({ id: snap.id, ...(snap.data() as object) }) as ConnectionRecord;
}

/**
 * Saves (upserts) a connection. `caller` must be the owner or an admin —
 * checked here so no route can forget it.
 */
export async function saveConnection(input: {
  module: ModuleId;
  ownerId: string;
  tokens: StoredTokens;
  accountLabel?: string;
  scopes?: string[];
  caller: { uid: string; isAdmin: boolean };
}): Promise<void> {
  if (!input.caller.isAdmin && input.caller.uid !== input.ownerId) {
    throw new Error('Not allowed to write this connection.');
  }
  // Scopes ride inside the sealed payload too, so diagnostics can read them
  // back after a reconnect without a second provider round-trip.
  const sealed = sealTokens({ ...input.tokens, scopes: input.scopes ?? input.tokens.scopes }); // throws TokenKeyMissingError with no key
  const now = new Date().toISOString();
  const id = connectionId(input.module, input.ownerId);
  // One read decides `connectedAt`: reconnecting keeps the original connect
  // time and must not rewrite history.
  const existing = await getConnection(input.module, input.ownerId, input.caller);
  const payload: Record<string, unknown> = {
    module: input.module,
    ownerId: input.ownerId,
    status: 'connected',
    scopes: input.scopes ?? [],
    tokens: sealed,
    connectedAt: existing?.connectedAt ?? now,
    updatedAt: now,
    disconnectedAt: null,
  };
  if (input.accountLabel) payload.accountLabel = input.accountLabel;

  if (socialEnginePbEnabled()) {
    await pbSocialWrite(SOCIAL_ENGINE_PB_COLLECTIONS.connections, id, payload);
    await fsMirrorConnection(id, payload);
    return;
  }
  const ref = db.collection(CONNECTIONS_COLLECTION).doc(id);
  await ref.set(payload, { merge: true });
}

/** Marks a connection disconnected — future publishing must stop (§10). */
export async function disconnectConnection(
  module: ModuleId,
  ownerId: string,
  caller: { uid: string; isAdmin: boolean },
): Promise<boolean> {
  if (!caller.isAdmin && caller.uid !== ownerId) return false;
  const id = connectionId(module, ownerId);
  const existing = await getConnection(module, ownerId, caller);
  if (!existing) return false;
  // The encrypted token material is dropped as well: a disconnected account
  // must not keep a usable credential on disk, and reconnecting writes a
  // fresh record. The history (connectedAt / disconnectedAt) is preserved.
  const patch = {
    status: 'disconnected',
    tokens: null,
    disconnectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (socialEnginePbEnabled()) {
    await pbSocialWrite(SOCIAL_ENGINE_PB_COLLECTIONS.connections, id, patch);
    await fsMirrorConnection(id, patch);
    return true;
  }
  await db.collection(CONNECTIONS_COLLECTION).doc(id).set(patch, { merge: true });
  return true;
}

/**
 * Decrypts a connection's tokens. Returns null when there is no connection
 * or no decryption is possible — callers surface the reason as a static
 * note (missing key vs disconnected), never as an exception body.
 */
export async function openConnectionTokens(
  module: ModuleId,
  ownerId: string,
  caller: { uid: string; isAdmin: boolean },
): Promise<{ tokens: StoredTokens } | { missing: 'no_connection' | 'no_key' | 'decrypt_failed' }> {
  const record = await getConnection(module, ownerId, caller);
  if (!record) return { missing: 'no_connection' };
  if (record.status !== 'connected') return { missing: 'no_connection' };
  if (!record.tokens || !isSealedToken(record.tokens)) return { missing: 'no_connection' };
  try {
    return { tokens: openTokens<StoredTokens>(record.tokens) };
  } catch (error) {
    if (error instanceof TokenKeyMissingError) return { missing: 'no_key' };
    return { missing: 'decrypt_failed' };
  }
}

/**
 * The public, token-free view of a record for the readiness dashboard.
 *
 * `expiry` comes from the DECRYPTED payload and is reduced to a timestamp and
 * a classification before it is returned — the tokens themselves never leave
 * this module, so an API response built from this object cannot leak one.
 */
export function toConnectionInfo(
  record: ConnectionRecord | null,
  expiry?: { state: TokenState; expiresAt?: string },
): ConnectionInfo {
  if (!record) return { connected: false };
  const info: ConnectionInfo = {
    connected: record.status === 'connected',
    accountLabel: record.accountLabel,
    scopes: record.scopes,
    connectedAt: record.connectedAt,
    disconnectedAt: record.disconnectedAt,
  };
  if (record.status === 'connected' && expiry) {
    info.tokenState = expiry.state;
    if (expiry.expiresAt) info.expiresAt = expiry.expiresAt;
  }
  return info;
}
