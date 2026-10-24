/**
 * SERVER-ONLY TikTok credential store.
 *
 * Tokens used to live at `userProfiles/{uid}.connections.tiktok` — a document
 * the Firestore rules serve to ANY reader (`allow read: if true` on
 * userProfiles, load-bearing for marketplace profile pages). This module moves
 * them to a dedicated `tiktok_connections/{uid}` collection that only the
 * Firebase Admin SDK touches; clients are explicitly denied in firestore.rules.
 *
 * ## Import rule
 * Only API route handlers under src/app/api and server scripts may import
 * this module. Never import it from a page, component, or anything that ends
 * up in the browser bundle. Enforced by src/tests/tiktok-credentials.test.ts.
 *
 * ## Logging rule
 * Never log access tokens, refresh tokens, authorization codes or full token
 * API responses. Log uids, event names and error codes only.
 *
 * ## Legacy compatibility
 * During the migration window, reads fall back to the legacy
 * `userProfiles/{uid}.connections.tiktok` path so boosts keep working before
 * the backfill runs. Writes ONLY go to the new collection (a refresh against a
 * legacy record materialises it into the new store). The fallback is removed
 * once scripts/migrate-tiktok-connections.ts has been applied and verified.
 */
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import axios from 'axios';

export const TIKTOK_CONNECTIONS_COLLECTION = 'tiktok_connections';

/** Refresh this long before expiry — clock skew and in-flight requests. */
export const REFRESH_MARGIN_MS = 10 * 60 * 1000;

export interface TikTokConnection {
  openId: string;
  accessToken: string;
  /** Rotated by TikTok on every refresh — always persist the new one. */
  refreshToken?: string;
  /** Epoch ms, or null when TikTok did not return an expiry. */
  expiresAt?: number | null;
  scopes?: string[];
  connectedAt: number;
  updatedAt: number;
  /** Set when the refresh token is invalid/revoked: user must reconnect. */
  needsReconnect?: boolean;
  revokedAt?: number | null;
}

/** Legacy shape written by the old callback into userProfiles. */
interface LegacyConnection {
  openId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: unknown;
  scopes?: string[];
  connectedAt?: unknown;
}

function legacyToConnection(legacy: LegacyConnection): TikTokConnection | null {
  if (!legacy?.accessToken || !legacy?.openId) return null;
  const rawExpiry = legacy.expiresAt as { toMillis?: () => number } | number | undefined;
  const expiresAt =
    typeof rawExpiry === 'number'
      ? rawExpiry
      : rawExpiry && typeof rawExpiry.toMillis === 'function'
        ? rawExpiry.toMillis()
        : null;
  return {
    openId: legacy.openId,
    accessToken: legacy.accessToken,
    refreshToken: legacy.refreshToken,
    expiresAt,
    scopes: Array.isArray(legacy.scopes) ? legacy.scopes : [],
    connectedAt: 0,
    updatedAt: 0,
  };
}

/** Persists (upserts) a connection for the given uid. Never logs values. */
export async function saveTikTokConnection(uid: string, conn: TikTokConnection): Promise<void> {
  await db.collection(TIKTOK_CONNECTIONS_COLLECTION).doc(uid).set(conn, { merge: true });
}

/**
 * Reads a connection: new store first, legacy userProfiles path as a
 * read-only fallback during migration.
 */
export async function getTikTokConnection(uid: string): Promise<TikTokConnection | null> {
  try {
    const doc = await db.collection(TIKTOK_CONNECTIONS_COLLECTION).doc(uid).get();
    if (doc.exists) {
      const data = doc.data() as TikTokConnection;
      if (data?.needsReconnect) return data;
      if (!data?.accessToken) return null;
      return data;
    }
  } catch (error) {
    console.error('[tiktok] connection read failed', uid, (error as Error)?.message);
  }

  // Legacy fallback — READ ONLY. Never written back.
  try {
    const legacySnap = await db.collection('userProfiles').doc(uid).get();
    const legacy = (legacySnap.data()?.connections as { tiktok?: LegacyConnection } | undefined)?.tiktok;
    return legacyToConnection(legacy ?? {});
  } catch (error) {
    console.error('[tiktok] legacy connection read failed', uid, (error as Error)?.message);
    return null;
  }
}

/**
 * Returns an access token valid for at least REFRESH_MARGIN_MS, refreshing
 * (and persisting the rotated refresh token) when needed.
 *
 * Returns null when there is no connection, no usable refresh token, or the
 * refresh token was rejected (in which case the connection is marked
 * `needsReconnect` and its secrets deleted).
 */
export async function getFreshTikTokAccessToken(uid: string): Promise<string | null> {
  const conn = await getTikTokConnection(uid);
  if (!conn || conn.needsReconnect || !conn.accessToken) return null;

  const stillValid =
    typeof conn.expiresAt === 'number' && conn.expiresAt > Date.now() + REFRESH_MARGIN_MS;
  if (stillValid || !conn.refreshToken) return conn.accessToken;

  return refreshAccessToken(uid, conn);
}

async function refreshAccessToken(uid: string, conn: TikTokConnection): Promise<string | null> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret || !conn.refreshToken) return null;

  try {
    const res = await axios.post(
      'https://open.tiktokapis.com/v2/oauth/token/',
      new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: conn.refreshToken,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15_000 },
    );

    const { access_token, refresh_token, expires_in, scope } = res.data ?? {};
    if (!access_token) throw new Error('refresh returned no access_token');

    const rotated = typeof refresh_token === 'string' && refresh_token ? refresh_token : conn.refreshToken;
    const expiresAt = typeof expires_in === 'number' ? Date.now() + expires_in * 1000 : null;
    const scopes = typeof scope === 'string' ? scope.split(',').map((s) => s.trim()) : conn.scopes;

    // Atomic persist with a lost-update guard: if another request already
    // rotated the refresh token (concurrent refresh), keep its result instead
    // of clobbering it and invalidating the chain.
    const ref = db.collection(TIKTOK_CONNECTIONS_COLLECTION).doc(uid);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists ? (snap.data() as TikTokConnection) : null;
      if (current?.refreshToken && current.refreshToken !== conn.refreshToken) {
        return; // Another refresh won; its tokens are newer.
      }
      tx.set(
        ref,
        {
          openId: conn.openId,
          accessToken: access_token,
          refreshToken: rotated,
          expiresAt,
          scopes,
          connectedAt: conn.connectedAt || Date.now(),
          updatedAt: Date.now(),
        } satisfies TikTokConnection,
        { merge: true },
      );
    });

    return access_token;
  } catch (error) {
    const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
    const code = axiosError.response?.data?.error || axiosError.response?.status || (error as Error)?.message;
    console.error('[tiktok] token refresh failed', uid, code); // never the token values

    // invalid_grants / revoked → require a fresh connect.
    if (axiosError.response?.status === 400 || axiosError.response?.data?.error === 'invalid_grants') {
      await markTikTokConnectionRevoked(uid);
    }
    return null;
  }
}

/**
 * Marks a connection as revoked/needing reconnect and deletes its secrets.
 * Keeps a tombstone so the UI can show "Reconnect" instead of "Connect".
 */
export async function markTikTokConnectionRevoked(uid: string): Promise<void> {
  const ref = db.collection(TIKTOK_CONNECTIONS_COLLECTION).doc(uid);
  const snap = await ref.get().catch(() => null);
  if (!snap?.exists) return;
  await ref
    .update({
      needsReconnect: true,
      revokedAt: Date.now(),
      updatedAt: Date.now(),
      accessToken: FieldValue.delete(),
      refreshToken: FieldValue.delete(),
      expiresAt: FieldValue.delete(),
    })
    .catch((error) => console.error('[tiktok] revoke mark failed', uid, (error as Error)?.message));
}

/**
 * Deletes a connection document. Justified uses: the seller's own
 * disconnect action, and the migration rollback script. Nothing else.
 */
export async function deleteTikTokConnection(uid: string): Promise<void> {
  await db.collection(TIKTOK_CONNECTIONS_COLLECTION).doc(uid).delete();
}
