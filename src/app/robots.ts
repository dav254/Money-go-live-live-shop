/**
 * ROBOTS (`/robots.txt`).
 *
 * Also missing until now — `/robots.txt` 404'd as HTML as well, which meant
 * crawlers had no pointer to the sitemap. Points at the canonical sitemap
 * URL and steers crawlers away from the private app surfaces (which are
 * already auth-gated; this is the politeness layer, not the security layer).
 */
import type { MetadataRoute } from 'next';
import { SITEMAP_ORIGIN } from '@/lib/sitemap-entries';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/app',
          '/admin',
          '/api',
          '/auth',
          '/messages',
          '/checkout',
          '/buyer',
        ],
      },
    ],
    sitemap: `${SITEMAP_ORIGIN}/sitemap.xml`,
  };
}