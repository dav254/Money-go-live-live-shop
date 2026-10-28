/**
 * Products on PocketBase — the "catalog" section of the Firestore →
 * self-hosting migration.
 *
 * Products are the marketplace's core asset: every listing a seller creates.
 * They were written and read ONLY through Firestore (client SDK in ~40
 * pages), so a Firestore outage made sellers' entire stock invisible — no
 * listings in their shop, nothing in Discovery, nothing in the admin lists.
 *
 * This mirror keeps the full product document (arrays and all) in a `data`
 * JSON field on the local PocketBase instance, plus a few indexed scalar
 * columns for querying (sellerId, price, stock…). Writes flow client →
 * Firestore (unchanged) → best-effort sync call → here. Reads try this store
 * FIRST and fall back to Firestore, so the catalog survives whatever Firestore
 * does.
 *
 * Same migration rules as the other sections: every helper returns null/false
 * when PocketBase is not configured and NEVER throws — a mirror failure must
 * never break a publish.
 */

import {
  ensureCollection,
  pbCreateRecord,
  pbListRecords,
  pocketBaseEnabled,
  pbRequest,
  type PbField,
  type PbRecord,
} from './server';

export const PRODUCTS_COLLECTION = 'products';

const PRODUCT_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true }, // Firestore doc id — makes the mirror re-runnable
  // Admin console toggles (feature / unpublish) — also kept inside `data`.
  { name: 'featured', type: 'bool' },
  { name: 'unpublished', type: 'bool' },
  { name: 'sellerId', type: 'text' },
  { name: 'name', type: 'text' },
  { name: 'category', type: 'text' },
  { name: 'listingType', type: 'text' },
  { name: 'price', type: 'number' },
  { name: 'stock', type: 'number' },
  { name: 'imageUrl', type: 'text' },
  { name: 'status', type: 'text' }, // 'active' | 'deleted' — deletions tombstone
  { name: 'createdAt', type: 'date' },
  // The WHOLE product document (name, description, media arrays, likes…)
  // so any screen can render a listing from this store alone.
  { name: 'data', type: 'json' },
];

/** The subset this mirror keeps as indexed columns + the full document. */
export interface PbProduct {
  id: string; // Firestore doc id
  sellerId?: string;
  name?: string;
  category?: string;
  listingType?: string;
  price?: number;
  stock?: number;
  imageUrl?: string;
  status?: string;
  createdAt?: string | null;
  data?: Record<string, unknown>;
}

const esc = (value: string) => value.replace(/'/g, "\\'");

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function toProduct(record: PbRecord): PbProduct {
  const data = (record.data ?? null) as Record<string, unknown> | null;
  return {
    id: String(record.fsId ?? record.id),
    sellerId: str(record.sellerId) ?? str(data?.sellerId),
    name: str(record.name) ?? str(data?.name),
    category: str(record.category) ?? str(data?.category),
    listingType: str(record.listingType) ?? str(data?.listingType),
    price: num(record.price) ?? num(data?.price),
    stock: num(record.stock) ?? num(data?.stock),
    imageUrl: str(record.imageUrl) ?? str(data?.imageUrl),
    status: str(record.status),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : null,
    data: data ?? undefined,
  };
}

async function findByFsId(fsId: string): Promise<PbRecord | null> {
  const rows = await pbListRecords(PRODUCTS_COLLECTION, {
    filter: `fsId = '${esc(fsId)}'`,
    perPage: 1,
  });
  return rows[0] ?? null;
}

/**
 * Mirror one product to the VPS store. `data` should be the FULL Firestore
 * document (Timestamps already converted to ISO strings). Never throws;
 * returns false when PB is off or the write failed.
 */
export async function pbMirrorProduct(
  fsId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    await ensureCollection(PRODUCTS_COLLECTION, PRODUCT_FIELDS);
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Only scalars/arrays/objects survive — server Timestamps should have
      // been converted by the caller, anything else is skipped.
      if (value === null || ['string', 'number', 'boolean', 'object'].includes(typeof value)) {
        clean[key] = value;
      }
    }
    const columns = {
      sellerId: str(clean.sellerId) ?? '',
      name: str(clean.name) ?? '',
      category: str(clean.category) ?? '',
      listingType: str(clean.listingType) ?? '',
      price: num(clean.price) ?? 0,
      stock: num(clean.stock) ?? 0,
      imageUrl: str(clean.imageUrl) ?? '',
      status: 'active',
    };
    const body = JSON.stringify({ fsId, ...columns, data: clean });
    const existing = await findByFsId(fsId);
    if (existing) {
      const res = await pbRequest(
        `/api/collections/${PRODUCTS_COLLECTION}/records/${existing.id}`,
        { method: 'PATCH', body },
      );
      return res.ok;
    }
    await pbCreateRecord(PRODUCTS_COLLECTION, { fsId, ...columns, data: clean });
    return true;
  } catch (error) {
    console.error('[pocketbase] product mirror failed:', error);
    return false;
  }
}

/**
 * Merge a few fields into a mirrored product (admin feature/unpublish flags).
 * The patch lands BOTH on the indexed columns and inside the full `data`
 * document, so every reader sees the same value. Never throws; false = PB off
 * or no mirrored row / write failed (callers fall back to Firestore).
 */
export async function pbPatchProduct(
  fsId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    await ensureCollection(PRODUCTS_COLLECTION, PRODUCT_FIELDS);
    const existing = await findByFsId(fsId);
    if (!existing) return false; // Not mirrored — Firestore must take it.
    const current = ((existing.data ?? {}) as Record<string, unknown>);
    const nextData = { ...current, ...patch };
    const body: Record<string, unknown> = { data: nextData };
    if ('featured' in patch) body.featured = patch.featured === true;
    if ('unpublished' in patch) body.unpublished = patch.unpublished === true;
    const res = await pbRequest(
      `/api/collections/${PRODUCTS_COLLECTION}/records/${existing.id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    );
    return res.ok;
  } catch (error) {
    console.error('[pocketbase] product patch failed:', error);
    return false;
  }
}

/**
 * Tombstone a product on the VPS (the seller deleted it in the app). The row
 * is kept with status='deleted' and an emptied `data` so reads can filter it
 * out without racing a slower Firestore delete. Never throws.
 */
export async function pbDeleteProduct(fsId: string): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    const existing = await findByFsId(fsId);
    if (!existing) return true; // Nothing mirrored — nothing to hide.
    const res = await pbRequest(
      `/api/collections/${PRODUCTS_COLLECTION}/records/${existing.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'deleted', data: null, stock: 0 }),
      },
    );
    return res.ok;
  } catch (error) {
    console.error('[pocketbase] product delete failed:', error);
    return false;
  }
}

/** One product straight from the VPS store, or null (PB off / missing / error). */
export async function pbGetProduct(fsId: string): Promise<PbProduct | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(PRODUCTS_COLLECTION, PRODUCT_FIELDS);
    const existing = await findByFsId(fsId);
    if (!existing) return null;
    const product = toProduct(existing);
    return product.status === 'deleted' ? null : product;
  } catch (error) {
    console.error('[pocketbase] product read failed:', error);
    return null;
  }
}

/**
 * A seller's listings from the VPS store (newest first), or null when PB is
 * off / the read failed — callers fall back to Firestore either way.
 */
export async function pbListProductsBySeller(
  sellerId: string,
  limit = 300,
): Promise<PbProduct[] | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(PRODUCTS_COLLECTION, PRODUCT_FIELDS);
    const rows = await pbListRecords(PRODUCTS_COLLECTION, {
      filter: `sellerId = '${esc(sellerId)}' && status != 'deleted'`,
      sort: '-createdAt',
      perPage: Math.min(limit, 500),
    });
    return rows.map(toProduct).filter((p) => p.data);
  } catch (error) {
    console.error('[pocketbase] product list failed:', error);
    return null;
  }
}

/** All live listings (admin lists, feeds), newest first. Null when PB is off/failed. */
export async function pbListAllProducts(limit = 500): Promise<PbProduct[] | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(PRODUCTS_COLLECTION, PRODUCT_FIELDS);
    const rows = await pbListRecords(PRODUCTS_COLLECTION, {
      filter: `status != 'deleted'`,
      sort: '-createdAt',
      perPage: Math.min(limit, 500),
    });
    return rows.map(toProduct).filter((p) => p.data);
  } catch (error) {
    console.error('[pocketbase] product list-all failed:', error);
    return null;
  }
}
