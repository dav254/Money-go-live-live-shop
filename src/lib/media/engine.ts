import * as path from 'path';
import * as fsp from 'fs/promises';
import { MEDIA_ROOT, MEDIA_TMP_ROOT, MEDIA_CONFIG } from './config';
import { processImage, validateImageContent, generateMediaId } from './image';
import { processVideo, validateVideoFile } from './video';
import { getStorageAdapter } from './storage-adapter';

/**
 * MEDIA ENGINE — the upload→process→store→serve pipeline, rebuilt to be
 * disk-authoritative.
 *
 * ## Why this exists (and why not the Firestore queue)
 *
 * The previous publish path accepted an upload, wrote a `PROCESSING` record to
 * Firestore, kicked off a background queue, and had the browser poll
 * `/api/media/status` — which read that same Firestore document. Under load the
 * Firestore backend throttles (`resource_exhausted`), the status route answers
 * 503, and the poll loop never sees `READY`: the seller's upload sits at 90%
 * forever while the file is actually sitting on disk, fully processed. A
 * publish path that can be wedged by a database throttle is the wrong shape —
 * the bytes are already on our own disk, so the disk should be the source of
 * truth, not a document in a database that may be rate-limited.
 *
 * This engine therefore:
 *  - processes IMAGES **synchronously** inside the request and returns the final
 *    URL immediately — no polling, no window where the client can get stuck;
 *  - processes VIDEOS in a background worker (transcode genuinely takes
 *    minutes) but tracks their state in a small **JSON file on disk** under
 *    `_status/<mediaId>.json`, so the status route never touches Firestore and
 *    cannot 503;
 *  - reuses the existing sharp/ffmpeg pipelines, which were always disk-based
 *    and fine — only the state tracking was the problem.
 *
 * The API contract (`{ mediaId, url, thumbnailUrl }` on upload,
 * `{ status, url, thumbnailUrl, error }` on status) is unchanged, so the
 * frontend and every other caller keep working.
 */

/** Status + metadata for one stored media item, kept on disk (not Firestore). */
export interface DiskMediaStatus {
  id: string;
  userId: string;
  type: 'image' | 'video' | 'audio' | 'file';
  status: 'PROCESSING' | 'READY' | 'FAILED';
  /** Relative to MEDIA_ROOT; served via /api/media/file/<path>. */
  storagePath?: string;
  thumbnailPath?: string;
  url?: string;
  thumbnailUrl?: string;
  error?: string | null;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  isPrivate?: boolean;
  createdAt: number;
}

/** One directory for status sidecars, kept OUTSIDE the public media tree. */
export const MEDIA_STATUS_DIR = path.join(
  path.dirname(MEDIA_ROOT),
  path.basename(MEDIA_ROOT) + '-status',
);

function statusFile(id: string): string {
  return path.join(MEDIA_STATUS_DIR, `${id}.json`);
}

/** Public URL for a stored relative path (matches the file-serving route). */
export function engineMediaUrl(relPath: string): string {
  return `/api/media/file/${relPath}`;
}

async function ensureStatusDir(): Promise<void> {
  await fsp.mkdir(MEDIA_STATUS_DIR, { recursive: true });
}

export async function writeStatus(s: DiskMediaStatus): Promise<void> {
  await ensureStatusDir();
  await fsp.writeFile(statusFile(s.id), JSON.stringify(s));
}

export async function readStatus(id: string): Promise<DiskMediaStatus | null> {
  // Reject any id that is not a bare opaque token (no traversal).
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  try {
    const raw = await fsp.readFile(statusFile(id), 'utf8');
    return JSON.parse(raw) as DiskMediaStatus;
  } catch {
    return null;
  }
}

export interface EngineIntakeInput {
  file: File;
  userId: string;
  /** Accepted for contract parity with the old route; product media does not
   *  require it. Present so callers attaching to a feed post keep compiling. */
  postId?: string;
  requestId?: string;
  offerId?: string;
  folder?: string;
  isPrivate?: boolean;
}

export interface EngineIntakeResult {
  accepted: boolean;
  reason?: string;
  mediaId?: string;
  /** Present immediately for images + raw files; undefined for async video. */
  url?: string;
  thumbnailUrl?: string;
}

const ALLOWED_IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_VIDEO = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']);
const RAW_AUDIO = new Set(['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/flac']);
const RAW_DOC = new Set([
  'application/pdf', 'text/plain', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
]);

/** Owner folders a named-folder upload may target (relative to MEDIA_ROOT). */
const FOLDER_ROOTS = new Set(['chats', 'support', 'verification', 'avatars', 'products']);

/**
 * Validate + authorize a named owner folder. Returns the clean relative path or
 * null. Product media (no folder) never reaches here, so the main publish path
 * has no Firestore dependency at all.
 */
async function resolveFolder(raw: string, userId: string): Promise<string | null> {
  const clean = raw.trim().replace(/^\/+|\/+$/g, '');
  if (!/^([A-Za-z0-9_-]{1,64})(\/[A-Za-z0-9_-]{1,64}){0,3}$/.test(clean)) return null;
  const parts = clean.split('/');
  const [root, owner] = parts;
  if (!FOLDER_ROOTS.has(root)) return null;
  if (root === 'chats') {
    // Chat membership is the one place we still consult Firestore — but as a
    // best-effort guard, never a hard dependency for the publish path.
    if (parts.length !== 2) return null;
    try {
      const { db } = await import('@/firebase/server');
      const chat = await db.collection('chats').doc(owner).get();
      const ids: unknown = chat.data()?.participantIds;
      return Array.isArray(ids) && ids.includes(userId) ? clean : null;
    } catch {
      return null;
    }
  }
  // support / verification / avatars / products are private to the uploader.
  return parts.length === 2 && owner === userId ? clean : null;
}

function rawExtFor(mime: string): string {
  const byMime: Record<string, string> = {
    'audio/webm': '.weba', 'audio/ogg': '.ogg', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a',
    'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/aac': '.aac', 'audio/flac': '.flac',
    'application/pdf': '.pdf', 'text/plain': '.txt', 'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/zip': '.zip',
  };
  return byMime[mime] || '.bin';
}

function sanitizeName(name: string): string {
  return path.basename(name).replace(/[^\w.\- ]+/g, '_').slice(0, 120);
}

/**
 * Accept an upload and get it onto disk.
 *
 * Images and raw files are fully processed here and their final URL returned in
 * the response. Videos are handed to a background worker and report `url:
 * undefined`; the client polls `/api/media/status` (disk-backed) for those.
 */
export async function intake(input: EngineIntakeInput): Promise<EngineIntakeResult> {
  const { file, userId, requestId, offerId, folder } = input;
  const adapter = getStorageAdapter();
  await fsp.mkdir(MEDIA_ROOT, { recursive: true });
  await fsp.mkdir(MEDIA_TMP_ROOT, { recursive: true });

  const destFolder = folder ? await resolveFolder(folder, userId) : undefined;
  if (folder && !destFolder) return { accepted: false, reason: 'Invalid upload destination.' };

  const mime = (file.type || '').toLowerCase();
  const isImage = ALLOWED_IMAGE.has(mime);
  const isVideo = !isImage && ALLOWED_VIDEO.has(mime);
  const isAudio = !isImage && !isVideo && RAW_AUDIO.has(mime);
  const isDoc = !isImage && !isVideo && !isAudio && RAW_DOC.has(mime);

  if (!isImage && !isVideo && !isAudio && !isDoc) {
    return { accepted: false, reason: 'Unsupported file type. Images (JPG/PNG/WebP/GIF) and videos (MP4/WebM/MOV/MKV) only.' };
  }
  if ((isAudio || isDoc) && !destFolder) {
    return { accepted: false, reason: 'Unsupported file type here. Images and videos only.' };
  }

  const maxMb = isImage
    ? MEDIA_CONFIG.IMAGE_MAX_UPLOAD_MB
    : isVideo
      ? MEDIA_CONFIG.VIDEO_MAX_UPLOAD_MB
      : MEDIA_CONFIG.FILE_MAX_UPLOAD_MB;
  if (file.size > maxMb * 1024 * 1024) {
    return { accepted: false, reason: `File is too large. Maximum ${maxMb}MB.` };
  }

  const mediaId = generateMediaId();
  const tmpPath = path.join(MEDIA_TMP_ROOT, `up-${mediaId}`);
  const buf = Buffer.from(await file.arrayBuffer());
  await fsp.writeFile(tmpPath, buf);

  const base: DiskMediaStatus = {
    id: mediaId,
    userId,
    type: isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'file',
    status: 'PROCESSING',
    mimeType: mime || 'application/octet-stream',
    sizeBytes: buf.length,
    isPrivate: input.isPrivate ?? !!(requestId || offerId),
    createdAt: Date.now(),
  };

  try {
    // ---- RAW audio / documents: store byte-for-byte, READY immediately. ----
    if ((isAudio || isDoc) && destFolder) {
      const rel = path.posix.join(destFolder, `${mediaId}${rawExtFor(mime)}`);
      const abs = adapter.resolve(rel);
      await adapter.ensureDir(path.dirname(abs));
      await adapter.moveFile(tmpPath, abs);
      const stored = (await adapter.stat(abs))?.size ?? buf.length;
      const rec: DiskMediaStatus = {
        ...base,
        status: 'READY',
        storagePath: rel,
        url: engineMediaUrl(rel),
        sizeBytes: stored,
        mimeType: mime || 'application/octet-stream',
      };
      await writeStatus(rec);
      return { accepted: true, mediaId, url: rec.url };
    }

    // ---- IMAGES: process synchronously, return the final URL now. ----
    if (isImage) {
      const v = await validateImageContent(buf, mime);
      if (!v.ok) {
        await fsp.rm(tmpPath, { force: true });
        return { accepted: false, reason: v.reason };
      }
      const destDir = destFolder || (requestId ? `requests/request_${requestId}` : offerId ? `requests/offer_${offerId}` : undefined);
      const img = await processImage(tmpPath, sanitizeName(file.name), { destDir });
      await fsp.rm(tmpPath, { force: true }).catch(() => undefined);
      const rec: DiskMediaStatus = {
        ...base,
        status: 'READY',
        storagePath: img.storagePath,
        thumbnailPath: img.thumbnailPath,
        url: engineMediaUrl(img.storagePath),
        thumbnailUrl: engineMediaUrl(img.thumbnailPath),
        mimeType: 'image/webp',
        sizeBytes: img.sizeBytes,
        width: img.width,
        height: img.height,
      };
      await writeStatus(rec);
      return { accepted: true, mediaId, url: rec.url, thumbnailUrl: rec.thumbnailUrl };
    }

    // ---- VIDEOS: validate now, transcode in the background. ----
    if (isVideo) {
      const v = await validateVideoFile(tmpPath, mime);
      if (!v.ok) {
        await fsp.rm(tmpPath, { force: true });
        return { accepted: false, reason: v.reason };
      }
      const destDir = destFolder || (requestId ? `requests/request_${requestId}` : offerId ? `requests/offer_${offerId}` : undefined);
      await writeStatus(base);
      // Fire-and-forget: the request returns immediately with the mediaId.
      void transcodeVideoInBackground({ mediaId, tmpPath, destDir, base });
      return { accepted: true, mediaId };
    }

    return { accepted: false, reason: 'Unsupported file type.' };
  } catch (err) {
    await fsp.rm(tmpPath, { force: true }).catch(() => undefined);
    const message = err instanceof Error ? err.message : 'Upload failed on the server.';
    await writeStatus({ ...base, status: 'FAILED', error: message }).catch(() => undefined);
    return { accepted: false, reason: message };
  }
}

/** Background video transcode. Status lives on disk, never in Firestore. */
async function transcodeVideoInBackground(args: {
  mediaId: string;
  tmpPath: string;
  destDir?: string;
  base: DiskMediaStatus;
}): Promise<void> {
  const { mediaId, tmpPath, destDir, base } = args;
  try {
    const vid = await processVideo(tmpPath, { destDir });
    await fsp.rm(tmpPath, { force: true }).catch(() => undefined);
    const rec: DiskMediaStatus = {
      ...base,
      status: 'READY',
      storagePath: vid.storagePath,
      thumbnailPath: vid.thumbnailPath,
      url: engineMediaUrl(vid.storagePath),
      thumbnailUrl: engineMediaUrl(vid.thumbnailPath),
      mimeType: 'video/mp4',
      sizeBytes: vid.sizeBytes,
      width: vid.width,
      height: vid.height,
      durationSeconds: vid.durationSeconds,
    };
    await writeStatus(rec);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Video processing failed.';
    await fsp.rm(tmpPath, { force: true }).catch(() => undefined);
    await writeStatus({ ...base, status: 'FAILED', error: message }).catch(() => undefined);
  }
}
