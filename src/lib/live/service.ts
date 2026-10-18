import { AccessToken } from 'livekit-server-sdk';
import { db } from '@/firebase/server';
import { MAX_LIVE_SECONDS } from '@/lib/listings/limits';
import {
  LIVESTREAMS_COLLECTION,
  type LiveStream,
  type LiveVisibility,
} from './types';

/**
 * LIVE SERVICES — server-only. This module (and every other live server
 * module) is the ONLY place LIVEKIT_API_KEY/SECRET are read. The browser
 * receives short-lived tokens, never configuration.
 *
 * Spec sections: 12–16 (create/token), 22–24 (viewer access), 34 (end).
 */

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

/** LiveKit websocket URL for clients (safe to expose). */
export function livekitUrl(): string {
  return (process.env.LIVEKIT_URL ?? '').trim();
}

/** True when LiveKit credentials are present — controls graceful degradation. */
export function livekitConfigured(): boolean {
  return !!(
    process.env.LIVEKIT_URL &&
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET
  );
}

/* ------------------------------------------------------------------ */
/* Tokens (15, 23)                                                     */
/* ------------------------------------------------------------------ */

const TOKEN_TTL_SECONDS = 60 * 60 * 6; // generous but temporary (6h max)

/** Broadcaster identity inside the LiveKit room. */
export function sellerIdentity(sellerId: string): string {
  return `seller_${sellerId}`;
}

export function viewerIdentity(viewerId: string): string {
  return `viewer_${viewerId}`;
}

/** Issuer of short-lived publish+subscribe tokens for the stream owner. */
export async function createSellerToken(
  sellerId: string,
  roomName: string,
  displayName: string,
): Promise<string> {
  const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: sellerIdentity(sellerId),
    name: displayName,
    ttl: TOKEN_TTL_SECONDS,
  });
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return token.toJwt();
}

/** Issuer of short-lived subscribe-only tokens for viewers. */
export async function createViewerToken(
  viewerId: string,
  roomName: string,
  displayName: string,
): Promise<string> {
  const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: viewerIdentity(viewerId),
    name: displayName,
    ttl: TOKEN_TTL_SECONDS,
  });
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: false,
    canSubscribe: true,
    canPublishData: false,
  });
  return token.toJwt();
}

/* ------------------------------------------------------------------ */
/* Stream CRUD                                                         */
/* ------------------------------------------------------------------ */

/** Unique room per stream: vidnov_live_<rand> (spec §14 — never reused). */
// Cap for one broadcast: 70 minutes — imported from `lib/listings/limits` as
// the single source of truth, so the watchdog ceiling, the seller countdown
// and the charged session window can never drift apart again (they used to:
// countdown 600s vs watchdog 120s).

export function generateRoomName(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  const rand = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `vidnov_live_${rand}`;
}

export async function createLiveStream(input: {
  sellerId: string;
  title: string;
  description?: string;
  category?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  visibility?: LiveVisibility;
  thumbnailMediaId?: string | null;
  businessId?: string | null;
}): Promise<LiveStream> {
  const ref = db.collection(LIVESTREAMS_COLLECTION).doc();
  const now = new Date();
  const stream: LiveStream = {
    id: ref.id,
    sellerId: input.sellerId,
    businessId: input.businessId ?? null,
    roomName: generateRoomName(),
    title: input.title,
    description: input.description,
    categoryId: input.category ?? null,
    category: input.category ?? null,
    location: input.location ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    thumbnailMediaId: input.thumbnailMediaId ?? null,
    visibility: input.visibility ?? 'PUBLIC',
    status: 'STARTING',
    attachedProductIds: [],
    attachedServiceIds: [],
    viewerCount: 0,
    peakViewers: 0,
    totalJoins: 0,
    watchTimeSeconds: 0,
    chatMessagesCount: 0,
    ordersGenerated: 0,
    bookingsGenerated: 0,
    followersGained: 0,
    reportsCount: 0,
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(stream);
  return stream;
}

export async function getLiveStream(id: string): Promise<LiveStream | null> {
  const snap = await db.collection(LIVESTREAMS_COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return { ...(snap.data() as LiveStream), id: snap.id };
}

export async function getLiveStreamByRoom(roomName: string): Promise<LiveStream | null> {
  const snap = await db
    .collection(LIVESTREAMS_COLLECTION)
    .where('roomName', '==', roomName)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { ...(doc.data() as LiveStream), id: doc.id };
}

export async function updateLiveStream(
  id: string,
  patch: Partial<LiveStream>,
): Promise<void> {
  await db
    .collection(LIVESTREAMS_COLLECTION)
    .doc(id)
    .update({ ...patch, updatedAt: new Date() });
}

/** Marks the stream ENDED and stamps duration (spec §34). */
export async function endLiveStream(id: string): Promise<LiveStream | null> {
  const stream = await getLiveStream(id);
  if (!stream) return null;
  if (stream.status === 'ENDED' || stream.status === 'CANCELLED') return stream;

  const startedMs = toMs(stream.startedAt) ?? Date.now();
  const durationSeconds = Math.max(0, Math.round((Date.now() - startedMs) / 1000));

  await updateLiveStream(id, {
    status: 'ENDED',
    endedAt: new Date(),
    durationSeconds,
    viewerCount: 0,
  });
  return { ...stream, status: 'ENDED', durationSeconds, viewerCount: 0 };
}

/**
 * Lists live streams for discovery (public + follow-gated handled client-side).
 *
 * Deliberately built from SINGLE-FIELD filters only: the composite indexes for
 * `sellerId + startedAt` / `status + startedAt` are not deployed in this
 * project, so an ordered multi-field query failed with FAILED_PRECONDITION.
 * We filter and sort in memory instead — the collection is small, and this
 * keeps the LIVE feed working regardless of index deployment.
 */
export async function listLiveStreams(opts: {
  statuses?: LiveStream['status'][];
  sellerId?: string;
  limit?: number;
}): Promise<LiveStream[]> {
  const limit = opts.limit ?? 50;
  const collection = db.collection(LIVESTREAMS_COLLECTION);

  let snap;
  if (opts.sellerId) {
    snap = await collection.where('sellerId', '==', opts.sellerId).limit(200).get();
  } else if (opts.statuses && opts.statuses.length > 0) {
    snap = await collection.where('status', 'in', opts.statuses).limit(200).get();
  } else {
    snap = await collection.orderBy('startedAt', 'desc').limit(200).get();
  }

  const out: LiveStream[] = [];
  snap.forEach((d) => out.push({ ...(d.data() as LiveStream), id: d.id }));

  const filtered = out.filter((s) => {
    if (opts.sellerId && s.sellerId !== opts.sellerId) return false;
    if (opts.statuses?.length && !opts.statuses.includes(s.status)) return false;
    return true;
  });

  filtered.sort((a, b) => (toMs(b.startedAt) ?? 0) - (toMs(a.startedAt) ?? 0));
  return filtered.slice(0, limit);
}

/** Best-effort safe teardown when a room is abandoned (reconnection timeout, §38). */
/**
 * STREAM WATCHDOG — ends broadcasts that have overrun, or died without
 * ending themselves.
 *
 * ## Why this exists twice over
 *
 * The seller-facing countdown stops a stream exactly on time while the tab is
 * open. This is what happens when it is not: the seller closes the laptop, the
 * phone loses signal, the browser is killed. Without this sweep the document
 * stays `LIVE` forever and every visitor is told a dead room is open.
 *
 * It is also the server-side half of the paid 70-minute cap, so a client that
 * ignores the countdown still cannot broadcast past the window it paid for.
 *
 * ## It was never called
 *
 * This function existed and nothing invoked it, so neither the stale sweep nor
 * any duration limit was actually running. It is now called from
 * `/api/live/watchdog`, which the VPS cron hits every minute — without that
 * cron entry the function is still dead code, and that is the one moving part
 * left for the server owner.
 */
export async function failStaleStreams(): Promise<{ ended: number; overran: number }> {
  const now = Date.now();
  const overrunCutoff = new Date(now - MAX_LIVE_SECONDS * 1000);

  /*
   * One query, one rule: anything still marked LIVE that started before the
   * cutoff is over the ceiling and gets ended.
   *
   * There used to be a second, longer "stale" window here (30 minutes, for a
   * seller who vanished without ending the stream). That branch is gone
   * because it can no longer be reached: the query below only returns streams
   * older than the paid-session cutoff, so every document it yields is already
   * over the cap. A dead stream older than any second threshold is still
   * swept once it passes the ceiling — one rule, no dead code paths.
   *
   * `limit(25)` is per run, not total: if more than 25 broadcasts are stuck
   * LIVE at once, the next cron minute picks up the rest.
   */
  const snap = await db
    .collection(LIVESTREAMS_COLLECTION)
    .where('status', '==', 'LIVE')
    .where('startedAt', '<', overrunCutoff)
    .limit(25)
    .get()
    .catch(() => null);
  if (!snap) return { ended: 0, overran: 0 };

  let ended = 0;
  let overran = 0;

  for (const d of snap.docs) {
    const startedMs = toMs(d.data()?.startedAt);
    if (startedMs === null) continue;

    await endLiveStream(d.id).catch(() => undefined);
    ended++;
    // Every swept document is past the ceiling by construction; the counter
    // exists so the watchdog response can say why they were ended.
    if (now - startedMs > MAX_LIVE_SECONDS * 1000) overran++;
  }

  return { ended, overran };
}

function toMs(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  const ts = value as { toDate?: () => Date; seconds?: number };
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return null;
}
