/**
 * SITEMAP ENTRIES — one pure place that decides what Google is allowed to see.
 *
 * Kept free of Next.js and Firestore imports so `src/app/sitemap.ts` stays a
 * thin data fetch and `src/tests/sitemap.test.ts` can exercise the rules
 * directly.
 *
 * ## Origin
 *
 * `https://vidnov.com` (bare) is the canonical host in the sitemap: it is the
 * domain Search Console property is registered against, and `www.vidnov.com`
 * already 301-redirects to it, so every URL we emit is the URL a crawler
 * lands on after following redirects.
 *
 * ## Privacy rule
 *
 * The sitemap is an allow-list of public surfaces (homepage, `/products/…`,
 * `/sellers/…`) — private dashboards can never appear just because a document
 * id showed up in a query. `PRIVATE_PREFIXES` additionally acts as a
 * segment-aware deny-list on the way out, as defence in depth: `/seller/…`
 * must NOT block `/sellers/…` (different segment), which a naive
 * `startsWith` would get wrong.
 */

export const SITEMAP_ORIGIN = 'https://vidnov.com';

/**
 * Private/authenticated surfaces that must never be listed. Checked
 * segment-aware: the prefix matches only as a whole path segment.
 */
export const PRIVATE_PREFIXES = [
  '/dashboard',
  '/app',
  '/admin',
  '/auth',
  '/api',
  '/messages',
  '/checkout',
  '/buyer',
  '/seller',
  '/live',
  '/signup',
  '/login',
  '/chat',
  '/ai-studio',
  '/requests',
  '/profile',
] as const;

/** Segment-aware privacy check: `/seller/x` is private, `/sellers/x` is not. */
export function isPrivatePath(path: string): boolean {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return PRIVATE_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

export interface SitemapEntry {
  url: string;
  lastModified?: string;
}

/**
 * A Firestore document id that would produce a broken or unsafe URL is
 * skipped rather than escaped into the XML: ids are URL-safe in this app
 * (Firebase auto-ids), but anything outside [A-Za-z0-9_-] or empty is not a
 * public listing we are willing to vouch for.
 */
function safeId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
}

function entry(path: string, lastModified?: string): SitemapEntry {
  return lastModified ? { url: `${SITEMAP_ORIGIN}${path}`, lastModified } : { url: `${SITEMAP_ORIGIN}${path}` };
}

/**
 * Builds the final entry list: homepage first, then public product/service
 * listings, then public seller shops. Deduplicated, privacy-filtered, and
 * capped well under the protocol's 50,000-URL ceiling.
 */
export function buildSitemapEntries(input: {
  productIds: readonly unknown[];
  shopIds: readonly unknown[];
  /** Optional ISO date per document id (e.g. last update) for `<lastmod>`. */
  updatedAtById?: Record<string, string | undefined>;
}): SitemapEntry[] {
  const seen = new Set<string>([SITEMAP_ORIGIN]);
  const entries: SitemapEntry[] = [{ url: SITEMAP_ORIGIN }];

  const push = (path: string, id: string) => {
    if (isPrivatePath(path)) return;
    const url = `${SITEMAP_ORIGIN}${path}`;
    if (seen.has(url)) return;
    seen.add(url);
    const lastModified = input.updatedAtById?.[id];
    entries.push(entry(path, lastModified));
  };

  for (const id of input.productIds) {
    if (!safeId(id)) continue;
    push(`/products/${id}`, id);
  }
  for (const id of input.shopIds) {
    if (!safeId(id)) continue;
    push(`/sellers/${id}`, id);
  }

  return entries.slice(0, 5000);
}

/**
 * Serializes entries the way the sitemap protocol expects. Next.js renders
 * the real route with its own serializer; this exists so tests can parse an
 * actual document and prove escaping + structure without a running server.
 */
export function entriesToSitemapXml(entries: readonly SitemapEntry[]): string {
  const escape = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const urls = entries
    .map((e) => {
      const lastmod = e.lastModified
        ? `<lastmod>${escape(e.lastModified)}</lastmod>`
        : '';
      return `  <url><loc>${escape(e.url)}</loc>${lastmod}</url>`;
    })
    .join('\n');

  return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}