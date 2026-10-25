/**
 * Live sessions on PocketBase — the "broadcast" section of the Firestore →
 * self-hosting migration.
 *
 * Why this exists: `POST /api/live-session` is the only way a seller starts a
 * broadcast, and it did ALL of its work in Firestore — read the profile, read
 * the points balance, charge 100 points, write `liveSessions/{sellerId}`. One
 * broken server credential meant "Connection problem", no broadcast, and a
 * buyer's `GET /api/live-session/token` could not mint a viewer token either.
 * The VPS keeps its own copy so going live depends on this machine, not on
 * Firestore being up.
 *
 * Shape (same rules as the products mirror):
 *  - `fsId` = the Firestore doc id (= sellerId, since the session document is
 *    keyed by seller), so the mirror is re-runnable and deletions can match.
 *  - indexed scalar columns for the filters server routes actually run
 *    (status, provider, room) + the FULL document in `data`, Timestamps
 *    converted to ISO strings.
 *  - every helper returns null/false when PocketBase is not configured and
 *    NEVER throws — a mirror failure must never fail a broadcast.
 *  - reads: this store FIRST, Firestore second (callers fall back on null).
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

// Re-exported so existing callers (the backfill script) keep working.
export { scrubForPocketBase } from './server';

export const LIVE_SESSIONS_COLLECTION = 'live_sessions';

export const LIVE_SESSION_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true }, // Firestore doc id (= sellerId)
  { name: 'sellerId', type: 'text' },
  { name: 'status', type: 'text' },
  { name: 'title', type: 'text' },
  { name: 'provider', type: 'text' },
  { name: 'livekitRoomName', type: 'text' },
  { name: 'viewerCount', type: 'number' },
  { name: 'startTime', type: 'date' },
  { name: 'createdAt', type: 'date' },
  // The WHOLE session document (chat state, pinned product, countdown…) so a
  // reader can answer from this store alone.
  { name: 'data', type: 'json' },
];

/** One session as server routes consume it: the Firestore doc id + fields. */
export interface PbLiveSession {
  /** Firestore doc id (= sellerId). */
  id: string;
  sellerId?: string;
  status?: string;
  title?: string;
  provider?: string;
  livekitRoomName?: string;
  viewerCount?: number;
  data: Record<string, unknown>;
}

const esc = (value: string) => value.replace(/'/g, "\\'");

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function toSession(record: PbRecord): PbLiveSession {
  const data = (record.data ?? null) as Record<string, unknown> | null;
  return {
    id: String(record.fsId ?? record.id),
    sellerId: str(record.sellerId) ?? str(data?.sellerId),
    status: str(record.status) ?? str(data?.status),
    title: str(record.title) ?? str(data?.title),
    provider: str(record.provider) ?? str(data?.provider),
    livekitRoomName: str(record.livekitRoomName) ?? str(data?.livekitRoomName),
    viewerCount: num(record.viewerCount) ?? num(data?.viewerCount),
    data: data ?? {},
  };
}

async function findByFsId(fsId: string): Promise<PbRecord | null> {
  const rows = await pbListRecords(LIVE_SESSIONS_COLLECTION, {
    filter: `fsId = '${esc(fsId)}'`,
    perPage: 1,
  });
  return rows[0] ?? null;
}

/**
 * Mirror one live session to the VPS store (create or overwrite). `data` is
 * the FULL Firestore document — Timestamps are converted on the way in.
 * Never throws; false = PB off or write failed, caller falls back to the
 * original Firestore behaviour.
 */
export async function pbMirrorLiveSession(
  fsId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    await ensureCollection(LIVE_SESSIONS_COLLECTION, LIVE_SESSION_FIELDS);
    const clean = scrubForPocketBase(data) as Record<string, unknown>;
    const body = JSON.stringify({
      fsId,
      sellerId: str(clean.sellerId) ?? fsId,
      status: str(clean.status) ?? '',
      title: str(clean.title) ?? '',
      provider: str(clean.provider) ?? '',
      livekitRoomName: str(clean.livekitRoomName) ?? '',
      viewerCount: num(clean.viewerCount) ?? 0,
      startTime: str(clean.startTime),
      data: clean,
    });
    const existing = await findByFsId(fsId);
    if (existing) {
      const res = await pbRequest(
        `/api/collections/${LIVE_SESSIONS_COLLECTION}/records/${existing.id}`,
        { method: 'PATCH', body },
      );
      return res.ok;
    }
    await pbCreateRecord(LIVE_SESSIONS_COLLECTION, JSON.parse(body));
    return true;
  } catch (error) {
    console.error('[pocketbase] live session mirror failed:', error);
    return false;
  }
}

/**
 * Apply an end-of-session patch (status: 'ended', endTime, cleared transport…)
 * exactly like the Firestore `update()` does: a MERGE over the mirrored
 * document, so title/startTime survive. Creates the row when the session was
 * never mirrored (backfill gap). Never throws; false = PB off or write failed.
 */
export async function pbEndLiveSession(
  fsId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    await ensureCollection(LIVE_SESSIONS_COLLECTION, LIVE_SESSION_FIELDS);
    const existing = await findByFsId(fsId);
    const clean = scrubForPocketBase(patch) as Record<string, unknown>;
    const merged = { ...(existing ? ((existing.data ?? {}) as Record<string, unknown>) : {}), ...clean };
    const columns = {
      status: str(merged.status) ?? 'ended',
      title: str(merged.title) ?? '',
      provider: str(merged.provider) ?? '',
      livekitRoomName: str(merged.livekitRoomName) ?? '',
      viewerCount: num(merged.viewerCount) ?? 0,
      sellerId: str(merged.sellerId) ?? fsId,
      data: merged,
    };
    if (existing) {
      const res = await pbRequest(
        `/api/collections/${LIVE_SESSIONS_COLLECTION}/records/${existing.id}`,
        { method: 'PATCH', body: JSON.stringify(columns) },
      );
      return res.ok;
    }
    await pbCreateRecord(LIVE_SESSIONS_COLLECTION, { fsId, ...columns });
    return true;
  } catch (error) {
    console.error('[pocketbase] live session end failed:', error);
    return false;
  }
}

/**
 * One session from the VPS store, or null (PB off / missing / error) —
 * callers fall back to Firestore on null either way.
 */
export async function pbGetLiveSession(fsId: string): Promise<PbLiveSession | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(LIVE_SESSIONS_COLLECTION, LIVE_SESSION_FIELDS);
    const existing = await findByFsId(fsId);
    return existing ? toSession(existing) : null;
  } catch (error) {
    console.error('[pocketbase] live session read failed:', error);
    return null;
  }
}

/**
 * Sessions filtered server routes ask for (`status = 'live'`), newest first.
 * Null when PocketBase is off or the read failed — callers fall back.
 */
export async function pbListLiveSessions(
  params: { status?: string; limit?: number } = {},
): Promise<PbLiveSession[] | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(LIVE_SESSIONS_COLLECTION, LIVE_SESSION_FIELDS);
    const filters: string[] = [];
    if (params.status) filters.push(`status = '${esc(params.status)}'`);
    const rows = await pbListRecords(LIVE_SESSIONS_COLLECTION, {
      filter: filters.join(' && ') || undefined,
      sort: '-startTime',
      perPage: Math.min(params.limit ?? 50, 500),
    });
    return rows.map(toSession).filter((s) => Object.keys(s.data).length > 0);
  } catch (error) {
    console.error('[pocketbase] live session list failed:', error);
    return null;
  }
}
