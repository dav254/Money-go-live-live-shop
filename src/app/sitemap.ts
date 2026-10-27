/**
 * SITEMAP (`/sitemap.xml`).
 *
 * ## Why this file exists
 * There was no sitemap route at all: `/sitemap.xml` fell through to the app's
 * 404 and Google Search Console received Next's HTML error page — reported as
 * "Sitemap is HTML". This is the App Router convention for Next 15, so the
 * framework serves it at exactly `/sitemap.xml` with an `application/xml`
 * content type and no competing hand-rolled route.
 *
 * ## Source order — PocketBase first (the fix for Firestore quota errors)
 * 1. **PocketBase** (`src/lib/sitemap-catalogue`) — the VPS mirror holds the
 *    full product/shop documents, so the sitemap paginates through it and
 *    applies the app's own visibility rules WITHOUT touching Firestore. When
 *    Firestore answers `RESOURCE_EXHAUSTED: Quota exceeded`, this path keeps
 *    working unchanged.
 * 2. **Firestore** — fallback when PocketBase is disabled/unreachable/empty.
 *    Imported dynamically so the normal PocketBase path never even loads the
 *    Firestore client.
 * 3. **Homepage-only core** — if neither source can serve a catalogue, the
 *    route still returns a valid document (a 500 here would show up in
 *    Search Console as a sitemap error). We never fabricate ids and never
 *    claim a catalogue is complete when it is not.
 *
 * ## Freshness
 * `force-dynamic` keeps the route server-rendered per request: the catalog
 * changes with every seller upload, and a build-time snapshot would go stale
 * silently.
 *
 * Entry rules (canonical origin, private-surface deny-list, id hygiene,
 * protocol caps) live in `src/lib/sitemap-entries` and are tested in
 * `src/tests/sitemap.test.ts`; source/visibility/pagination rules live in
 * `src/tests/sitemap-catalogue.test.ts`.
 */
import type { MetadataRoute } from 'next';
import { buildSitemapEntries, SITEMAP_ORIGIN } from '@/lib/sitemap-entries';
import {
  isPublicListingDoc,
  readPocketBaseCatalogue,
  resolveCatalogue,
  type CatalogueIds,
} from '@/lib/sitemap-catalogue';

export const dynamic = 'force-dynamic';

/** Single-field Firestore queries only — no composite index required. */
const FS_MAX_PRODUCTS = 1000;
const FS_MAX_SHOPS = 500;

/**
 * Firestore fallback. Mirrors the original sitemap query shape (quota-friendly
 * single-field queries) but now applies the same public-visibility rules the
 * PocketBase path uses, so a listing hidden in the document never appears.
 * Returns null on ANY failure — including quota errors — so the caller can
 * fall back to the core document.
 */
async function fetchFirestoreCatalogue(): Promise<CatalogueIds | null> {
  try {
    // Dynamic import: the PocketBase path never loads firebase-admin.
    const { db } = await import('@/firebase/server');
    const [productsSnap, shopsSnap] = await Promise.all([
      db.collection('products').orderBy('uploadDate', 'desc').limit(FS_MAX_PRODUCTS).get(),
      // Shop documents are keyed by seller id (see buyer live/shop pages).
      db.collection('sellerShops').limit(FS_MAX_SHOPS).get(),
    ]);

    const productIds: string[] = [];
    const shopIds: string[] = [];
    const updatedAtById: Record<string, string> = {};

    for (const doc of productsSnap.docs) {
      const data = doc.data() as Record<string, unknown>;
      if (!isPublicListingDoc(data)) continue;
      productIds.push(doc.id);
      const stamp = isoFromDoc(data.updatedAt ?? data.uploadDate);
      if (stamp) updatedAtById[doc.id] = stamp;
    }
    for (const doc of shopsSnap.docs) {
      const data = doc.data() as Record<string, unknown>;
      if (!isPublicListingDoc(data)) continue;
      // Same id rule as before: the sellerId field when present, else the
      // document id (sellerShops/{uid}).
      const id = (typeof data.sellerId === 'string' && data.sellerId) || doc.id;
      shopIds.push(id);
    }

    return { productIds, shopIds, updatedAtById, source: 'firestore' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[sitemap] Firestore catalogue unavailable, continuing without it:', message);
    return null;
  }
}

function isoFromDoc(value: unknown): string | undefined {
  if (typeof value === 'string') return /^\d{4}-\d{2}-\d{2}T/.test(value) ? value : undefined;
  const timed = value as { toDate?: () => Date } | undefined;
  if (timed && typeof timed.toDate === 'function') {
    try {
      return timed.toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const catalogue = await resolveCatalogue({
      fromPocketBase: readPocketBaseCatalogue,
      fromFirestore: fetchFirestoreCatalogue,
    });
    if (!catalogue) {
      // No source could vouch for a single listing — serve the guaranteed
      // core so crawlers keep a valid document between outages.
      return [{ url: SITEMAP_ORIGIN }];
    }
    // Entries are privacy-filtered, deduplicated and capped in the lib.
    return buildSitemapEntries(catalogue);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[sitemap] unexpected failure, serving core sitemap:', message);
    return [{ url: SITEMAP_ORIGIN }];
  }
}
