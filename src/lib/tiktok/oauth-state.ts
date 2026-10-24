/**
 * TIKTOK OAUTH STATE — CSRF protection for the connect flow.
 *
 * The old flow used the raw Firebase UID as `state`: unsigned, unexpiring and
 * unbound to any browser, so a forged authorize redirect could inject an
 * attacker's TikTok tokens into a victim's profile (classic OAuth login CSRF).
 *
 * A state is now: `v1.<uid>.<expiresAtMs>.<nonce>.<hmac>` where the HMAC is
 * HMAC-SHA256 over the payload with a server-side secret. The full state is
 * ALSO stored in an HttpOnly cookie issued by /api/tiktok/connect, and the
 * callback requires the cookie to match the query parameter byte-for-byte —
 * binding the flow to the browser that started it. Single-use is enforced by
 * clearing the cookie on completion.
 *
 * Secret: `TIKTOK_OAUTH_SECRET` if set, else `TIKTOK_CLIENT_SECRET` (both
 * server-only). No secret → issue/verify refuse; there is deliberately no
 * weak fallback.
 *
 * This module is pure (node:crypto only) so it can be unit-tested without
 * Firestore or environment variables.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/** Cookie that binds a state to the browser that started the flow. */
export const STATE_COOKIE = 'vidnov_tk_oauth';

/** States are short-lived: enough to complete a consent screen, no more. */
export const STATE_TTL_MS = 10 * 60 * 1000;

const STATE_VERSION = 'v1';
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function hmac(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * The single source for the OAuth callback's redirect URI. Must match the
 * TikTok developer-portal registration exactly. No user input, no request
 * URL — so this can never become an open redirect.
 */
export function tikTokCallbackRedirectUri(): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  return `${base || 'http://localhost:3000'}/api/tiktok/callback`;
}

/** Where TikTok sends the browser back after consent/denial. */
export const SOCIAL_REACH_PAGE = '/dashboard/seller/social-reach';

/** The server-side signing secret, or null when none is configured. */
export function oauthStateSecret(): string | null {
  const secret = (process.env.TIKTOK_OAUTH_SECRET || process.env.TIKTOK_CLIENT_SECRET || '').trim();
  return secret.length >= 16 ? secret : null;
}

/**
 * Issues a signed state for `uid`. The returned string is what goes in both
 * the authorize URL's `state` parameter and the HttpOnly cookie.
 */
export function issueOAuthState(uid: string, secret: string, now = Date.now()): string {
  if (!UID_RE.test(uid)) throw new Error('Invalid uid for OAuth state.');
  if (!secret || secret.length < 16) throw new Error('OAuth state secret missing or too short.');
  const nonce = randomBytes(16).toString('base64url');
  const payload = `${STATE_VERSION}.${uid}.${now + STATE_TTL_MS}.${nonce}`;
  return `${payload}.${hmac(secret, payload)}`;
}

/**
 * Verifies a state from the callback: format, signature, expiry AND cookie
 * binding. Returns the uid on success, null on any failure (raw UIDs, tampered
 * payloads, expired states, missing/mismatched cookies, wrong secrets).
 *
 * Callers should not distinguish failure reasons in the response — that only
 * helps an attacker iterate.
 */
export function verifyOAuthState(
  state: string | null | undefined,
  cookieValue: string | null | undefined,
  secret: string | null,
  now = Date.now(),
): string | null {
  if (!state || !cookieValue || !secret) return null;
  // Binding: the exact state this browser was issued must come back.
  if (!safeEqual(state, cookieValue)) return null;

  const parts = state.split('.');
  if (parts.length !== 5) return null;
  const [version, uid, expiresRaw, nonce, signature] = parts;
  if (version !== STATE_VERSION) return null;
  if (!UID_RE.test(uid) || !nonce || !signature) return null;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;

  const expected = hmac(secret, `${version}.${uid}.${expiresRaw}.${nonce}`);
  if (!safeEqual(signature, expected)) return null;

  return uid;
}
