/**
 * PUBLIC LISTING READER for the SEO segment layouts.
 *
 * `generateMetadata` and the JSON-LD graph both need the REAL product/shop
 * document on the server — the pages themselves stay client components (their
 * tests pin `page.tsx`), so the two segment layouts under
 * `src/app/products/[productId]` and `src/app/sellers/[sellerId]` read the
 * document here instead.
 *
 * ## Source order (same as the sitemap: PocketBase first)
 * 1. **PocketBase** (`pbGetProduct` / `pbGetShop`) — the VPS mirror holds the
 *    full document, so the app's own visibility rules apply without touching
 *    Firestore (and a Firestore quota error never reaches this path).
 * 2. **Firestore** — fallback when the mirror is disabled, has not backfilled
 *    the row, or returned nothing. Dynamic import, so the mirror path never
 *    loads firebase-admin.
 * 3. **States, never throws**:
 *    - `public`  — verified listed: metadata + JSON-LD are safe to emit.
 *    - `hidden`  — verified NOT listed (opt-out, tombstone, unpublished):
 *      the page gets `noindex` and NO structured data. No hidden document's
 *      fields ever reach the metadata.
 *    - `missing` — verified absent (product) — 404 page must not be indexed.
 *    - `unknown` — every source failed (quota, network): generic metadata,
 *      default (indexable) robots. A transient outage must not de-index a
 *      live listing; the client page still renders whatever Firestore says.
 *
 * `React.cache` dedupes the read between `generateMetadata` and the layout
 * body inside one request, so a product page costs one reader pass, not two.
 */
import { cache } from 'react';
import { pbGetProduct } from '@/lib/pocketbase/products';
import { pbGetShop } from '@/lib/pocketbase/shops';
import { isPublicListingDoc } from '@/lib/sitemap-catalogue';

/** Firestore doc-id hygiene — same alphabet/length the sitemap enforces. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export type SeoListingState = 'public' | 'hidden' | 'missing' | 'unknown';

export interface SeoListingResult {
  state: SeoListingState;
  /** The public document only — `hidden`/`missing` never carry data out. */
  doc: Record<string, unknown> | null;
}

const HIDDEN: SeoListingResult = { state: 'hidden', doc: null };
const MISSING: SeoListingResult = { state: 'missing', doc: null };
const UNKNOWN: SeoListingResult = { state: 'unknown', doc: null };

function classify(doc: Record<string, unknown>): SeoListingResult {
  return isPublicListingDoc(doc) ? { state: 'public', doc } : HIDDEN;
}

/** Merge the mirror row's own lifecycle status into the document view. */
function mirrorDoc(
  data: Record<string, unknown> | undefined,
  rowStatus: string | undefined,
): Record<string, unknown> {
  const doc = data ?? {};
  if (typeof doc.status === 'string' || !rowStatus) return doc;
  return { ...doc, status: rowStatus };
}

async function readFirestoreDoc(
  collection: 'products' | 'sellerShops',
  id: string,
): Promise<Record<string, unknown> | null | 'error'> {
  try {
    const { db } = await import('@/firebase/server');
    const snap = await db.collection(collection).doc(id).get();
    if (!snap.exists) return null;
    return (snap.data() ?? {}) as Record<string, unknown>;
  } catch (error) {
    // Quota / network — reported as "error" so the caller answers
    // `unknown` instead of de-indexing a live page on an outage.
    console.error(`[seo] Firestore read failed for ${collection}:`, error instanceof Error ? error.name : 'error');
    return 'error';
  }
}

async function readSeoListing(
  id: string,
  collection: 'products' | 'sellerShops',
  fromMirror: () => Promise<{ data?: Record<string, unknown>; status?: string } | null>,
): Promise<SeoListingResult> {
  if (!id || !ID_PATTERN.test(id)) return MISSING;
  try {
    const mirrored = await fromMirror();
    if (mirrored) return classify(mirrorDoc(mirrored.data, mirrored.status));
  } catch (error) {
    // The mirror helpers never throw today; belt and braces anyway.
    console.error(`[seo] mirror read failed for ${collection}:`, error instanceof Error ? error.name : 'error');
  }
  const doc = await readFirestoreDoc(collection, id);
  if (doc === 'error') return UNKNOWN;
  if (doc === null) return MISSING;
  return classify(doc);
}

/** Public product document for metadata/JSON-LD, by Firestore doc id. */
export async function readPublicProductSeo(productId: string): Promise<SeoListingResult> {
  return readSeoListing(productId, 'products', () => pbGetProduct(productId));
}

/**
 * Public shop document for metadata/JSON-LD. Note the seller page can still
 * render from the buyer-facing profile alone, so a MISSING shop is reported
 * as `missing` but the layout only noindexes `hidden` — a seller without a
 * shop document must not disappear from search.
 */
export async function readPublicShopSeo(sellerId: string): Promise<SeoListingResult> {
  return readSeoListing(sellerId, 'sellerShops', () => pbGetShop(sellerId));
}

/** Per-request dedupe: `generateMetadata` and the layout body share one read. */
export const readPublicProductSeoCached = cache(readPublicProductSeo);
export const readPublicShopSeoCached = cache(readPublicShopSeo);
