/**
 * Orders on PocketBase — the "commerce" section of the Firestore →
 * self-hosting migration.
 *
 * Why this exists: an order's whole lifecycle runs through server routes —
 * payment webhooks flip it to `processing`, sellers move it through
 * `shipped → delivery → delivered`, admins settle disputes and refunds. Every
 * one of those read and wrote Firestore only, so a Firestore outage did not
 * just hide orders, it HALTED commerce: nobody could ship anything. The VPS
 * keeps its own copy so the order lifecycle depends on this machine.
 *
 * Shape (same rules as the products / live-sessions mirrors):
 *  - `fsId` = the Firestore doc id, so the mirror is re-runnable and updates
 *    match the right row.
 *  - indexed scalar columns for the filters routes actually run (sellerId,
 *    buyerId, resellerId, orderStatus, totalAmount) + the FULL document in
 *    `data`, Timestamps converted to ISO strings.
 *  - every helper returns null/false when PocketBase is not configured and
 *    NEVER throws — a mirror failure must never fail a sale or a shipment.
 *  - reads: this store FIRST, Firestore second (callers fall back on null).
 *
 * The authoritative document still lives in Firestore (the client creates it
 * at checkout and mirrors it here — see /api/orders/sync); this store is what
 * server routes read first and write a copy of.
 */

import {
  ensureCollection,
  pbCreateRecord,
  pbDelete,
  pbListRecords,
  pocketBaseEnabled,
  pbRequest,
  scrubForPocketBase,
  type PbField,
  type PbRecord,
} from './server';

export const ORDERS_COLLECTION = 'orders';

export const ORDER_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true }, // Firestore doc id
  { name: 'sellerId', type: 'text' },
  { name: 'buyerId', type: 'text' },
  { name: 'resellerId', type: 'text' },
  { name: 'orderStatus', type: 'text' },
  { name: 'totalAmount', type: 'number' },
  { name: 'orderDate', type: 'date' },
  { name: 'createdAt', type: 'date' },
  // The WHOLE order (items, timeline, tracking, addresses…) so a reader can
  // answer from this store alone.
  { name: 'data', type: 'json' },
];

/** One order as server routes consume it: the Firestore doc id + fields. */
export interface PbOrder {
  /** Firestore doc id. */
  id: string;
  sellerId?: string;
  buyerId?: string;
  resellerId?: string;
  orderStatus?: string;
  totalAmount?: number;
  data: Record<string, unknown>;
}

const esc = (value: string) => value.replace(/'/g, "\\'");

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function iso(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

function toOrder(record: PbRecord): PbOrder {
  const data = (record.data ?? null) as Record<string, unknown> | null;
  return {
    id: String(record.fsId ?? record.id),
    sellerId: str(record.sellerId) ?? str(data?.sellerId),
    buyerId: str(record.buyerId) ?? str(data?.buyerId),
    resellerId: str(record.resellerId) ?? str(data?.resellerId),
    orderStatus: str(record.orderStatus) ?? str(data?.orderStatus),
    totalAmount: num(record.totalAmount) ?? num(data?.totalAmount),
    data: data ?? {},
  };
}

async function findByFsId(fsId: string): Promise<PbRecord | null> {
  const rows = await pbListRecords(ORDERS_COLLECTION, {
    filter: `fsId = '${esc(fsId)}'`,
    perPage: 1,
  });
  return rows[0] ?? null;
}

/**
 * Mirror one order to the VPS store (create or overwrite with the full
 * document). `data` is the Firestore doc — Timestamps converted on the way
 * in. Never throws; false = PB off or write failed.
 */
export async function pbMirrorOrder(
  fsId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    await ensureCollection(ORDERS_COLLECTION, ORDER_FIELDS);
    const clean = scrubForPocketBase(data) as Record<string, unknown>;
    const body = JSON.stringify({
      fsId,
      sellerId: str(clean.sellerId) ?? '',
      buyerId: str(clean.buyerId) ?? '',
      resellerId: str(clean.resellerId) ?? '',
      orderStatus: str(clean.orderStatus) ?? '',
      totalAmount: num(clean.totalAmount) ?? 0,
      orderDate: iso(clean.orderDate),
      createdAt: iso(clean.orderDate) ?? iso(clean.updatedAt),
      data: clean,
    });
    const existing = await findByFsId(fsId);
    if (existing) {
      const res = await pbRequest(
        `/api/collections/${ORDERS_COLLECTION}/records/${existing.id}`,
        { method: 'PATCH', body },
      );
      return res.ok;
    }
    await pbCreateRecord(ORDERS_COLLECTION, JSON.parse(body));
    return true;
  } catch (error) {
    console.error('[pocketbase] order mirror failed:', error);
    return false;
  }
}

/**
 * Apply a status-style patch (MERGE, exactly like the Firestore `update()`):
 * the patch lands on the mirrored `data` without disturbing items, timeline
 * history or addresses. Values must already be plain JSON — no FieldValue
 * sentinels; dates as ISO strings. Creates the row when the order was never
 * mirrored (backfill gap). Never throws; false = PB off or write failed.
 */
export async function pbPatchOrder(
  fsId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    await ensureCollection(ORDERS_COLLECTION, ORDER_FIELDS);
    const existing = await findByFsId(fsId);
    const clean = scrubForPocketBase(patch) as Record<string, unknown>;
    const merged = {
      ...(existing ? ((existing.data ?? {}) as Record<string, unknown>) : {}),
      ...clean,
    };
    const columns = {
      sellerId: str(merged.sellerId) ?? '',
      buyerId: str(merged.buyerId) ?? '',
      resellerId: str(merged.resellerId) ?? '',
      orderStatus: str(merged.orderStatus) ?? '',
      totalAmount: num(merged.totalAmount) ?? 0,
      data: merged,
    };
    if (existing) {
      const res = await pbRequest(
        `/api/collections/${ORDERS_COLLECTION}/records/${existing.id}`,
        { method: 'PATCH', body: JSON.stringify(columns) },
      );
      return res.ok;
    }
    await pbCreateRecord(ORDERS_COLLECTION, { fsId, ...columns });
    return true;
  } catch (error) {
    console.error('[pocketbase] order patch failed:', error);
    return false;
  }
}

/** Remove an order's VPS copy (the route deleted it in Firestore). Never throws. */
export async function pbDeleteOrder(fsId: string): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    const existing = await findByFsId(fsId);
    if (!existing) return true; // Nothing mirrored — nothing to remove.
    return await pbDelete(ORDERS_COLLECTION, existing.id);
  } catch (error) {
    console.error('[pocketbase] order delete failed:', error);
    return false;
  }
}

/** One order from the VPS store, or null (PB off / missing / error). */
export async function pbGetOrder(fsId: string): Promise<PbOrder | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(ORDERS_COLLECTION, ORDER_FIELDS);
    const existing = await findByFsId(fsId);
    return existing ? toOrder(existing) : null;
  } catch (error) {
    console.error('[pocketbase] order read failed:', error);
    return null;
  }
}

/**
 * One party's orders, newest first — the seller order screen's query. Null
 * when PocketBase is off or the read failed: callers fall back to Firestore.
 */
export async function pbListOrdersByParty(
  party: { sellerId?: string; buyerId?: string; resellerId?: string },
  limit = 300,
): Promise<PbOrder[] | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(ORDERS_COLLECTION, ORDER_FIELDS);
    const filters: string[] = [];
    if (party.sellerId) filters.push(`sellerId = '${esc(party.sellerId)}'`);
    if (party.buyerId) filters.push(`buyerId = '${esc(party.buyerId)}'`);
    if (party.resellerId) filters.push(`resellerId = '${esc(party.resellerId)}'`);
    if (filters.length === 0) return null; // Refuse unbounded reads by accident.
    const rows = await pbListRecords(ORDERS_COLLECTION, {
      filter: filters.join(' && '),
      sort: '-orderDate',
      perPage: Math.min(limit, 500),
    });
    return rows.map(toOrder).filter((o) => Object.keys(o.data).length > 0);
  } catch (error) {
    console.error('[pocketbase] order list failed:', error);
    return null;
  }
}

/** Every order (admin tier sweeps), newest first. Null when PB off/failed. */
export async function pbListAllOrders(limit = 1000): Promise<PbOrder[] | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(ORDERS_COLLECTION, ORDER_FIELDS);
    const out: PbOrder[] = [];
    for (let page = 1; out.length < Math.min(limit, 2000); page++) {
      const rows = await pbListRecords(ORDERS_COLLECTION, {
        sort: '-orderDate',
        perPage: 500,
        page,
      });
      out.push(...rows.map(toOrder).filter((o) => Object.keys(o.data).length > 0));
      if (rows.length < 500) break;
    }
    return out.slice(0, limit);
  } catch (error) {
    console.error('[pocketbase] order list-all failed:', error);
    return null;
  }
}
