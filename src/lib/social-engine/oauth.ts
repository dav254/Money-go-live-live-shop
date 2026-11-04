/**
 * SOCIAL ENGINE — OAuth plumbing.
 *
 * Reuses the EXISTING hardened state implementation from
 * `src/lib/tiktok/oauth-state.ts` (HMAC-SHA256, expiring, single-use,
 * HttpOnly-cookie-bound) for every Social Engine connect flow — one state
 * implementation, not two. The signing secret is the existing
 * `oauthStateSecret()` (TIKTOK_OAUTH_SECRET, falling back to
 * TIKTOK_CLIENT_SECRET): the repository already treats it as *the* OAuth
 * state secret (task §11: reuse existing names).
 *
 * Also provides:
 *   • redirect-URI builders + validation against the registered env names
 *     (callback URL validation, task §10),
 *   • a minimal OAuth 1.0a (HMAC-SHA1) signer for Tumblr,
 *   • the per-module callback path.
 *
 * Pure where possible (crypto only) so tests can run without Firestore.
 */
import { createHmac } from 'crypto';
import { issueOAuthState, oauthStateSecret, verifyOAuthState } from '@/lib/tiktok/oauth-state';
import { callbackUrl as trackedCallbackUrl } from './url-track';

/** Per-module HttpOnly cookie that binds a flow to the browser. */
export function stateCookieName(module: string): string {
  return `vidnov_se_${module.replace(/[^a-z0-9_]/gi, '')}`;
}

export const STATE_COOKIE_PATH = '/api/social-engine';

/**
 * Issues a signed state for the given user. Throws when no secret is
 * configured — there is deliberately no weak fallback.
 *
 * The state is `v1.<uid>.<expiresAtMs>.<nonce>.<hmac>` (see the existing
 * `tiktok/oauth-state.ts`), so it names the administrator who started the
 * flow and the callback can bind the result to that account.
 */
export function issueState(uid: string, secret?: string | null, now?: number): string {
  const signingSecret = secret ?? oauthStateSecret();
  if (!signingSecret) {
    throw new Error('OAuth state secret missing (TIKTOK_OAUTH_SECRET / TIKTOK_CLIENT_SECRET).');
  }
  return issueOAuthState(uid, signingSecret, now);
}

/**
 * Verifies the state AND its HttpOnly cookie binding for a module callback.
 * Returns the uid that started the flow, or null on any failure (tampered,
 * expired, missing/mismatched cookie, no secret).
 *
 * The module is not part of the signature: it is fixed by the callback route
 * and by the cookie NAME, so a state issued for one provider cannot be
 * replayed against another provider's callback.
 */
export function verifyState(
  state: string | null | undefined,
  cookie: string | null | undefined,
  secret?: string | null,
  now?: number,
): string | null {
  const signingSecret = secret ?? oauthStateSecret();
  if (!signingSecret) return null;
  return verifyOAuthState(state, cookie, signingSecret, now);
}

/** Cookie attributes shared by every connect flow (single definition). */
export function stateCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: STATE_COOKIE_PATH,
    maxAge: 600,
  };
}

/** The signed-state lifetime, exported for the dashboard and tests. */
export { STATE_TTL_MS } from '@/lib/tiktok/oauth-state';

/** `{origin}/api/social-engine/callback/{module}` — fixed, never from input. */
export function callbackPath(module: string): string {
  return `/api/social-engine/callback/${module}`;
}

/** The absolute callback URL — validated against the module registry. */
export function callbackUrl(module: string): string {
  return trackedCallbackUrl(module);
}

/**
 * Validates a registered callback env var against our real callback URL.
 * Returns a static reason on mismatch (names only, never the values — the
 * values are URLs, but an attacker-controlled env echo is still refused).
 */
export function validateRegisteredCallback(envValue: string | undefined, module: string): {
  ok: boolean;
  reason?: string;
} {
  const registered = (envValue ?? '').trim().replace(/\/+$/, '');
  if (!registered) return { ok: false, reason: `Callback not configured (${callbackEnvName(module)}).` };
  const expected = callbackUrl(module).replace(/\/+$/, '');
  if (registered.toLowerCase() !== expected.toLowerCase()) {
    return {
      ok: false,
      reason: `${callbackEnvName(module)} must exactly equal {origin}${callbackPath(module)} as registered with the provider.`,
    };
  }
  return { ok: true };
}

export function callbackEnvName(module: string): string {
  switch (module) {
    case 'tumblr':
      return 'TUMBLR_CALLBACK_URL';
    case 'mastodon':
      return 'MASTODON_REDIRECT_URI';
    case 'discord':
      return 'DISCORD_REDIRECT_URI';
    default:
      return `${module.toUpperCase()}_REDIRECT_URI`;
  }
}

/* ── OAuth 1.0a (Tumblr) ─────────────────────────────────────────────────── */

export interface OAuth1Params {
  method: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
  token?: string;
  tokenSecret?: string;
  /** Extra request params (query + body) — merged, percent-encoded once. */
  params?: Record<string, string>;
  verifier?: string;
}

/**
 * Signs a request per RFC 5849: percent-encoded, sorted, HMAC-SHA1 over the
 * base string with `consumerSecret&tokenSecret`. Returns the Authorization
 * header value. Pure — testable without the network.
 */
export function oauth1AuthorizationHeader(req: OAuth1Params): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: req.consumerKey,
    oauth_nonce: randomNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: '1.0',
  };
  if (req.token) oauthParams.oauth_token = req.token;
  if (req.verifier) oauthParams.oauth_verifier = req.verifier;

  const all: Record<string, string> = { ...req.params, ...oauthParams };
  const encode = (v: string) =>
    encodeURIComponent(v).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  const sorted = Object.keys(all)
    .sort()
    .map((k) => `${encode(k)}=${encode(all[k])}`)
    .join('&');
  const baseString = [req.method.toUpperCase(), encode(req.url), encode(sorted)].join('&');
  const signingKey = `${encode(req.consumerSecret)}&${encode(req.tokenSecret ?? '')}`;
  const signature = createHmac('sha1', signingKey).update(baseString).digest('base64');
  oauthParams.oauth_signature = signature;

  const header = Object.keys(oauthParams)
    .sort()
    .map((k) => `${encode(k)}="${encode(oauthParams[k])}"`)
    .join(', ');
  return `OAuth ${header}`;
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
