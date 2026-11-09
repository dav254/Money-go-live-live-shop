import { db } from '@/firebase/server';
import { pbListProductsBySeller } from '@/lib/pocketbase/products';

/**
 * ONE SELLER'S STOCK, FROM BOTH STORES.
 *
 * Vidnov keeps listings in two places: Firestore (where the website writes
 * them) and the VPS mirror (where the API and the Android app read them). The
 * mirror is filled by the server's own write paths and by `/api/products/sync`,
 * which means a listing created straight from the website's browser can exist
 * in Firestore and NOT in the mirror.
 *
 * Reading only the mirror therefore made a shop look empty — "my products were
 * deleted" — even though every listing was fine. Reading only Firestore made
 * the app look empty whenever Firestore was slow.
 *
 * So the seller's own stock is the UNION of the two, de-duplicated by product
 * id (the mirror wins, because it is the copy the API already serves), newest
 * first. Both reads are capped at the same limit, so the cost is one extra
 * query on a screen the seller opens occasionally.
 */

export type StockProduct = Record<string, unknown> & { id: string };

export type StockResult = {
  products: StockProduct[];
  source: 'vps' | 'firestore' | 'merged' | 'none';
  /** True when the Firestore read failed — callers should not treat an empty list as authoritative. */
  partial: boolean;
};

/** Firestore Timestamp / ISO string / number → epoch ms (0 when unknown). */
export function toMs(value: unknown): number {
  if (value && typeof value === 'object') {
    const maybe = value as { toMillis?: () => number; _seconds?: number };
    if (typeof maybe.toMillis === 'function') return maybe.toMillis();
    if (typeof maybe._seconds === 'number') return maybe._seconds * 1000;
  }
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export async function loadSellerStock(uid: string, limit = 300): Promise<StockResult> {
  const mirrored = await pbListProductsBySeller(uid, limit).catch(() => null);
  const fromVps: StockProduct[] = (mirrored ?? [])
    .filter((row) => row && row.id)
    .map((row) => ({ id: row.id, ...((row.data ?? {}) as Record<string, unknown>) }) as StockProduct);

  let fromDb: StockProduct[] = [];
  let firestoreFailed = false;
  try {
    const snap = await db.collection('products').where('sellerId', '==', uid).limit(limit).get();
    fromDb = snap.docs.map(
      (doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }) as StockProduct,
    );
  } catch {
    firestoreFailed = true;
  }

  const seen = new Set(fromVps.map((product) => product.id));
  const merged = [
    ...fromVps,
    ...fromDb.filter((product) => !seen.has(product.id)),
  ].sort((a, b) => toMs(b.uploadDate) - toMs(a.uploadDate));

  const source: StockResult['source'] =
    fromVps.length > 0 && fromDb.length > 0
      ? 'merged'
      : fromVps.length > 0
        ? 'vps'
        : fromDb.length > 0
          ? 'firestore'
          : 'none';

  return { products: merged, source, partial: firestoreFailed };
}
