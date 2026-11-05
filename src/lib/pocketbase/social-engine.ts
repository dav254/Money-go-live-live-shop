/**
 * SOCIAL ENGINE on PocketBase — the PRIMARY store (VPS).
 *
 * ## What moved
 * `social_engine_connections`, `social_engine_tests`, `social_engine_meta` and
 * `social_engine_audit` used to live in Firestore only. They now live in
 * PocketBase on the VPS; Firestore is a best-effort mirror kept for
 * redundancy and for the one-time copy in `scripts/migrate-social-engine.ts`.
 *
 * ## Contract
 *   • Every record carries `fsId` — the logical document id the engine already
 *     uses (`{module}__{ownerId}`, `{module}__platform`, `…__rate`, or an
 *     audit uuid). The PB record id stays internal, so ids never change when a
 *     row is re-copied.
 *   • The full document lives in the `data` JSON field; `module`, `status`
 *     and `updatedAt` are indexed columns for admin queries.
 *   • Readers/writers THROW when PocketBase is configured but unreachable —
 *     a primary store that silently answers "not found" would be a lie. Use
 *     `socialEnginePbEnabled()` to choose the Firestore fallback explicitly
 *     (development, or a workspace with no PocketBase configured).
 *   • Nothing here logs a token: connection `data` holds the AES-256-GCM
 *     sealed payload exactly as `crypto.ts` produced it.
 */
import {
  ensureCollection,
  pbListRecords,
  pbRequest,
  pocketBaseEnabled,
  scrubForPocketBase,
  type PbField,
  type PbRecord,
} from './server';

export const SOCIAL_ENGINE_PB_COLLECTIONS = {
  connections: 'social_engine_connections',
  tests: 'social_engine_tests',
  meta: 'social_engine_meta',
  audit: 'social_engine_audit',
} as const;

export type SocialEnginePbCollection =
  (typeof SOCIAL_ENGINE_PB_COLLECTIONS)[keyof typeof SOCIAL_ENGINE_PB_COLLECTIONS];

const FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true },
  { name: 'module', type: 'text' },
  { name: 'status', type: 'text' },
  { name: 'updatedAt', type: 'date' },
  { name: 'data', type: 'json' },
];

/** True when the VPS store should be treated as the source of truth. */
export function socialEnginePbEnabled(): boolean {
  return pocketBaseEnabled();
}

const esc = (value: string) => value.replace(/'/g, "\\'");
const str = (value: unknown): string => (typeof value === 'string' ? value : '');

async function findByFsId(collection: SocialEnginePbCollection, fsId: string): Promise<PbRecord | null> {
  await ensureCollection(collection, FIELDS);
  const rows = await pbListRecords(collection, {
    filter: `fsId = '${esc(fsId)}'`,
    perPage: 1,
  });
  return rows[0] ?? null;
}

function toDocument(fsId: string, record: PbRecord): Record<string, unknown> {
  const data = record.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return { ...(data as Record<string, unknown>), id: fsId };
  }
  return { id: fsId };
}

/**
 * One logical document, or null when the row genuinely does not exist.
 * Throws when PocketBase is configured but the request fails.
 */
export async function pbSocialGet(
  collection: SocialEnginePbCollection,
  fsId: string,
): Promise<Record<string, unknown> | null> {
  const existing = await findByFsId(collection, fsId);
  return existing ? toDocument(fsId, existing) : null;
}

/**
 * Create-or-merge one document. Returns the merged document.
 * Throws on failure — callers map that to their own honest error.
 */
export async function pbSocialWrite(
  collection: SocialEnginePbCollection,
  fsId: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const existing = await findByFsId(collection, fsId);
  const prev =
    existing && existing.data && typeof existing.data === 'object' && !Array.isArray(existing.data)
      ? (existing.data as Record<string, unknown>)
      : {};
  const merged = scrubForPocketBase({ ...prev, ...patch, id: fsId }) as Record<string, unknown>;
  const body = JSON.stringify({
    fsId,
    module: str(merged.module),
    status: str(merged.status),
    updatedAt: str(merged.updatedAt) || new Date().toISOString(),
    data: merged,
  });
  if (existing) {
    const res = await pbRequest(
      `/api/collections/${encodeURIComponent(collection)}/records/${existing.id}`,
      { method: 'PATCH', body },
    );
    if (!res.ok) throw new Error(`PocketBase update "${collection}/${fsId}" failed (${res.status})`);
    return merged;
  }
  const res = await pbRequest(`/api/collections/${encodeURIComponent(collection)}/records`, {
    method: 'POST',
    body,
  });
  if (!res.ok) throw new Error(`PocketBase create "${collection}/${fsId}" failed (${res.status})`);
  return merged;
}

/**
 * Append-only write (audit trail): always a fresh row, never a merge, so an
 * entry can never be rewritten by a later action.
 */
export async function pbSocialAppend(
  collection: SocialEnginePbCollection,
  fsId: string,
  doc: Record<string, unknown>,
): Promise<void> {
  await ensureCollection(collection, FIELDS);
  const clean = scrubForPocketBase({ ...doc, id: fsId }) as Record<string, unknown>;
  const res = await pbRequest(`/api/collections/${encodeURIComponent(collection)}/records`, {
    method: 'POST',
    body: JSON.stringify({
      fsId,
      module: str(clean.module),
      status: str(clean.outcome),
      updatedAt: str(clean.at) || new Date().toISOString(),
      data: clean,
    }),
  });
  if (!res.ok) throw new Error(`PocketBase append "${collection}" failed (${res.status})`);
}
