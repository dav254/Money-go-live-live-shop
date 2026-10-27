/**
 * ROBOTS (`/robots.txt`).
 *
 * Also missing until now — `/robots.txt` 404'd as HTML as well, which meant
 * crawlers had no pointer to the sitemap. Points at the canonical sitemap
 * URL and steers crawlers away from the private app surfaces (which are
 * already auth-gated; this is the politeness layer, not the security layer).
 *
 * ## Named crawler rules
 * `OAI-SearchBot` and the ordinary search crawlers get an EXPLICIT
 * `Allow: /` rule with the SAME disallow list as the wildcard rule: a
 * platform that documents per-bot robots expectations sees a positive allow
 * for public pages, while private surfaces stay steered around for every
 * bot. The wildcard rule below is unchanged from the original file.
 *
 * `GPTBot` is deliberately NOT named here — it keeps whatever the wildcard
 * rule has always given it; changing its permissions needs its own reason.
 */
import type { MetadataRoute } from 'next';
import { SITEMAP_ORIGIN } from '@/lib/sitemap-entries';

/** The original disallow list — private/authenticated surfaces. Preserved verbatim. */
const PRIVATE_DISALLOW = [
  '/dashboard',
  '/app',
  '/admin',
  '/api',
  '/auth',
  '/messages',
  '/checkout',
  '/buyer',
] as const;

/** Crawlers whose robots expectations we answer explicitly (same rules as `*`). */
const SEARCH_CRAWLERS = ['OAI-SearchBot', 'Googlebot', 'Bingbot', 'DuckDuckBot'] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Specific rules first: robots consumers take the first match, and the
      // named crawlers must see a positive Allow for public pages.
      ...SEARCH_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: [...PRIVATE_DISALLOW],
      })),
      {
        userAgent: '*',
        allow: '/',
        disallow: [...PRIVATE_DISALLOW],
      },
    ],
    sitemap: `${SITEMAP_ORIGIN}/sitemap.xml`,
  };
}
