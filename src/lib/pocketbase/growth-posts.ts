/**
 * Growth posts on PocketBase — the VPS copy of the approval queue.
 *
 * Follows the distribution-jobs mirror contract exactly:
 *   • `fsId` = the Firestore doc id, so the mirror is re-runnable and every
 *     update lands on the right row.
 *   • indexed scalar columns for the filters the admin queue runs (status,
 *     productId, sellerId) plus the FULL document in `data`.
 *   • every helper returns null/false when PocketBase is not configured and
 *     NEVER throws — a mirror failure must never fail a draft run or an
 *     approval action.
 *   • reads: Firestore first (source of truth); these helpers only answer
 *     when Firestore cannot, so a blocked project still shows the queue.
 */

import {
  ensureCollection,
  pbListRecords,
  pocketBaseEnabled,
  pbRequest,
  scrubForPocketBase,
  type PbField,
  type PbRecord,
} from './server';

export const GROWTH_POSTS_PB_COLLECTION = 'growth_posts';

export const GROWTH_POST_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true },
  { name: 'status', type: 'text' },
  { name: 'productId', type: 'text' },
  { name: 'sellerId', type: 'text' },
  { name: 'updatedAt', type: 'date' },
  { name: 'data', type: 'json' },
];

const esc = (value: string) => value.replace(/'/g, "\\'");

async function findByFsId(fsId: string): Promise<PbRecord | null> {
  const rows = await pbListRecords(GROWTH_POSTS_PB_COLLECTION, {
    filter: `fsId = '${esc(fsId)}'`,
    perPage: 1,
  });
  return rows[0] ?? null;
}

/**
 * Create-or-merge one growth post. Never throws; false = PB off or write
 * failed — the Firestore write is unaffected either way.
 */
export async function pbMirrorGrowthPost(
  fsId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    await ensureCollection(GROWTH_POSTS_PB_COLLECTION, GROWTH_POST_FIELDS);
    const clean = (scrubForPocketBase(data) ?? {}) as Record<string, unknown>;
    const body = JSON.stringify({
      fsId,
      status: typeof clean.status === 'string' ? clean.status : '',
      productId: typeof clean.productId === 'string' ? clean.productId : '',
      sellerId: typeof clean.sellerId === 'string' ? clean.sellerId : '',
      updatedAt:
        typeof clean.updatedAt === 'string' && clean.updatedAt
          ? clean.updatedAt
          : new Date().toISOString(),
      data: clean,
    });
    const existing = await findByFsId(fsId);
    if (existing) {
      const res = await pbRequest(
        `/api/collections/${GROWTH_POSTS_PB_COLLECTION}/records/${existing.id}`,
        { method: 'PATCH', body },
      );
      return res.ok;
    }
    const res = await pbRequest(`/api/collections/${GROWTH_POSTS_PB_COLLECTION}/records`, {
      method: 'POST',
      body,
    });
    return res.ok;
  } catch {
    // A mirror failure must never fail the caller's action.
    return false;
  }
}

/** The mirrored document of one row (full record stored under `data`). */
function toDocument(record: PbRecord): Record<string, unknown> {
  const data = record.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return { id: String(record.fsId ?? record.id), ...(data as Record<string, unknown>) };
  }
  return {
    id: String(record.fsId ?? record.id),
    status: record.status,
    productId: record.productId,
    sellerId: record.sellerId,
    updatedAt: record.updatedAt,
  };
}

/**
 * VPS-side list used ONLY when Firestore cannot answer. Newest first, capped.
 */
export async function pbListGrowthPosts(limit: number): Promise<Array<Record<string, unknown>>> {
  if (!pocketBaseEnabled()) return [];
  try {
    const rows = await pbListRecords(GROWTH_POSTS_PB_COLLECTION, {
      sort: '-updatedAt',
      perPage: Math.max(1, Math.min(100, limit)),
    });
    return rows.map(toDocument);
  } catch {
    return [];
  }
}

/** VPS-side per-status counts when Firestore cannot answer. */
export async function pbCountGrowthPosts(): Promise<Record<string, number> | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    const rows = await pbListRecords(GROWTH_POSTS_PB_COLLECTION, { perPage: 100 });
    const counts: Record<string, number> = {};
    for (const row of rows) {
      const status = typeof row.status === 'string' && row.status ? row.status : 'draft';
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  } catch {
    return null;
  }
}
