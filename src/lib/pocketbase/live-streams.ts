/**
 * Live selling on PocketBase — stream records, their chat and their reports,
 * mirrored to the VPS.
 *
 * Why this section: `liveStreams` is the only document a broadcast exists by.
 * Firestore already had its own outage during live selling once before, and a
 * dead stream document reads as "no one is live" to every visitor. The paid
 * session ledger (`live_sessions`) and the charge path already live on the
 * VPS; this mirrors the broadcast itself so the two halves of live selling
 * survive the same failure.
 *
 * Shape: PocketBase has no subcollections, so `liveStreams/{id}/messages` is
 * flattened into `live_chat_messages` with an explicit `streamId`, and reports
 * into `live_reports`. Firestore keeps owning the subcollection; these are
 * mirrors.
 *
 * Rules (identical to every other section): return false when unconfigured,
 * never throw — a failed mirror must never break a broadcast, a chat message
 * or a report.
 */

import {
  ensureCollection,
  pbCreateRecord,
  pbListRecords,
  pocketBaseEnabled,
  pbRequest,
  scrubForPocketBase,
  type PbField,
  type PbRecord,
} from './server';

export const LIVE_STREAMS_COLLECTION = 'live_streams';
export const LIVE_CHAT_COLLECTION = 'live_chat_messages';
export const LIVE_REPORTS_COLLECTION = 'live_reports';

const STREAM_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true }, // Firestore doc id — re-runnable mirror
  { name: 'sellerId', type: 'text' },
  { name: 'businessId', type: 'text' },
  { name: 'roomName', type: 'text' },
  { name: 'title', type: 'text' },
  { name: 'description', type: 'text' },
  { name: 'categoryId', type: 'text' },
  { name: 'category', type: 'text' },
  { name: 'location', type: 'text' },
  { name: 'latitude', type: 'number' },
  { name: 'longitude', type: 'number' },
  { name: 'thumbnailMediaId', type: 'text' },
  { name: 'visibility', type: 'text' },
  { name: 'status', type: 'text' },
  { name: 'attachedProductIds', type: 'json' },
  { name: 'attachedServiceIds', type: 'json' },
  { name: 'viewerCount', type: 'number' },
  { name: 'peakViewers', type: 'number' },
  { name: 'totalJoins', type: 'number' },
  { name: 'watchTimeSeconds', type: 'number' },
  { name: 'chatMessagesCount', type: 'number' },
  { name: 'ordersGenerated', type: 'number' },
  { name: 'bookingsGenerated', type: 'number' },
  { name: 'followersGained', type: 'number' },
  { name: 'reportsCount', type: 'number' },
  { name: 'startedAt', type: 'date' },
  { name: 'endedAt', type: 'date' },
  { name: 'durationSeconds', type: 'number' },
  { name: 'createdAt', type: 'date' },
  { name: 'updatedAt', type: 'date' },
];

const CHAT_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true }, // the message doc id inside liveStreams/{id}/messages
  { name: 'streamId', type: 'text' }, // the parent stream (the flattened subcollection key)
  { name: 'userId', type: 'text' },
  { name: 'userName', type: 'text' },
  { name: 'kind', type: 'text' }, // 'text' | 'reaction'
  { name: 'message', type: 'text' },
  { name: 'isSeller', type: 'bool' },
  { name: 'createdAt', type: 'date' },
];

const REPORT_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true }, // the moderation-queue doc id
  { name: 'streamId', type: 'text' },
  { name: 'streamTitle', type: 'text' },
  { name: 'sellerId', type: 'text' },
  { name: 'reporterId', type: 'text' },
  { name: 'reason', type: 'text' },
  { name: 'details', type: 'text' },
  { name: 'status', type: 'text' },
  { name: 'createdAt', type: 'date' },
];

const esc = (value: string) => value.replace(/'/g, "\\'");

async function findByFsId(collection: string, fsId: string): Promise<PbRecord | null> {
  const rows = await pbListRecords(collection, {
    filter: `fsId = '${esc(fsId)}'`,
    perPage: 1,
  });
  return rows[0] ?? null;
}

/** Create-or-merge one mirror row; Timestamps/Dates → ISO, sentinels dropped. */
async function upsert(
  collection: string,
  fields: PbField[],
  fsId: string,
  data: object,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    await ensureCollection(collection, fields);
    const clean = scrubForPocketBase(data) as Record<string, unknown>;
    const existing = await findByFsId(collection, fsId);
    const body = JSON.stringify({ fsId, ...clean });
    if (existing) {
      const res = await pbRequest(
        `/api/collections/${collection}/records/${existing.id}`,
        { method: 'PATCH', body },
      );
      return res.ok;
    }
    await pbCreateRecord(collection, { fsId, ...clean });
    return true;
  } catch (error) {
    console.error(`[pocketbase] ${collection} mirror failed:`, error);
    return false;
  }
}

/* --------------------------------------------------------------------------- */
/* Streams                                                                     */
/* --------------------------------------------------------------------------- */

/** Mirrors a stream document (create + every lifecycle transition). */
export async function pbMirrorLiveStream(fsId: string, data: object): Promise<boolean> {
  return upsert(LIVE_STREAMS_COLLECTION, STREAM_FIELDS, fsId, data);
}

/**
 * Merges a partial update (viewer join/leave, chat counter, report counter)
 * into the mirror, creating a stub keyed by `fsId` when no mirror row exists
 * yet — a counter written while PocketBase was briefly down must still land.
 */
export async function pbPatchLiveStream(fsId: string, patch: object): Promise<boolean> {
  return upsert(LIVE_STREAMS_COLLECTION, STREAM_FIELDS, fsId, patch);
}

/* --------------------------------------------------------------------------- */
/* Chat (flattened liveStreams/{id}/messages)                                  */
/* --------------------------------------------------------------------------- */

export async function pbMirrorLiveChatMessage(
  streamId: string,
  fsId: string,
  data: object,
): Promise<boolean> {
  return upsert(LIVE_CHAT_COLLECTION, CHAT_FIELDS, fsId, { streamId, ...data });
}

/* --------------------------------------------------------------------------- */
/* Reports                                                                     */
/* --------------------------------------------------------------------------- */

export async function pbMirrorLiveReport(fsId: string, data: object): Promise<boolean> {
  return upsert(LIVE_REPORTS_COLLECTION, REPORT_FIELDS, fsId, data);
}

/* --------------------------------------------------------------------------- */
/* Counters                                                                     */
/* --------------------------------------------------------------------------- */

/** The stream fields Firestore writes as `FieldValue.increment`. */
export type LiveStreamCounter =
  | 'viewerCount'
  | 'totalJoins'
  | 'chatMessagesCount'
  | 'reportsCount';

/**
 * Read-modify-write bump for a mirror counter, mirroring Firestore's
 * `FieldValue.increment(delta)`. Local to the VPS, and floored at zero so a
 * mirrored viewer count can never go negative from a double "leave".
 */
export async function pbBumpLiveStreamCounter(
  fsId: string,
  field: LiveStreamCounter,
  delta: number,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    await ensureCollection(LIVE_STREAMS_COLLECTION, STREAM_FIELDS);
    const existing = await findByFsId(LIVE_STREAMS_COLLECTION, fsId);
    const current =
      existing && typeof existing[field] === 'number' && Number.isFinite(existing[field])
        ? existing[field]
        : 0;
    const next = Math.max(0, current + delta);
    if (existing) {
      const res = await pbRequest(
        `/api/collections/${LIVE_STREAMS_COLLECTION}/records/${existing.id}`,
        { method: 'PATCH', body: JSON.stringify({ [field]: next }) },
      );
      return res.ok;
    }
    await pbCreateRecord(LIVE_STREAMS_COLLECTION, { fsId, [field]: next });
    return true;
  } catch (error) {
    console.error(`[pocketbase] live stream counter ${field} failed:`, error);
    return false;
  }
}
