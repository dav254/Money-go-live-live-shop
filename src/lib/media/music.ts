/**
 * SELLER MUSIC UPLOADS — the 30-second rule and folder contract.
 *
 * Sellers can upload their own music into the app (spec: "seller can upload
 * music, the duration 30 seconds only"). The bytes go through the existing
 * disk media engine into an owner-scoped folder:
 *
 *     music/<sellerUid>/<mediaId>.mp3
 *
 * Ownership is enforced by the engine's folder resolver (same rule as
 * avatars/products: only the uploader may write under their own uid), so a
 * seller can never place a file into someone else's music folder. Duration is
 * enforced server-side with ffprobe (see `validateAudioFile` in video.ts) —
 * the browser check in the upload UI is convenience only, never the gate.
 *
 * This module is PURE (no fs, no ffmpeg, no database) so the limits are
 * unit-testable: src/tests/music-uploads.test.ts.
 */

/** Hard cap for a seller music clip, in seconds (spec: 30 seconds only). */
export const MUSIC_MAX_SECONDS = 30;

/**
 * ffprobe reports container durations a fraction over the nominal length
 * (a "30s" MP3 often probes as 30.04–30.4s), so the gate allows half a
 * second of rounding — a 31s file is still rejected.
 */
export const MUSIC_DURATION_TOLERANCE_SECONDS = 0.5;

/** Owner-folder root for music uploads (must match FOLDER_ROOTS in engine.ts). */
export const MUSIC_FOLDER_ROOT = 'music';

/** Audio types accepted for music uploads (same set the engine stores raw). */
export const MUSIC_ALLOWED_MIME = new Set([
  'audio/mpeg', // .mp3
  'audio/mp4', // .m4a
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
]);

/** The owner-scoped folder a seller's music uploads go to. */
export function musicFolderFor(uid: string): string {
  return `${MUSIC_FOLDER_ROOT}/${uid}`;
}

/** True when a resolved destination folder is the music root. */
export function isMusicFolder(folder: string | undefined | null): boolean {
  if (!folder) return false;
  const clean = folder.replace(/^\/+|\/+$/g, '');
  return clean === MUSIC_FOLDER_ROOT || clean.startsWith(`${MUSIC_FOLDER_ROOT}/`);
}

/** True when a stored relative path lives under the music folder. */
export function isMusicPath(relPath: string | undefined | null): boolean {
  if (!relPath) return false;
  return relPath.replace(/^\/+/, '').startsWith(`${MUSIC_FOLDER_ROOT}/`);
}

/**
 * The duration gate: finite, positive, and within the cap (plus rounding
 * tolerance). Anything unmeasurable is NOT within the cap — a file whose
 * duration ffprobe could not read is rejected rather than waved through.
 */
export function musicDurationOk(
  seconds: number,
  maxSeconds: number = MUSIC_MAX_SECONDS,
): boolean {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return false;
  return seconds <= maxSeconds + MUSIC_DURATION_TOLERANCE_SECONDS;
}