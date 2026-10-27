/**
 * Seller shops on PocketBase — the "storefronts" section of the Firestore →
 * self-hosting migration.
 *
 * `sellerShops/{uid}` is the shop profile: name, logo, banner, category,
 * location, social links. Discovery, the buyer dashboard, invoices, request
 * matching and the LIVE grid all read it. The product catalog was already
 * mirrored, but the shop record itself was not — so a Firestore outage still
 * hid every storefront (and its seller attribution) even though the listings
 * behind it survived on the VPS.
 *
 * Same contract as the other sections: the FULL Firestore document lives in a
 * `data` JSON field (Timestamps already converted to ISO strings by the
 * caller) plus a few indexed scalar columns for querying. Every helper
 * returns null/false when PocketBase is not configured and NEVER throws — a
 * mirror failure must never break a seller saving their branding.
 *
 * The doc id IS the owner's uid (settings write `sellerShops/{uid}`), so
 * `fsId` and `ownerId` are the same value; keeping both makes the mirror
 * readable without knowing that convention.
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

export const SHOPS_COLLECTION = 'seller_shops';

export const SHOP_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true }, // Firestore doc id (= owner uid)
  { name: 'ownerId', type: 'text' },
  { name: 'shopName', type: 'text' },
  { name: 'category', type: 'text' },
  { name: 'county', type: 'text' },
  { name: 'cityTown', type: 'text' },
  { name: 'logoUrl', type: 'text' },
  // The WHOLE shop document (banner, social links, service areas, businessId…)
  // so a screen can render a storefront from this store alone.
  { name: 'data', type: 'json' },
];

/** The subset this mirror keeps as indexed columns + the full document. */
export interface PbShop {
  id: string; // Firestore doc id (owner uid)
  ownerId?: string;
  shopName?: string;
  category?: string;
  county?: string;
  cityTown?: string;
  logoUrl?: string;
  data?: Record<string, unknown>;
}

const esc = (value: string) => value.replace(/'/g, "\\'");

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

function toShop(record: PbRecord): PbShop {
  const data = (record.data ?? null) as Record<string, unknown> | null;
  return {
    id: String(record.fsId ?? record.id),
    ownerId: str(record.ownerId) ?? str(data?.ownerId),
    shopName: str(record.shopName) ?? str(data?.shopName),
    category: str(record.category) ?? str(data?.category),
    county: str(record.county) ?? str(data?.county),
    cityTown: str(record.cityTown) ?? str(data?.cityTown),
    logoUrl: str(record.logoUrl) ?? str(data?.logoUrl),
    data: data ?? undefined,
  };
}

async function findByFsId(fsId: string): Promise<PbRecord | null> {
  const rows = await pbListRecords(SHOPS_COLLECTION, {
    filter: `fsId = '${esc(fsId)}'`,
    perPage: 1,
  });
  return rows[0] ?? null;
}

/**
 * Mirror one shop to the VPS store. `data` should be the FULL Firestore
 * document (Timestamps already converted to ISO strings). Never throws;
 * returns false when PocketBase is off or the write failed.
 */
export async function pbMirrorShop(
  fsId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    await ensureCollection(SHOPS_COLLECTION, SHOP_FIELDS);
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === null || ['string', 'number', 'boolean', 'object'].includes(typeof value)) {
        clean[key] = value;
      }
    }
    const columns = {
      ownerId: fsId,
      shopName: str(clean.shopName) ?? str(clean.name) ?? '',
      category: str(clean.category) ?? '',
      county: str(clean.county) ?? '',
      cityTown: str(clean.cityTown) ?? '',
      logoUrl: str(clean.logoUrl) ?? '',
    };
    const body = JSON.stringify({ fsId, ...columns, data: clean });
    const existing = await findByFsId(fsId);
    if (existing) {
      const res = await pbRequest(
        `/api/collections/${SHOPS_COLLECTION}/records/${existing.id}`,
        { method: 'PATCH', body },
      );
      return res.ok;
    }
    await pbCreateRecord(SHOPS_COLLECTION, { fsId, ...columns, data: clean });
    return true;
  } catch (error) {
    console.error('[pocketbase] shop mirror failed:', error);
    return false;
  }
}

/** One shop straight from the VPS store, or null (PocketBase off / missing / error). */
export async function pbGetShop(fsId: string): Promise<PbShop | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(SHOPS_COLLECTION, SHOP_FIELDS);
    const existing = await findByFsId(fsId);
    return existing ? toShop(existing) : null;
  } catch (error) {
    console.error('[pocketbase] shop read failed:', error);
    return null;
  }
}

/**
 * Every mirrored shop (newest writes first), or null when PocketBase is off /
 * the read failed — callers fall back to Firestore either way. Used by the
 * LIVE grid, which would otherwise fire one Firestore read per seller.
 */
export async function pbListShops(limit = 500): Promise<PbShop[] | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(SHOPS_COLLECTION, SHOP_FIELDS);
    const rows = await pbListRecords(SHOPS_COLLECTION, {
      perPage: Math.min(limit, 500),
    });
    return rows.map(toShop);
  } catch (error) {
    console.error('[pocketbase] shop list failed:', error);
    return null;
  }
}
