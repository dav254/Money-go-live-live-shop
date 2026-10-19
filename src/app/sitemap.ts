/**
 * SITEMAP (`/sitemap.xml`).
 *
 * ## Why this file exists
 *
 * There was no sitemap route at all: `/sitemap.xml` fell through to the app's
 * 404 and Google Search Console received Next's HTML error page — reported as
 * "Sitemap is HTML". This is the App Router convention for Next 15, so the
 * framework serves it at exactly `/sitemap.xml` with an `application/xml`
 * content type and no competing hand-rolled route.
 *
 * ## Freshness
 *
 * `force-dynamic` keeps the route server-rendered per request: the catalog
 * changes with every seller upload, and a build-time snapshot would go stale
 * silently. If Firestore is unreachable the route degrades to the static core
 * (homepage) rather than failing — a 500 here would show up in Search
 * Console as a sitemap error, which is exactly the class of bug this file
 * fixes.
 */
import type { MetadataRoute } from 'next';
import { db } from '@/firebase/server';
import { buildSitemapEntries, SITEMAP_ORIGIN } from '@/lib/sitemap-entries';

export const dynamic = 'force-dynamic';

/** Single-field queries only — no composite index required. */
const MAX_PRODUCTS = 1000;
const MAX_SHOPS = 500;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const [productsSnap, shopsSnap] = await Promise.all([
      db.collection('products').orderBy('uploadDate', 'desc').limit(MAX_PRODUCTS).get(),
      // Shop documents are keyed by seller id (see buyer live/shop pages).
      db.collection('sellerShops').limit(MAX_SHOPS).get(),
    ]);

    const productIds = productsSnap.docs.map((d) => d.id);
    const shopIds = shopsSnap.docs.map(
      (d) => (d.data() as { sellerId?: string }).sellerId || d.id,
    );

    // Both `/products/[id]` and `/sellers/[id]` are public, unauthenticated
    // pages; every listing the public feed already shows is indexable by
    // definition. Entries are privacy-filtered and deduplicated in the lib.
    return buildSitemapEntries({ productIds, shopIds });
  } catch (error) {
    // Never let the sitemap die with the database: serve the guaranteed core
    // (homepage) so crawlers keep a valid document between hiccups.
    console.error('[sitemap] listing query failed, serving core sitemap:', error);
    return [{ url: SITEMAP_ORIGIN }];
  }
}