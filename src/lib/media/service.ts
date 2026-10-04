import * as path from 'path';
import * as fsp from 'fs/promises';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import {
  MEDIA_CONFIG,
  MEDIA_COLLECTION,
  MEDIA_ROOT,
  MEDIA_TMP_ROOT,
  REQUESTS_COLLECTION,
  OFFERS_COLLECTION,
  dateFolder,
  requestFolder,
  offerFolder,
  type StorageState,
} from './config';
import { getStorageAdapter } from './storage-adapter';
import { MarketplaceRequest, MarketplaceOffer } from '@/lib/requests/types';
import type { SellerShop } from '@/lib/types';
import {
  ensureMediaDirs,
  getStorageStats,
  canAcceptUpload,
  deleteStoredFiles,
} from './storage';
import {
  processImage,
  validateImageContent,
  validateImageMime,
  type ProcessedImage,
} from './image';
import {
  processVideo,
  validateVideoFile,
  type ProcessedVideo,
} from './video';

/**
 * Media service: ties the storage + processing pipelines to Firestore
 * records and a lightweight background queue. Every stored file has a
 * DB record; the cleanup sweeper only deletes files without one.
 */

export type MediaStatus = 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED' | 'DELETED';

export interface MediaRecord {
  id: string;
  userId: string;
  postId?: string | null;
  /** Request marketplace ownership (spec §29) — reusable across sections. */
  requestId?: string | null;
  offerId?: string | null;
  /** Private media is served only through authorization-checked delivery. */
  isPrivate?: boolean;
  storageState?: StorageState;
  type: 'image' | 'video';
  originalName?: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailSizeBytes?: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  storagePath: string;
  thumbnailPath: string;
  status: MediaStatus;
  error?: string | null;
  createdAt?: unknown;
  processedAt?: unknown;
}

export interface ProcessOutcome {
  id: string;
  status: 'READY' | 'FAILED';
  url?: string;        // public URL of the optimized media
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  sizeBytes?: number;
  error?: string;
}

/* ------------------------------------------------------------------ */
/* Background queue (lightweight — one worker, sequential processing)  */
/* ------------------------------------------------------------------ */

interface QueueJob {
  mediaId: string;
  tmpPath: string;
  type: 'image' | 'video';
  declaredMime: string;
  userId: string;
  originalName: string;
  /** Permanent destination folder (relative to MEDIA_ROOT). */
  destDir?: string;
  isPrivate?: boolean;
}

const queue: QueueJob[] = [];
let draining = false;
const statusWatchers = new Map<string, (o: ProcessOutcome) => void>();

export function onMediaComplete(mediaId: string, fn: (o: ProcessOutcome) => void): () => void {
  statusWatchers.set(mediaId, fn);
  return () => statusWatchers.delete(mediaId);
}

async function enqueueAndProcess(job: QueueJob): Promise<void> {
  queue.push(job);
  if (!draining) {
    draining = true;
    // Fire-and-forget drain — the API responds immediately.
    void drainQueue();
  }
}

async function drainQueue(): Promise<void> {
  try {
    while (queue.length > 0) {
      const job = queue.shift()!;
      await processJob(job);
    }
  } finally {
    draining = false;
  }
}

async function processJob(job: QueueJob): Promise<void> {
  const ref = db.collection(MEDIA_COLLECTION).doc(job.mediaId);
  const finalize = (outcome: ProcessOutcome) => {
    const watcher = statusWatchers.get(job.mediaId);
    if (watcher) {
      watcher(outcome);
      statusWatchers.delete(job.mediaId);
    }
  };

  try {
    await ref.update({ status: 'PROCESSING' as MediaStatus });

    let result: ProcessedImage | ProcessedVideo;
    if (job.type === 'image') {
      result = await processImage(job.tmpPath, job.originalName, { destDir: job.destDir });
    } else {
      result = await processVideo(job.tmpPath, { destDir: job.destDir });
    }

    await ref.update({
      status: 'READY' as MediaStatus,
      storagePath: result.storagePath,
      thumbnailPath: result.thumbnailPath,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
      thumbnailSizeBytes: result.thumbnailSizeBytes,
      width: result.width,
      height: result.height,
      durationSeconds: 'durationSeconds' in result ? result.durationSeconds : null,
      // Private request/offer media is SYNCED (spec §33); public media can be
      // promoted to PUBLISHED by marketplace flows when needed.
      storageState: (job.isPrivate ? 'SYNCED' : 'PUBLISHED') as StorageState,
      processedAt: FieldValue.serverTimestamp(),
      error: null,
    });

    // Original temp file: deleted immediately after successful processing.
    await fsp.rm(job.tmpPath, { force: true });

    finalize({
      id: job.mediaId,
      status: 'READY',
      url: mediaUrl(result.storagePath),
      thumbnailUrl: mediaUrl(result.thumbnailPath),
      width: result.width,
      height: result.height,
      durationSeconds: 'durationSeconds' in result ? result.durationSeconds : undefined,
      sizeBytes: result.sizeBytes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed';
    await ref
      .update({ status: 'FAILED' as MediaStatus, error: message })
      .catch(() => undefined);
    // Keep the failed temp file for debugging only — the daily cleanup
    // removes it after the retention window.
    finalize({ id: job.mediaId, status: 'FAILED', error: message });
  }
}

/* ------------------------------------------------------------------ */
/* Daily maintenance (opportunistic — no boot hook needed)             */
/* ------------------------------------------------------------------ */

let lastDailyCleanupAt = 0;
let dailyCleanupRunning = false;

/**
 * Runs the cleanup sweep at most once per day. Called opportunistically
 * from upload intake (fire-and-forget) so no separate scheduler or cron
 * is required — though a cron can also hit /api/media/cleanup-cron.
 */
export function maybeRunDailyCleanup(): void {
  const DAY_MS = 24 * 3600_000;
  if (dailyCleanupRunning || Date.now() - lastDailyCleanupAt < DAY_MS) return;
  dailyCleanupRunning = true;
  lastDailyCleanupAt = Date.now();
  void runCleanup()
    .then((report) => {
      if (report.removedTemp || report.removedOrphans) {
        console.log(
          `[media-cleanup:daily] removed ${report.removedTemp} temp, ${report.removedOrphans} orphaned, reclaimed ~${Math.round(report.reclaimedBytes / 1024 / 1024)}MB`,
        );
      }
    })
    .catch(() => undefined)
    .finally(() => {
      dailyCleanupRunning = false;
    });
}

/* ------------------------------------------------------------------ */
/* Intake                                                              */
/* ------------------------------------------------------------------ */

export interface IntakeInput {
  file: File;
  userId: string;
  postId?: string;
  /** Attach to a customer request — routes to requests/request_<id>/. */
  requestId?: string;
  /** Attach to a seller offer — routes to requests/offer_<id>/. */
  offerId?: string;
  /** Private media requires authorization to view (default true for
   *  request/offer attachments, false for public feeds). */
  isPrivate?: boolean;
}

export interface IntakeResult {
  accepted: boolean;
  reason?: string;
  mediaId?: string;
}

/**
 * Validates + stashes an upload in tmp and queues it for processing.
 * Returns immediately; clients poll /api/media/status?id=... for READY.
 */
export async function intakeUpload({
  file,
  userId,
  postId,
  requestId,
  offerId,
  isPrivate,
}: IntakeInput): Promise<IntakeResult> {
  await ensureMediaDirs();
  maybeRunDailyCleanup(); // fire-and-forget daily sweep

  const declaredMime = (file.type || '').toLowerCase();
  const isImage = validateImageMime(declaredMime);
  const isVideo = !isImage && ALLOWED_VIDEO_CHECK(declaredMime);
  if (!isImage && !isVideo) {
    return { accepted: false, reason: 'Unsupported file type. Images (JPG/PNG/WebP/GIF) and videos (MP4/WebM/MOV/MKV) only.' };
  }

  // Request/offer media carries its own (tighter, configurable) limits.
  const isMarketplace = !!(requestId || offerId);
  const maxMb = isImage
    ? MEDIA_CONFIG.IMAGE_MAX_UPLOAD_MB
    : isMarketplace
      ? MEDIA_CONFIG.REQUEST_VIDEO_MAX_UPLOAD_MB
      : MEDIA_CONFIG.VIDEO_MAX_UPLOAD_MB;
  const sizeBytes = file.size;
  if (sizeBytes > maxMb * 1024 * 1024) {
    return { accepted: false, reason: `File is too large. Maximum ${maxMb}MB.` };
  }

  // Storage protection: check free space before accepting big uploads.
  const stats = await getStorageStats();
  const rejection = canAcceptUpload(stats, sizeBytes * 2); // headroom for processing copies
  if (rejection) return { accepted: false, reason: rejection };

  // Per-request/offer attachment quota (small VPS protection, spec §34).
  if (isMarketplace) {
    const ownerId = requestId || offerId!;
    const folder = requestId ? requestFolder(requestId) : offerFolder(offerId!);
    const existing = await countMarketplaceMedia(ownerId, isImage ? 'image' : 'video');
    const limit = isImage
      ? requestId
        ? MEDIA_CONFIG.REQUEST_MAX_IMAGES
        : MEDIA_CONFIG.OFFER_MAX_IMAGES
      : requestId
        ? MEDIA_CONFIG.REQUEST_MAX_VIDEOS
        : MEDIA_CONFIG.OFFER_MAX_VIDEOS;
    if (existing >= limit) {
      return {
        accepted: false,
        reason: `Attachment limit reached: max ${limit} ${isImage ? 'images' : 'videos'} per ${requestId ? 'request' : 'offer'}.`,
      };
    }
    // Reserve the folder now so ownership is visible even before processing.
    await getStorageAdapter().ensureDir(getStorageAdapter().resolve(folder));
  }

  const mediaId = generateId();
  const tmpPath = path.join(MEDIA_TMP_ROOT, `upload-${mediaId}`);
  const buf = Buffer.from(await file.arrayBuffer());
  await fsp.writeFile(tmpPath, buf);

  if (isImage) {
    const v = await validateImageContent(buf, declaredMime);
    if (!v.ok) {
      await fsp.rm(tmpPath, { force: true });
      return { accepted: false, reason: v.reason };
    }
  } else {
    const v = await validateVideoFile(tmpPath, declaredMime, {
      maxDurationSeconds: isMarketplace ? MEDIA_CONFIG.REQUEST_VIDEO_MAX_DURATION_SECONDS : undefined,
    });
    if (!v.ok) {
      await fsp.rm(tmpPath, { force: true });
      return { accepted: false, reason: v.reason };
    }
  }

  const destDir = requestId
    ? requestFolder(requestId)
    : offerId
      ? offerFolder(offerId)
      : undefined;
  const privateMedia = isPrivate ?? isMarketplace; // marketplace attachments are private by default

  await db.collection(MEDIA_COLLECTION).doc(mediaId).set({
    id: mediaId,
    userId,
    postId: postId ?? null,
    requestId: requestId ?? null,
    offerId: offerId ?? null,
    isPrivate: privateMedia,
    storageState: 'LOCAL_ONLY' as StorageState,
    type: isImage ? 'image' : 'video',
    originalName: sanitizeOriginalName(file.name),
    storedName: mediaId,
    mimeType: isImage ? 'image/webp' : 'video/mp4',
    sizeBytes,
    storagePath: '',
    thumbnailPath: '',
    status: 'PROCESSING' as MediaStatus,
    createdAt: FieldValue.serverTimestamp(),
  });

  await enqueueAndProcess({
    mediaId,
    tmpPath,
    type: isImage ? 'image' : 'video',
    declaredMime,
    userId,
    originalName: file.name,
    destDir,
    isPrivate: privateMedia,
  });

  return { accepted: true, mediaId };
}

/** Summary shape safe to hand to authorized clients. */
export interface MediaSummary {
  mediaId: string;
  type: 'image' | 'video';
  originalName?: string;
  durationSeconds?: number;
}

/**
 * Lists READY media attached to a request or offer. Callers must check
 * authorization FIRST (the /api routes do) — this helper only filters.
 */
export async function listMediaForOwner(
  owner: { requestId?: string; offerId?: string },
): Promise<MediaSummary[]> {
  const field = owner.requestId ? 'requestId' : 'offerId';
  const value = owner.requestId ?? owner.offerId;
  if (!value) return [];
  const snap = await db.collection(MEDIA_COLLECTION).where(field, '==', value).get();
  const adapter = getStorageAdapter();
  const out: MediaSummary[] = [];
  for (const doc of snap.docs) {
    const d = doc.data() as MediaRecord;
    if (d.status !== 'READY' || !d.storagePath) continue;
    // Never hand the UI a record whose file is gone (e.g. it was cleaned up
    // with an older request) — a broken image/video is worse than a gap.
    let present = false;
    try {
      present = !!(await adapter.stat(adapter.resolve(d.storagePath)));
    } catch {
      present = false;
    }
    if (!present) {
      console.warn('[media] referenced file missing on disk, skipping', {
        mediaId: doc.id,
        storagePath: d.storagePath,
      });
      continue;
    }
    out.push({
      mediaId: doc.id,
      type: d.type,
      originalName: d.originalName,
      durationSeconds: d.durationSeconds ?? undefined,
    });
  }
  return out;
}

/** Counts non-deleted attachments of one type for a request or offer. */
async function countMarketplaceMedia(
  ownerId: string,
  type: 'image' | 'video',
): Promise<number> {
  const countIn = (field: 'requestId' | 'offerId') =>
    db
      .collection(MEDIA_COLLECTION)
      .where(field, '==', ownerId)
      .get()
      .then((snap) => {
        let n = 0;
        snap.forEach((d) => {
          const data = d.data() as MediaRecord;
          if (data.type === type && data.status !== 'DELETED') n += 1;
        });
        return n;
      })
      .catch(() => 0);
  // Single-field indexes always exist — no composite index required.
  const [byRequest, byOffer] = await Promise.all([countIn('requestId'), countIn('offerId')]);
  return byRequest + byOffer;
}

function ALLOWED_VIDEO_CHECK(mime: string): boolean {
  return ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'].includes(mime);
}

function sanitizeOriginalName(name: string): string {
  return path.basename(name).replace(/[^\w.\- ]+/g, '_').slice(0, 120);
}

function generateId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------------ */
/* URL helpers (logical references — migration-friendly, spec §15)      */
/* ------------------------------------------------------------------ */

export function mediaUrl(relPath: string): string {
  return `/api/media/file/${relPath}`;
}

/** Public URL payload for a media record (used by status + admin APIs). */
export function mediaRecordToUrls(data: Partial<MediaRecord>): {
  url?: string;
  thumbnailUrl?: string;
  sizeBytes?: number;
} {
  return {
    url: data.storagePath ? mediaUrl(data.storagePath) : undefined,
    thumbnailUrl: data.thumbnailPath ? mediaUrl(data.thumbnailPath) : undefined,
    sizeBytes: data.sizeBytes,
  };
}

/* ------------------------------------------------------------------ */
/* Cleanup sweeper (spec §5)                                           */
/* ------------------------------------------------------------------ */

export interface CleanupReport {
  removedTemp: number;
  removedOrphans: number;
  reclaimedBytes: number;
  errors: string[];
}

/**
 * Removes abandoned/failed temp uploads and orphaned stored files.
 * NEVER deletes stored media that still has a READY DB record.
 */
export async function runCleanup(): Promise<CleanupReport> {
  const report: CleanupReport = { removedTemp: 0, removedOrphans: 0, reclaimedBytes: 0, errors: [] };
  const retentionMs = MEDIA_CONFIG.TEMP_RETENTION_HOURS * 3600_000;
  const cutoff = Date.now() - retentionMs;

  // 1. Temp uploads: anything older than the retention window goes.
  try {
    const entries = await fsp.readdir(MEDIA_TMP_ROOT);
    for (const entry of entries) {
      const full = path.join(MEDIA_TMP_ROOT, entry);
      try {
        const st = await fsp.stat(full);
        const oldEnough = st.mtimeMs < cutoff;
        const isVidWorkDir = entry.startsWith('vid-');
        if (!oldEnough) continue;
        // vid-* work dirs are removed by the pipeline's finally block;
        // treat leftovers as abandoned regardless of age.
        await fsp.rm(full, { recursive: true, force: true });
        report.removedTemp += 1;
        report.reclaimedBytes += st.size;
      } catch (e) {
        report.errors.push(`tmp/${entry}: ${String(e)}`);
      }
    }
  } catch {
    // tmp dir may not exist yet
  }

  // 2. Orphaned stored media: files with no DB record, or FAILED/DELETED records.
  try {
    const snapshot = await db.collection(MEDIA_COLLECTION).get();
    const referenced = new Set<string>();
    const deletedPending: Array<{ id: string; storagePath: string; thumbnailPath: string; deletedAt?: unknown }> = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as MediaRecord & { deletedAt?: unknown };
      if (data.status === 'READY' && data.storagePath) {
        referenced.add(path.resolve(MEDIA_ROOT, data.storagePath));
        if (data.thumbnailPath) referenced.add(path.resolve(MEDIA_ROOT, data.thumbnailPath));
      }
      // Soft-deleted marketplace media: hard-delete after the retention window.
      if (data.status === 'DELETED' && (data.storagePath || data.thumbnailPath)) {
        const at = toMs(data.deletedAt) ?? toMs(data.processedAt) ?? toMs(data.createdAt) ?? 0;
        if (Date.now() - at > MEDIA_CONFIG.DELETED_MEDIA_RETENTION_DAYS * 86_400_000) {
          deletedPending.push({ id: data.id, storagePath: data.storagePath, thumbnailPath: data.thumbnailPath });
        }
      }
    });

    for (const item of deletedPending) {
      await deleteStoredFiles([item.storagePath, item.thumbnailPath]);
      await db.collection(MEDIA_COLLECTION).doc(item.id).update({ storagePath: '', thumbnailPath: '' });
      report.removedOrphans += 1;
    }

    for (const sub of ['images', 'videos', 'thumbnails', 'requests'] as const) {
      const dir = path.join(MEDIA_ROOT, sub);
      await walkOrphans(dir, referenced, report);
    }
  } catch (e) {
    report.errors.push(`orphan scan: ${String(e)}`);
  }

  return report;
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

async function walkOrphans(
  dir: string,
  referenced: Set<string>,
  report: CleanupReport,
): Promise<void> {
  let entries: import('fs').Dirent[];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkOrphans(full, referenced, report);
      continue;
    }
    if (referenced.has(path.resolve(full))) continue;
    try {
      const st = await fsp.stat(full);
      await fsp.rm(full, { force: true });
      report.removedOrphans += 1;
      report.reclaimedBytes += st.size;
    } catch (e) {
      report.errors.push(`${full}: ${String(e)}`);
    }
  }
}

/** Permanently deletes one media file + record (used by admin/revoke flows). */
export async function deleteMediaRecord(mediaId: string): Promise<void> {
  const ref = db.collection(MEDIA_COLLECTION).doc(mediaId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const data = snap.data() as MediaRecord;
  await deleteStoredFiles([data.storagePath, data.thumbnailPath]);
  await ref.update({
    status: 'DELETED' as MediaStatus,
    storagePath: '',
    thumbnailPath: '',
    deletedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Authorization for private media delivery (spec §32). Returns the media
 * record when `viewerUid` may view it, else null.
 *
 * Rules:
 *  - uploader always
 *  - platform admins
 *  - the customer who owns the request the media is attached to
 *  - the seller who owns the offer the media is attached to
 *  - sellers whose business matches the request (category or location) once
 *    the request is active — that is the authorized-audience model
 *  - anything PUBLIC (or attached to neither) is readable by anyone signed in
 *    or via public paths
 */
export async function authorizeMediaView(
  mediaId: string,
  viewerUid: string | null,
  viewerIsAdmin = false,
): Promise<MediaRecord | null> {
  const snap = await db.collection(MEDIA_COLLECTION).doc(mediaId).get();
  if (!snap.exists) return null;
  const media = snap.data() as MediaRecord;
  if (media.status !== 'READY' || !media.storagePath) return null;
  if (!media.isPrivate) return media;
  if (!viewerUid) return null;
  if (media.userId === viewerUid || viewerIsAdmin) return media;

  if (media.requestId) {
    const reqSnap = await db.collection(REQUESTS_COLLECTION).doc(media.requestId).get();
    if (!reqSnap.exists) return null;
    const req = reqSnap.data() as MarketplaceRequest;
    if (req.customerId === viewerUid) return media;
    if (req.status === 'active' && (await isAuthorizedSellerFor(req, viewerUid))) return media;
    return null;
  }

  if (media.offerId) {
    const offerSnap = await db.collection(OFFERS_COLLECTION).doc(media.offerId).get();
    if (!offerSnap.exists) return null;
    const offer = offerSnap.data() as MarketplaceOffer;
    if (offer.sellerId === viewerUid) return media;
    const reqSnap = await db.collection(REQUESTS_COLLECTION).doc(offer.requestId).get();
    if (reqSnap.exists && (reqSnap.data() as MarketplaceRequest).customerId === viewerUid) return media;
    return null;
  }

  return null;
}

/**
 * A seller is authorized to view a request's private media. Platform rule
 * (§32, updated): EVERY business account may view media on an ACTIVE
 * request — any seller can reply with an offer, and the buyer picks one
 * winner. Matching only decides notification priority, not access.
 */
export async function isAuthorizedSellerFor(
  request: MarketplaceRequest,
  sellerUid: string,
): Promise<boolean> {
  // Anyone who already offered is explicitly authorized.
  const offered = await db
    .collection(OFFERS_COLLECTION)
    .where('requestId', '==', request.id)
    .get()
    .then((snap) => {
      let hit = false;
      snap.forEach((d) => {
        if ((d.data() as MarketplaceOffer).sellerId === sellerUid) hit = true;
      });
      return hit;
    })
    .catch(() => false);
  if (offered) return true;

  // Business accounts (sellers + admins) may browse all active briefs.
  const profile = await db
    .collection('userProfiles')
    .doc(sellerUid)
    .get()
    .catch(() => null);
  if (profile?.exists) {
    const p = profile.data() as { userRole?: string; role?: string; businessCategory?: string };
    const role = p.userRole ?? p.role;
    if (role === 'seller' || role === 'admin') return true;
    // Fallback: buyers with a matching category tag (hybrid accounts).
    if (request.category && p.businessCategory === request.category) return true;
  }

  // Shop-profile match (category or location) as a last resort.
  const shops = await db
    .collection('sellerShops')
    .where('sellerId', '==', sellerUid)
    .limit(1)
    .get()
    .catch(() => null);
  let shop: SellerShop | null = null;
  if (shops && !shops.empty) shop = shops.docs[0].data() as SellerShop;

  if (shop) {
    if (request.category && (shop as unknown as { category?: string }).category === request.category) return true;
    const requestLocation = request.location ?? '';
    const loc = [shop.county, shop.cityTown, shop.location].filter(Boolean).map(String);
    if (requestLocation && loc.some((l) => l.toLowerCase() === requestLocation.toLowerCase())) return true;
    if (requestLocation && (shop.targetLocations ?? []).some((t: string) => t.toLowerCase() === requestLocation.toLowerCase())) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Direct storage for AI-generated media (bypasses the upload queue —  */
/* the content is already produced server-side, e.g. by Veo/Imagen).   */
/* ------------------------------------------------------------------ */

/** Best-effort video thumbnail via ffmpeg. Returns false when unavailable. */
async function tryVideoThumbnail(videoAbs: string, thumbAbs: string): Promise<boolean> {
  try {
    const { spawn } = await import('child_process');
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        'ffmpeg',
        ['-y', '-ss', '1', '-i', videoAbs, '-vframes', '1', '-vf', "scale='min(400,iw)':-2", '-q:v', '4', thumbAbs],
        { stdio: 'ignore' },
      );
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('thumbnail timeout'));
      }, 60_000);
      child.on('close', (code) => {
        clearTimeout(timer);
        code === 0 ? resolve() : reject(new Error('ffmpeg failed'));
      });
      child.on('error', () => {
        clearTimeout(timer);
        reject(new Error('ffmpeg not available'));
      });
    });
    return true;
  } catch {
    await fsp.rm(thumbAbs, { force: true });
    return false;
  }
}

export interface StoredMedia {
  mediaId: string;
  url: string;
  thumbnailUrl: string | null;
  sizeBytes: number;
}

/**
 * Stores a server-generated video (e.g. from the Veo API) directly into
 * the Vidnov media library and returns its public URL. Avoids passing
 * large data URIs through server-action payloads.
 */
export async function storeGeneratedVideo(
  videoBuffer: Buffer,
  userId: string,
): Promise<StoredMedia> {
  await ensureMediaDirs();

  const id = generateId();
  const videoRel = path.join('videos', dateFolder(), `${id}.mp4`);
  const thumbRel = path.join('thumbnails', dateFolder(), `${id}_t.jpg`);
  const videoAbs = path.join(MEDIA_ROOT, videoRel);
  const thumbAbs = path.join(MEDIA_ROOT, thumbRel);

  await fsp.mkdir(path.dirname(videoAbs), { recursive: true });
  await fsp.writeFile(videoAbs, videoBuffer);

  const hasThumb = await tryVideoThumbnail(videoAbs, thumbAbs);
  const finalThumbRel = hasThumb ? thumbRel : null;

  await db.collection(MEDIA_COLLECTION).doc(id).set({
    id,
    userId: userId || 'ai-studio',
    postId: null,
    type: 'video',
    originalName: 'ai-generated.mp4',
    storedName: id,
    mimeType: 'video/mp4',
    sizeBytes: videoBuffer.length,
    storagePath: videoRel,
    thumbnailPath: finalThumbRel ?? '',
    status: 'READY' as MediaStatus,
    createdAt: FieldValue.serverTimestamp(),
    processedAt: FieldValue.serverTimestamp(),
  });

  return {
    mediaId: id,
    url: mediaUrl(videoRel),
    thumbnailUrl: finalThumbRel ? mediaUrl(finalThumbRel) : null,
    sizeBytes: videoBuffer.length,
  };
}

/**
 * Stores a server-generated image (e.g. from Imagen) into the media
 * library and returns its public URL.
 */
export async function storeGeneratedImage(
  imageBuffer: Buffer,
  userId: string,
  extension: 'png' | 'webp' = 'png',
): Promise<StoredMedia> {
  await ensureMediaDirs();

  const id = generateId();
  const imageRel = path.join('images', dateFolder(), `${id}.${extension}`);
  const imageAbs = path.join(MEDIA_ROOT, imageRel);

  await fsp.mkdir(path.dirname(imageAbs), { recursive: true });
  await fsp.writeFile(imageAbs, imageBuffer);

  await db.collection(MEDIA_COLLECTION).doc(id).set({
    id,
    userId: userId || 'ai-studio',
    postId: null,
    type: 'image',
    originalName: `ai-generated.${extension}`,
    storedName: id,
    mimeType: extension === 'png' ? 'image/png' : 'image/webp',
    sizeBytes: imageBuffer.length,
    storagePath: imageRel,
    thumbnailPath: '',
    status: 'READY' as MediaStatus,
    createdAt: FieldValue.serverTimestamp(),
    processedAt: FieldValue.serverTimestamp(),
  });

  return { mediaId: id, url: mediaUrl(imageRel), thumbnailUrl: null, sizeBytes: imageBuffer.length };
}
