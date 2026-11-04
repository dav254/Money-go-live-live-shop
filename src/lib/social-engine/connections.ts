/**
 * SOCIAL ENGINE — account connection store (server-only).
 *
 * Follows the pattern proven by `src/lib/tiktok/store.ts`: a dedicated
 * collection only the Firebase Admin SDK touches, tokens encrypted at rest
 * (AES-256-GCM, see crypto.ts), and no token value ever logged.
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
import { openTokens, sealTokens, isSealedToken, TokenKeyMissingError, type SealedToken } from './crypto';
import type { ConnectionInfo, ModuleId } from './types';

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

/** Owner-scoped fetch. Returns null for a missing doc OR a foreign one. */
export async function getConnection(
  module: ModuleId,
  ownerId: string,
  caller: { uid: string; isAdmin: boolean },
): Promise<ConnectionRecord | null> {
  if (!caller.isAdmin && caller.uid !== ownerId) return null; // tenant wall
  const snap = await db
    .collection(CONNECTIONS_COLLECTION)
    .doc(connectionId(module, ownerId))
    .get();
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
  const ref = db.collection(CONNECTIONS_COLLECTION).doc(connectionId(input.module, input.ownerId));
  const existing = await ref.get();
  // Firestore rejects `undefined` values, so optional metadata is only added
  // when the provider actually returned it.
  const payload: Record<string, unknown> = {
    module: input.module,
    ownerId: input.ownerId,
    status: 'connected',
    scopes: input.scopes ?? [],
    tokens: sealed,
    connectedAt: existing.exists
      ? ((existing.data()?.connectedAt as string | undefined) ?? now)
      : now,
    updatedAt: now,
    disconnectedAt: null,
  };
  if (input.accountLabel) payload.accountLabel = input.accountLabel;
  await ref.set(payload, { merge: true });
}

/** Marks a connection disconnected — future publishing must stop (§10). */
export async function disconnectConnection(
  module: ModuleId,
  ownerId: string,
  caller: { uid: string; isAdmin: boolean },
): Promise<boolean> {
  if (!caller.isAdmin && caller.uid !== ownerId) return false;
  const ref = db.collection(CONNECTIONS_COLLECTION).doc(connectionId(module, ownerId));
  const snap = await ref.get();
  if (!snap.exists) return false;
  // The encrypted token material is dropped as well: a disconnected account
  // must not keep a usable credential on disk, and reconnecting writes a
  // fresh record. The history (connectedAt / disconnectedAt) is preserved.
  await ref.set(
    {
      status: 'disconnected',
      tokens: null,
      disconnectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
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

/** The public, token-free view of a record for the readiness dashboard. */
export function toConnectionInfo(record: ConnectionRecord | null): ConnectionInfo {
  if (!record) return { connected: false };
  return {
    connected: record.status === 'connected',
    accountLabel: record.accountLabel,
    scopes: record.scopes,
    connectedAt: record.connectedAt,
    disconnectedAt: record.disconnectedAt,
  };
}
