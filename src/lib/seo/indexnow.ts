/**
 * INDEXNOW — "seen faster" half of the AI exposure engine.
 *
 * ## What it is
 * IndexNow is an open protocol Bing, DuckDuckGo, Yandex and Seznam support:
 * one POST tells them "these URLs changed, come re-crawl them now" instead of
 * waiting days for a spider to find the change on its own. (Google does not
 * participate — Google is served by the sitemap instead.)
 *
 * ## Contract
 * - **Own opt-in flag** `INDEXNOW_ENABLED=true` — this feature neither reads
 *   nor depends on any other feature's flag. Off by default: nothing leaves
 *   the app until it is switched on.
 * - **No credentials, no secrets**: the protocol's "key" is a public value we
 *   publish ourselves at `/indexnow-key.txt` (any 32-char hex string; the
 *   spec only requires host + key file to match the payload).
 * - **Never throws, never blocks the caller**: listing create/edit/delete
 *   flows fire it fire-and-forget — a ping failure must not fail a publish.
 * - **Logs are status-only**: never the response body, never the URLs
 *   (the static messages below are the whole log vocabulary).
 * - **Public canonical URLs only**: private/admin/login/user-specific paths,
 *   query strings, fragments and off-origin URLs are dropped BEFORE anything
 *   reaches the wire (see `isSubmittablePath`).
 * - Bounded: one batch per call, 5s network timeout, ≤ 10,000 URLs rejected
 *   by us before they reach the wire (the protocol's own cap).
 */
import { publicOrigin, publicUrl } from '@/lib/site-url';
import { isPrivatePath } from '@/lib/sitemap-entries';

/** IndexNow submission endpoint (the protocol's official receiver). */
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/**
 * Our public key: any 32-character hexadecimal string. It is NOT a secret —
 * search engines fetch it from `/indexnow-key.txt` to verify the host, so it
 * lives in code rather than in an environment variable on purpose.
 */
export const INDEXNOW_KEY = '9c2f4a7be1d84f3fa6c0e5738b1d24fe';

/** Path serving the key — must match the `keyLocation` we submit. */
export const INDEXNOW_KEY_PATH = '/indexnow-key.txt';

/** Own feature flag for this engine; true only when explicitly enabled. */
export function indexnowEnabled(): boolean {
  return (process.env.INDEXNOW_ENABLED ?? '').trim().toLowerCase() === 'true';
}

/**
 * Auth-flow and user-specific surfaces that must NEVER be submitted, even
 * though the sitemap's segment-aware deny-list does not name them (the
 * sitemap only ever emits an allow-list, so it never needed these).
 */
const NEVER_SUBMIT_PREFIXES = [
  '/cart',
  '/notifications',
  '/my-media',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/invoice',
  '/app-preview',
  '/admin-login-net',
] as const;

/**
 * Is this path a public, canonical URL we are willing to submit?
 *
 * - must be a root-relative site path (`/products/x`, never an absolute URL
 *   we did not build ourselves);
 * - no query string or fragment: canonical public URLs carry no tokens,
 *   filters or tracking — this is what keeps user-specific URLs out;
 * - no whitespace/control characters;
 * - the shared segment-aware deny-list the sitemap uses (covers `/dashboard`,
 *   `/admin`, `/auth`, `/api`, `/buyer`, `/seller`, … without false-positives
 *   like `/sellers/…`), plus the auth-flow prefixes above.
 */
function isSubmittablePath(path: string): boolean {
  if (!path.startsWith('/')) return false;
  if (/[?#]/.test(path)) return false;
  if (/[\u0000-\u001f\s]/.test(path)) return false;
  if (isPrivatePath(path)) return false;
  return !NEVER_SUBMIT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export interface IndexNowResult {
  sent: boolean;
  reason?: 'disabled' | 'no-urls' | 'network' | 'rejected';
  status?: number;
}

/**
 * Ping IndexNow with a batch of site-relative paths (`/products/xyz`).
 * Returns a small result for tests; callers should fire-and-forget
 * (`void pingIndexNow([...])`).
 */
export async function pingIndexNow(
  paths: string[],
  fetchLike: typeof fetch = fetch,
): Promise<IndexNowResult> {
  if (!indexnowEnabled()) return { sent: false, reason: 'disabled' };

  const origin = publicOrigin();
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const path of paths) {
    if (!isSubmittablePath(path)) continue;
    const url = publicUrl(path);
    // Must parse and stay on our own origin — a batch never leaves the host
    // we built it for.
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (parsed.origin !== new URL(origin).origin) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= 10000) break;
  }
  if (!urls.length) return { sent: false, reason: 'no-urls' };

  const host = new URL(origin).hostname;
  const body = JSON.stringify({
    host,
    key: INDEXNOW_KEY,
    keyLocation: publicUrl(INDEXNOW_KEY_PATH),
    urlList: urls,
  });

  try {
    const res = await fetchLike(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body,
      signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
        ? AbortSignal.timeout(5000)
        : undefined,
    });
    if (!res.ok) {
      console.warn('[indexnow] ping rejected with status', res.status);
      return { sent: false, reason: 'rejected', status: res.status };
    }
    return { sent: true, status: res.status };
  } catch {
    // Network/timeout — one fixed line, no bodies, no URLs.
    console.warn('[indexnow] ping failed (network)');
    return { sent: false, reason: 'network' };
  }
}
