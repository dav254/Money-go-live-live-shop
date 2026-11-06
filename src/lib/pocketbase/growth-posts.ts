/**
 * GROWTH POSTS on PocketBase — the PRIMARY store (VPS).
 *
 * The approval queue used to keep Firestore as the source of truth and copy
 * each document here as a best-effort mirror. That is inverted: this
 * collection is now authoritative and Firestore is the mirror
 * (`scripts/migrate-social-engine.ts` copies existing rows once).
 *
 * Contract:
 *   • `fsId` is the LOGICAL post id the app already uses for every action
 *     (`decide`, `edit`, `publish`, `schedule`). The PocketBase record id
 *     stays internal, so re-running the copy never changes a post id.
 *   • indexed scalar columns for the admin filters (status, productId,
 *     sellerId) plus the FULL document in `data`.
 *   • reads and writes THROW when PocketBase is configured but unreachable.
 *     A primary store that answered "not found" on an outage would silently
 *     empty the admin queue — callers map the throw to `store_unavailable`.
 *   • callers check `pocketBaseEnabled()` first and use Firestore only when
 *     PocketBase is not configured at all (development, tests, first boot).
 */

import {
  ensureCollection,
  pbCreateRecordKeyed,
  pbDelete,
  pbListRecords,
  pbListRecordsPage,
  pbRequest,
  pocketBaseEnabled,
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
const str = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Re-exported so callers need only one import for the enabled check. */
export { pocketBaseEnabled };

async function findByFsId(fsId: string): Promise<PbRecord | null> {
  await ensureCollection(GROWTH_POSTS_PB_COLLECTION, GROWTH_POST_FIELDS);
  const rows = await pbListRecords(GROWTH_POSTS_PB_COLLECTION, {
    filter: `fsId = '${esc(fsId)}'`,
    perPage: 1,
  });
  return rows[0] ?? null;
}

/** The mirrored document of one row (full record stored under `data`). */
function toDocument(fsId: string, record: PbRecord): Record<string, unknown> {
  const data = record.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return { ...(data as Record<string, unknown>), id: fsId };
  }
  return {
    id: fsId,
    status: record.status,
    productId: record.productId,
    sellerId: record.sellerId,
    updatedAt: record.updatedAt,
  };
}

/**
 * One post by its logical id, or null when it genuinely does not exist.
 * Throws when PocketBase is unreachable.
 */
export async function pbGetGrowthPost(id: string): Promise<Record<string, unknown> | null> {
  const existing = await findByFsId(id);
  return existing ? toDocument(id, existing) : null;
}

/**
 * Create-or-merge one post and return the merged document.
 * `patch` is merged over whatever is already stored, matching the
 * Firestore `{ merge: true }` semantics every caller relied on.
 */
export async function pbWriteGrowthPost(
  id: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const existing = await findByFsId(id);
  const prev =
    existing && existing.data && typeof existing.data === 'object' && !Array.isArray(existing.data)
      ? (existing.data as Record<string, unknown>)
      : {};
  const { id: _ignored, ...cleanPatch } = patch;
  const merged = scrubForPocketBase({ ...prev, ...cleanPatch, id }) as Record<string, unknown>;
  const payload = {
    fsId: id,
    status: str(merged.status),
    productId: str(merged.productId),
    sellerId: str(merged.sellerId),
    updatedAt: str(merged.updatedAt) || new Date().toISOString(),
    data: merged,
  };

  if (existing) {
    const res = await pbRequest(
      `/api/collections/${GROWTH_POSTS_PB_COLLECTION}/records/${existing.id}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
    );
    if (!res.ok) throw new Error(`PocketBase update "${GROWTH_POSTS_PB_COLLECTION}/${id}" failed (${res.status})`);
    return merged;
  }

  // `pbCreateRecordKeyed` re-reads and PATCHes if a concurrent write won the
  // unique-id race, so two writers can never leave two rows for one post.
  await pbCreateRecordKeyed(GROWTH_POSTS_PB_COLLECTION, id, payload);
  return merged;
}

/** Deletes one post by logical id. Used by tests/maintenance only. */
export async function pbDeleteGrowthPost(id: string): Promise<boolean> {
  const existing = await findByFsId(id);
  if (!existing) return false;
  return pbDelete(GROWTH_POSTS_PB_COLLECTION, existing.id);
}

/**
 * Newest-first queue read, optionally filtered by status. Throws when
 * PocketBase is unreachable.
 */
export async function pbListGrowthPosts(
  limit: number,
  status?: string,
): Promise<Array<Record<string, unknown>>> {
  await ensureCollection(GROWTH_POSTS_PB_COLLECTION, GROWTH_POST_FIELDS);
  const rows = await pbListRecords(GROWTH_POSTS_PB_COLLECTION, {
    sort: '-updatedAt',
    perPage: Math.max(1, Math.min(500, limit)),
    ...(status ? { filter: `status = '${esc(status)}'` } : {}),
  });
  return rows.map((row) => toDocument(String(row.fsId ?? row.id), row));
}

/**
 * Per-status counts for the queue header. Throws on PocketBase failure.
 *
 * Exact, not sampled: the previous version listed at most 500 rows and counted
 * them in memory, so every number in the admin header went wrong once a queue
 * grew past that. PocketBase returns an authoritative `totalItems` for a
 * filtered page, so one cheap request per known status gives the true count at
 * any size.
 */
export async function pbCountGrowthPosts(): Promise<Record<string, number>> {
  const statuses = ['draft', 'approved', 'rejected', 'copied', 'emailed', 'published', 'failed'];
  await ensureCollection(GROWTH_POSTS_PB_COLLECTION, GROWTH_POST_FIELDS);
  const counts: Record<string, number> = {};
  for (const status of statuses) {
    const page = await pbListRecordsPage(GROWTH_POSTS_PB_COLLECTION, {
      filter: `status = '${esc(status)}'`,
      perPage: 1,
    });
    counts[status] = page.totalItems;
  }
  return counts;
}
