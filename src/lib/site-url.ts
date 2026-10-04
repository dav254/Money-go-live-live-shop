/**
 * THE PUBLIC ORIGIN — one place that knows the domain.
 *
 * ## Why this exists
 *
 * Shareable URLs were built from whatever was nearest: a hardcoded
 * `https://vidnov.app` in the referral module (a domain we do not own, so
 * every invite link ever copied pointed nowhere), `https://www.vidnov.com`
 * pasted into three other files, and `process.env.NEXT_PUBLIC_BASE_URL` read
 * without a fallback in the PayPal return URL — which produced the literal
 * string `"undefined/checkout/…"` when the variable was unset. Three sources of
 * truth for one domain is how a marketplace ends up with a referral link on the
 * wrong host.
 *
 * So: the default lives here, overridable per environment, and nothing else
 * spells the domain out.
 *
 * ## Order
 *
 *   1. `NEXT_PUBLIC_SITE_URL` — the explicit override, wins.
 *   2. `NEXT_PUBLIC_BASE_URL` — what the payment and OAuth callbacks already
 *      use, so an existing deployment keeps one setting rather than two.
 *   3. `DEFAULT_PUBLIC_ORIGIN`.
 *
 * ## `www`
 *
 * The canonical host is `www.vidnov.com`. `vidnov.com` is kept working by the
 * DNS record and the TLS certificate on the VPS; share it with `www` so the
 * link a user pastes matches what search engines index.
 */

export const DEFAULT_PUBLIC_ORIGIN = 'https://www.vidnov.com';

/** Trailing slashes stripped, so joining a path never yields `//`. */
function clean(value: string | undefined | null): string {
  return (value || '').trim().replace(/\/+$/, '');
}

/**
 * The origin every public link is built from.
 *
 * Safe to call in a client component: it reads `process.env.NEXT_PUBLIC_*`,
 * which Next inlines at build time. It never reads a server-only variable, so
 * this cannot leak a secret into the browser bundle.
 */
export function publicOrigin(): string {
  return (
    clean(process.env.NEXT_PUBLIC_SITE_URL) ||
    clean(process.env.NEXT_PUBLIC_BASE_URL) ||
    DEFAULT_PUBLIC_ORIGIN
  );
}

/** Absolute URL for a path, which may already begin with a slash. */
export function publicUrl(path = ''): string {
  const base = publicOrigin();
  if (!path) return base;
  return `${base}/${path.replace(/^\/+/, '')}`;
}
