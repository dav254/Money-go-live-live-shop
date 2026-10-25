/**
 * SOUNDTRACK RENDERER — server-only ffmpeg executor for Video Studio.
 *
 * Turns a seller's uploaded clip plus composed soundtrack into the FINAL
 * published file: one MP4 whose audio track is the intended mix, and one
 * poster frame at the seller's chosen cover moment. The plan itself
 * (`buildMixArgs`) is pure and shared; this module does the only three
 * impure things: resolve ids to OWNED files on disk, run ffmpeg, and write
 * the same disk-backed status sidecar the engine uses — so the browser polls
 * the existing `/api/media/status` endpoint and nothing else.
 *
 * Rules this module exists to keep:
 *   • every input is resolved from a verified status record whose `userId`
 *     is the caller — an id alone never grants access to a file;
 *   • the music path is either the caller's own `music/<uid>/` folder or a
 *     licensed catalogue file under `public/music/` — nothing else resolves;
 *   • the original file is never touched: output goes to a fresh media id
 *     under `videos/<date>/` and the source survives until the seller
 *     deletes their own draft;
 *   • failure writes FAILED with a human message — never a stack, never a
 *     token, never a filesystem path in the error the client can see? The
 *     sidecar `error` is shown to the owner in their own studio, so it carries
 *     the reason but never absolute paths.
 */

import * as path from 'path';
import * as fsp from 'fs/promises';
import { MEDIA_ROOT, MEDIA_TMP_ROOT, dateFolder } from './config';
import { readStatus, writeStatus, engineMediaUrl } from './engine';
import { generateMediaId } from './image';
import { probeVideo, probeAudio } from './video';
import { promoteFile, getStorageStats, STORAGE_RESERVE_BYTES } from './storage';
import {
  buildMixArgs,
  buildPosterArgs,
  needsRender,
  type RenderPlan,
  type SoundtrackSettings,
} from '@/lib/studio/video-studio';
import { getTrack } from '@/lib/studio/music-catalog';

export interface OwnedMedia {
  id: string;
  storagePath: string;
  url: string;
  durationSeconds: number;
  width: number;
  height: number;
  hasAudio: boolean;
  originalName?: string;
}

/**
 * Resolves a mediaId to a READY video the CALLER owns. Returns null for
 * anything else — wrong owner, wrong type, still processing, unknown id.
 * The uid comes from the verified request, never from the payload.
 */
export async function resolveOwnedVideo(
  mediaId: string,
  uid: string,
): Promise<OwnedMedia | null> {
  const rec = await readStatus(mediaId);
  if (!rec || rec.userId !== uid) return null;
  if (rec.type !== 'video' || rec.status !== 'READY' || !rec.storagePath) return null;
  if (rec.storagePath.includes('..')) return null;

  const probe = await probeVideo(path.join(MEDIA_ROOT, rec.storagePath));
  if (!probe.ok) return null;
  return {
    id: rec.id,
    storagePath: rec.storagePath,
    url: rec.url ?? engineMediaUrl(rec.storagePath),
    durationSeconds: probe.durationSeconds ?? 0,
    width: probe.width ?? 0,
    height: probe.height ?? 0,
    hasAudio: probe.hasAudio === true,
    originalName: rec.originalName,
  };
}

export interface MusicSource {
  path: string;
  durationSeconds: number;
  title: string;
  /** Where it came from — recorded in the draft, never a path. */
  source: 'upload' | 'catalogue';
}

/**
 * Resolves a sanitized soundtrack to a local audio file.
 *
 *  • `musicMediaId` → must be READY audio under the caller's OWN
 *    `music/<uid>/` folder (belt and braces: the folder prefix AND the
 *    status owner must both match);
 *  • `catalogueTrackId` → a licensed track whose streamUrl is a same-origin
 *    `/music/...` path, resolved inside `public/music` with a containment
 *    check so no crafted URL can walk out of it.
 *
 * Anything else is null — the caller then refuses the render.
 */
export async function resolveMusicSource(
  soundtrack: SoundtrackSettings,
  uid: string,
): Promise<MusicSource | null> {
  if (soundtrack.musicMediaId) {
    const rec = await readStatus(soundtrack.musicMediaId);
    if (!rec || rec.userId !== uid) return null;
    if (rec.type !== 'audio' || rec.status !== 'READY' || !rec.storagePath) return null;
    const expected = `music/${uid}/`;
    if (!rec.storagePath.startsWith(expected)) return null;
    const abs = path.join(MEDIA_ROOT, rec.storagePath);
    const probe = await probeAudio(abs);
    if (!probe.ok) return null;
    return {
      path: abs,
      durationSeconds: probe.durationSeconds ?? 0,
      title: (rec.originalName || soundtrack.musicMediaId).replace(/\.[^.]+$/, ''),
      source: 'upload',
    };
  }

  if (soundtrack.catalogueTrackId) {
    const track = getTrack(soundtrack.catalogueTrackId);
    if (!track) return null;
    if (!track.streamUrl.startsWith('/music/')) return null;
    const rel = track.streamUrl.replace(/^\/+/, '');
    const root = path.join(process.cwd(), 'public', 'music');
    const abs = path.resolve(path.join(process.cwd(), 'public', rel));
    if (!abs.startsWith(root + path.sep)) return null;
    const probe = await probeAudio(abs);
    if (!probe.ok) return null;
    return {
      path: abs,
      durationSeconds: probe.durationSeconds ?? 0,
      title: track.title,
      source: 'catalogue',
    };
  }

  return null;
}

export interface RenderRequest {
  /** Fresh media id for the FINAL file (generated by the route). */
  finalMediaId: string;
  userId: string;
  source: OwnedMedia;
  plan: Omit<RenderPlan, 'videoPath' | 'musicPath' | 'outPath' | 'textFilePath'>;
  music?: MusicSource | null;
}

/**
 * Runs a render in the background and tracks it through the engine's status
 * sidecar. Resolves immediately with the mediaId to poll — ffmpeg on this
 * box (1 CPU) can take a minute for a 60s clip, which is exactly what the
 * existing async video contract is built for.
 */
export async function startStudioRender(req: RenderRequest): Promise<string> {
  const id = req.finalMediaId;
  await writeStatus({
    id,
    userId: req.userId,
    type: 'video',
    status: 'PROCESSING',
    originalName: req.source.originalName,
    createdAt: Date.now(),
  });

  // Fire and forget — the route has already answered with the mediaId.
  void (async () => {
    const workDir = path.join(MEDIA_TMP_ROOT, `studio-${id}`);
    await fsp.mkdir(workDir, { recursive: true });
    try {
      // Disk-space guard: a render that fills the root would take the whole
      // site down with it. Refuse BEFORE ffmpeg starts.
      const stats = await getStorageStats();
      if (stats.freeBytes < STORAGE_RESERVE_BYTES * 2) {
        throw new Error(
          'The server is low on storage space, so this video cannot be rendered right now. Try again shortly.',
        );
      }

      const videoAbs = path.join(MEDIA_ROOT, req.source.storagePath);
      const plan: Omit<RenderPlan, 'outPath'> = {
        ...req.plan,
        videoPath: videoAbs,
        musicPath: req.music?.path,
        musicDurationSeconds: req.music?.durationSeconds,
      };

      const finalRel = path.join('videos', dateFolder(), `${id}.mp4`);
      const posterRel = path.join('thumbnails', dateFolder(), `${id}_t.jpg`);
      const finalAbs = path.join(MEDIA_ROOT, finalRel);
      const posterAbs = path.join(MEDIA_ROOT, posterRel);
      const duration =
        req.plan.trim != null
          ? req.plan.trim.endSeconds - req.plan.trim.startSeconds
          : req.source.durationSeconds;

      // Overlay text goes into a FILE — seller text never enters the filter
      // string, so no escaping bug can ever turn a caption into an option.
      if (req.plan.overlay) {
        const textFile = path.join(workDir, 'overlay.txt');
        await fsp.writeFile(textFile, req.plan.overlay.text, 'utf8');
        plan.textFilePath = textFile;
      }

      if (needsRender(plan)) {
        const outTmp = path.join(workDir, 'out.mp4');
        const args = buildMixArgs({ ...plan, outPath: outTmp });
        const code = await runFfmpeg(args);
        if (code !== 0) throw new Error('Video rendering failed. Your draft is safe — try again.');
        await promoteFile(outTmp, finalAbs);
      } else {
        // No render needed (cover-only or nothing at all): the final file IS
        // the source file — same bytes, new poster.
        await fsp.copyFile(videoAbs, finalAbs);
      }

      // Poster at the chosen cover moment, EOF-safe fallback to frame 0.
      const posterTmp = path.join(workDir, 'poster.jpg');
      const coverAt = Math.max(
        0,
        Math.min(req.plan.coverAtSeconds ?? 0, Math.max(0, duration - 0.1)),
      );
      let pcode = await runFfmpeg(buildPosterArgs(finalAbs, coverAt, posterTmp));
      if (pcode !== 0 || !(await exists(posterTmp))) {
        pcode = await runFfmpeg(buildPosterArgs(finalAbs, 0, posterTmp));
        if (pcode !== 0 || !(await exists(posterTmp))) {
          throw new Error('Could not create a cover image for this video.');
        }
      }
      await promoteFile(posterTmp, posterAbs);

      const probe = await probeVideo(finalAbs);
      const [vStat, pStat] = await Promise.all([
        fsp.stat(finalAbs),
        fsp.stat(posterAbs),
      ]);

      await writeStatus({
        id,
        userId: req.userId,
        type: 'video',
        status: 'READY',
        storagePath: finalRel,
        thumbnailPath: posterRel,
        url: engineMediaUrl(finalRel),
        thumbnailUrl: engineMediaUrl(posterRel),
        mimeType: 'video/mp4',
        sizeBytes: vStat.size,
        width: probe.ok ? (probe.width ?? 0) : 0,
        height: probe.ok ? (probe.height ?? 0) : 0,
        durationSeconds: probe.ok ? (probe.durationSeconds ?? duration) : duration,
        originalName: req.source.originalName,
        createdAt: Date.now(),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Video rendering failed unexpectedly.';
      await writeStatus({
        id,
        userId: req.userId,
        type: 'video',
        status: 'FAILED',
        error: message.slice(0, 300),
        createdAt: Date.now(),
      }).catch(() => undefined);
    } finally {
      await fsp.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  })();

  return id;
}

/** Spawn-free-of-secrets runner: args only, no shell, logs never printed. */
function runFfmpeg(args: string[]): Promise<number> {
  return new Promise((resolve) => {
    void import('child_process').then(({ spawn }) => {
      const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      child.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString();
        if (stderr.length > 32_000) stderr = stderr.slice(-16_000);
      });
      const timer = setTimeout(() => child.kill('SIGKILL'), 10 * 60 * 1000);
      child.on('error', () => {
        clearTimeout(timer);
        resolve(-1);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve(code ?? -1);
      });
    });
  });
}

async function exists(p: string): Promise<boolean> {
  try {
    return (await fsp.stat(p)).isFile();
  } catch {
    return false;
  }
}

export { generateMediaId as newStudioMediaId };