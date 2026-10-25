import * as path from 'path';
import * as fsp from 'fs/promises';
import { spawn } from 'child_process';
import { MEDIA_CONFIG, MEDIA_ROOT, dateFolder, ALLOWED_VIDEO_MIME } from './config';
import { MUSIC_ALLOWED_MIME, MUSIC_MAX_SECONDS, musicDurationOk } from './music';
import { promoteFile } from './storage';
import { generateMediaId } from './image';

/**
 * Video pipeline (spec section 2):
 * validate (MIME, container, duration, size) → FFmpeg transcode to
 * H.264/AAC MP4 capped at 720p with CRF ~28 → generate one thumbnail
 * (≤400px) → store only the optimized video + thumbnail; the original
 * temp file is deleted by the caller after the DB record is written.
 */

export interface ProcessedVideo {
  storagePath: string; // relative to MEDIA_ROOT
  thumbnailPath: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailSizeBytes: number;
  width: number;
  height: number;
  durationSeconds: number;
}

export interface VideoProbeResult {
  ok: boolean;
  reason?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  hasAudio?: boolean;
  container?: string;
}

interface CmdResult {
  code: number;
  stdout: string;
  stderr: string;
}

function run(cmd: string, args: string[], timeoutMs = 5 * 60 * 1000): Promise<CmdResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 64_000) stderr = stderr.slice(-32_000);
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: 'spawn failed (is ffmpeg installed?)' });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

/** True when the path exists and is a regular file. */
async function fileExists(p: string): Promise<boolean> {
  try {
    return (await fsp.stat(p)).isFile();
  } catch {
    return false;
  }
}

interface FfprobeJson {
  streams?: Array<{
    codec_type?: string;
    width?: number;
    height?: number;
    duration?: string;
    codec_name?: string;
  }>;
  format?: { duration?: string; format_name?: string };
}

/** Probes the video with ffprobe: container, duration, resolution, audio. */
export async function probeVideo(filePath: string): Promise<VideoProbeResult> {
  const { code, stdout, stderr } = await run(
    'ffprobe',
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath],
    60_000,
  );
  if (code !== 0) {
    return {
      ok: false,
      reason: 'Not a valid video file.' + (stderr.includes('spawn failed') ? ' (ffprobe not found on server)' : ''),
    };
  }
  try {
    const json = JSON.parse(stdout) as FfprobeJson;
    const streams = json.streams ?? [];
    const video = streams.find((s) => s.codec_type === 'video');
    if (!video) return { ok: false, reason: 'No video stream found.' };
    const duration = Number(json.format?.duration ?? video.duration ?? 0);
    const width = Number(video.width ?? 0);
    const height = Number(video.height ?? 0);
    const hasAudio = streams.some((s) => s.codec_type === 'audio');
    const container = String(json.format?.format_name ?? '');
    return { ok: true, durationSeconds: duration, width, height, hasAudio, container };
  } catch {
    return { ok: false, reason: 'ffprobe output could not be parsed.' };
  }
}

/** Validates MIME + probes actual content (duration / streams). */
export async function validateVideoFile(
  tmpPath: string,
  declaredMime: string,
  opts?: { maxDurationSeconds?: number },
) {
  if (!ALLOWED_VIDEO_MIME.has(declaredMime.toLowerCase())) {
    return { ok: false as const, reason: 'Unsupported video type. Allowed: MP4, WebM, MOV, MKV.' };
  }
  const probe = await probeVideo(tmpPath);
  if (!probe.ok) return { ok: false as const, reason: probe.reason };

  const maxDuration = opts?.maxDurationSeconds ?? MEDIA_CONFIG.VIDEO_MAX_DURATION_SECONDS;
  if (probe.durationSeconds && probe.durationSeconds > maxDuration + 0.5) {
    return {
      ok: false as const,
      reason: `Video is too long (${Math.round(probe.durationSeconds)}s). Maximum is ${maxDuration}s.`,
    };
  }
  return { ...probe, ok: true as const };
}

/** Probes an audio file: requires a real audio stream and a readable duration. */
export async function probeAudio(filePath: string): Promise<{
  ok: boolean;
  reason?: string;
  durationSeconds?: number;
  container?: string;
}> {
  const { code, stdout, stderr } = await run(
    'ffprobe',
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath],
    60_000,
  );
  if (code !== 0) {
    return {
      ok: false,
      reason:
        'Not a valid audio file.' +
        (stderr.includes('spawn failed') ? ' (ffprobe not found on server)' : ''),
    };
  }
  try {
    const json = JSON.parse(stdout) as FfprobeJson;
    const streams = json.streams ?? [];
    const audio = streams.find((s) => s.codec_type === 'audio');
    if (!audio) return { ok: false, reason: 'No audio stream found.' };
    const duration = Number(json.format?.duration ?? audio.duration ?? 0);
    if (!Number.isFinite(duration) || duration <= 0) {
      return { ok: false, reason: 'Could not read the audio duration.' };
    }
    return {
      ok: true,
      durationSeconds: duration,
      container: String(json.format?.format_name ?? ''),
    };
  } catch {
    return { ok: false, reason: 'ffprobe output could not be parsed.' };
  }
}

/**
 * Validates a seller music upload: allowed MIME + a real audio stream +
 * within the 30-second cap (the cap is enforced HERE, server-side — the
 * browser check is convenience only).
 */
export async function validateAudioFile(
  tmpPath: string,
  declaredMime: string,
  opts?: { maxDurationSeconds?: number },
): Promise<{ ok: true; durationSeconds: number } | { ok: false; reason: string }> {
  if (!MUSIC_ALLOWED_MIME.has(declaredMime.toLowerCase())) {
    return {
      ok: false,
      reason: 'Unsupported audio type. Allowed: MP3, M4A/AAC, WAV, OGG, WebM, FLAC.',
    };
  }
  const probe = await probeAudio(tmpPath);
  if (!probe.ok) return { ok: false, reason: probe.reason ?? 'Not a valid audio file.' };

  const max = opts?.maxDurationSeconds ?? MUSIC_MAX_SECONDS;
  const duration = probe.durationSeconds ?? 0;
  if (!musicDurationOk(duration, max)) {
    return {
      ok: false,
      reason: `Music is too long (${Math.round(duration)}s). The maximum is ${max} seconds.`,
    };
  }
  return { ok: true, durationSeconds: Math.round(duration * 10) / 10 };
}

/**
 * Transcodes the video in tmp to an optimized H.264/AAC MP4 (≤720p),
 * generates a thumbnail, and promotes both into permanent storage.
 */
export async function processVideo(
  tmpPath: string,
  opts?: { destDir?: string },
): Promise<ProcessedVideo> {
  const id = generateMediaId();
  const workDir = path.join(path.dirname(tmpPath), `vid-${id}`);
  const outTmp = path.join(workDir, 'out.mp4');
  const thumbTmp = path.join(workDir, 'thumb.jpg');
  await fsp.mkdir(workDir, { recursive: true });

  try {
    const maxHeight = MEDIA_CONFIG.VIDEO_MAX_HEIGHT;
    const crf = MEDIA_CONFIG.VIDEO_LOSSLESS ? 0 : MEDIA_CONFIG.VIDEO_CRF;
    const preset = MEDIA_CONFIG.VIDEO_LOSSLESS ? 'veryslow' : MEDIA_CONFIG.VIDEO_PRESET;

    // Scale to at most `maxHeight` (even height for h264); never upscale:
    // if the source is shorter than the cap, min(ih,cap) = ih → unchanged size.
    const vf = `scale=-2:'min(ih,${maxHeight})'`;

    // 1. Transcode: H.264 + AAC, visually lossless (CRF 18 by default), faststart
    //    for web streaming. VIDNOV_VIDEO_CRF / VIDNOV_VIDEO_LOSSLESS tune this.
    const enc = await run('ffmpeg', [
      '-y',
      '-i', tmpPath,
      '-vf', vf,
      '-c:v', 'libx264',
      '-preset', preset,
      '-crf', String(crf),
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-c:a', 'aac',
      '-b:a', '96k',
      '-ac', '2',
      '-max_muxing_queue_size', '1024',
      outTmp,
    ]);
    if (enc.code !== 0) {
      throw new Error(`Video processing failed (ffmpeg exit ${enc.code}).`);
    }

    // 2. One thumbnail from ~10% into the video (fallback to first frame).
    const probe = await probeVideo(outTmp);
    /*
     * NEVER seek to or past the end of the clip. ffmpeg happily exits 0 while
     * writing NO file at all when the seek lands at/after EOF — a 1-second
     * clip seeked to t=1 is the exact case — and the promote below then dies
     * with `ENOENT … copyfile …/thumb.jpg`, marking the whole upload FAILED
     * even though the transcode itself succeeded. Short clips take the first
     * frame; longer ones seek to 10% but stay strictly inside the duration.
     */
    const duration = probe.ok ? (probe.durationSeconds ?? 0) : 0;
    const thumbAt =
      duration > 2
        ? String(Math.min(Math.max(1, Math.floor(duration * 0.1)), Math.max(1, Math.floor(duration) - 1)))
        : '0';
    const thumbFilter = `scale='min(${MEDIA_CONFIG.THUMBNAIL_DIMENSION},iw)':-2`;
    let thumb = await run('ffmpeg', [
      '-y',
      '-ss', thumbAt,
      '-i', outTmp,
      '-vframes', '1',
      '-vf', thumbFilter,
      '-q:v', '4',
      thumbTmp,
    ]);
    if (thumb.code !== 0 || !(await fileExists(thumbTmp))) {
      // Fallback: no seek at all — the first frame always exists.
      thumb = await run('ffmpeg', [
        '-y',
        '-i', outTmp,
        '-vframes', '1',
        '-vf', thumbFilter,
        '-q:v', '4',
        thumbTmp,
      ]);
      if (thumb.code !== 0 || !(await fileExists(thumbTmp))) {
        throw new Error('Video thumbnail generation failed.');
      }
    }

    // 3. Promote into permanent storage (atomic renames). Marketplace
    // attachments go to their requests/<owner> folder; general media to videos/.
    const videoRel = opts?.destDir
      ? path.join(opts.destDir, `${id}.mp4`)
      : path.join('videos', dateFolder(), `${id}.mp4`);
    const thumbRel = opts?.destDir
      ? path.join(opts.destDir, `${id}_t.jpg`)
      : path.join('thumbnails', dateFolder(), `${id}_t.jpg`);
    await promoteFile(outTmp, path.join(MEDIA_ROOT, videoRel));
    await promoteFile(thumbTmp, path.join(MEDIA_ROOT, thumbRel));

    const [videoStat, thumbStat] = await Promise.all([
      fsp.stat(path.join(MEDIA_ROOT, videoRel)),
      fsp.stat(path.join(MEDIA_ROOT, thumbRel)),
    ]);

    return {
      storagePath: videoRel,
      thumbnailPath: thumbRel,
      mimeType: 'video/mp4',
      sizeBytes: videoStat.size,
      thumbnailSizeBytes: thumbStat.size,
      width: probe.width ?? 0,
      height: Math.min(probe.height ?? maxHeight, maxHeight),
      durationSeconds: Math.round((probe.durationSeconds ?? 0) * 10) / 10,
    };
  } finally {
    // Always remove the working dir (contains temp ffmpeg outputs).
    await fsp.rm(workDir, { recursive: true, force: true });
  }
}
