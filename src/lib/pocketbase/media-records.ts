/**
 * Media records on PocketBase — the "uploads" section of the Firestore →
 * self-hosting migration.
 *
 * The BYTES were already VPS-native: every seller upload lands on the local
 * disk (`/var/lib/vidnov/media`) through the storage adapter and is served
 * by /api/media/file and /api/media/serve. What lived only in Firestore was
 * the INDEX — which file belongs to which seller, its status, its paths.
 * That index is now mirrored here, on the same machine as the files, so a
 * Firestore outage can no longer make a seller's uploads invisible.
 *
 * Same migration rules as the other sections: helpers return null/false when
 * PocketBase is not configured and never throw — callers keep their existing
 * Firestore behaviour, and a mirror failure must never fail an upload.
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

export const MEDIA_FILES_COLLECTION = 'media_files';

const MEDIA_FILE_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true }, // Firestore doc id — makes the mirror re-runnable
  { name: 'userId', type: 'text' },
  { name: 'postId', type: 'text' },
  { name: 'requestId', type: 'text' },
  { name: 'offerId', type: 'text' },
  { name: 'isPrivate', type: 'bool' },
  { name: 'storageState', type: 'text' },
  { name: 'type', type: 'text' },
  { name: 'originalName', type: 'text' },
  { name: 'storedName', type: 'text' },
  { name: 'mimeType', type: 'text' },
  { name: 'sizeBytes', type: 'number' },
  { name: 'storagePath', type: 'text' },
  { name: 'thumbnailPath', type: 'text' },
  { name: 'status', type: 'text' },
  { name: 'width', type: 'number' },
  { name: 'height', type: 'number' },
  { name: 'durationSeconds', type: 'number' },
  { name: 'createdAt', type: 'date' },
  { name: 'processedAt', type: 'date' },
];

/** The subset of the media record this mirror keeps. */
export interface PbMediaRecord {
  id: string;
  userId?: string;
  postId?: string | null;
  requestId?: string | null;
  offerId?: string | null;
  isPrivate?: boolean;
  storageState?: string;
  type?: string;
  originalName?: string;
  storedName?: string;
  mimeType?: string;
  sizeBytes?: number;
  storagePath?: string;
  thumbnailPath?: string;
  status?: string;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  createdAt?: string | null;
  processedAt?: string | null;
}

/** Only scalars cross the wire — FieldValue/Timestamp objects are dropped. */
function scrub(data: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const clean: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === null) {
      clean[key] = null;
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      clean[key] = value;
    }
    // Anything else (FieldValue, Timestamp, objects) is intentionally skipped.
  }
  return clean;
}

const esc = (value: string) => value.replace(/'/g, "\\'");

function toRecord(record: PbRecord): PbMediaRecord {
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
  return {
    id: String(record.fsId ?? record.id),
    userId: str(record.userId),
    postId: str(record.postId),
    requestId: str(record.requestId),
    offerId: str(record.offerId),
    isPrivate: Boolean(record.isPrivate),
    storageState: str(record.storageState),
    type: str(record.type),
    originalName: str(record.originalName),
    storedName: str(record.storedName),
    mimeType: str(record.mimeType),
    sizeBytes: num(record.sizeBytes) ?? 0,
    storagePath: str(record.storagePath) ?? '',
    thumbnailPath: str(record.thumbnailPath) ?? '',
    status: str(record.status),
    width: num(record.width),
    height: num(record.height),
    durationSeconds: num(record.durationSeconds),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : null,
    processedAt: typeof record.processedAt === 'string' ? record.processedAt : null,
  };
}

async function findByFsId(fsId: string): Promise<PbRecord | null> {
  const rows = await pbListRecords(MEDIA_FILES_COLLECTION, {
    filter: `fsId = '${esc(fsId)}'`,
    perPage: 1,
  });
  return rows[0] ?? null;
}

/**
 * Creates (or replaces) the VPS-side record for a media item. Never throws;
 * returns false when PB is off or the write failed.
 */
export async function pbMirrorMediaRecord(
  fsId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    await ensureCollection(MEDIA_FILES_COLLECTION, MEDIA_FILE_FIELDS);
    const clean = scrub(data);
    const existing = await findByFsId(fsId);
    const body = JSON.stringify({ fsId, ...clean });
    if (existing) {
      const res = await pbRequest(
        `/api/collections/${MEDIA_FILES_COLLECTION}/records/${existing.id}`,
        { method: 'PATCH', body },
      );
      return res.ok;
    }
    await pbCreateRecord(MEDIA_FILES_COLLECTION, { fsId, ...clean });
    return true;
  } catch (error) {
    console.error('[pocketbase] media mirror failed:', error);
    return false;
  }
}

/**
 * Patches the VPS-side record (READY transition, FAILED, DELETED). Only
 * touches an existing mirror row — never creates one. Never throws.
 */
export async function pbPatchMediaRecord(
  fsId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    const existing = await findByFsId(fsId);
    if (!existing) return false;
    const res = await pbRequest(
      `/api/collections/${MEDIA_FILES_COLLECTION}/records/${existing.id}`,
      { method: 'PATCH', body: JSON.stringify(scrub(patch)) },
    );
    return res.ok;
  } catch (error) {
    console.error('[pocketbase] media patch failed:', error);
    return false;
  }
}

/** The VPS-side record for a media id, or null (PB off / missing / error). */
export async function pbGetMediaRecord(fsId: string): Promise<PbMediaRecord | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(MEDIA_FILES_COLLECTION, MEDIA_FILE_FIELDS);
    const existing = await findByFsId(fsId);
    return existing ? toRecord(existing) : null;
  } catch (error) {
    console.error('[pocketbase] media read failed:', error);
    return null;
  }
}

/** One owner's records, newest first. Null when PB is off/failed. */
export async function pbListMediaByUser(
  userId: string,
  limit = 200,
): Promise<PbMediaRecord[] | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(MEDIA_FILES_COLLECTION, MEDIA_FILE_FIELDS);
    const items = await pbListRecords(MEDIA_FILES_COLLECTION, {
      filter: `userId = '${esc(userId)}'`,
      sort: '-createdAt',
      perPage: limit,
    });
    return items.map(toRecord);
  } catch (error) {
    console.error('[pocketbase] media list failed:', error);
    return null;
  }
}
