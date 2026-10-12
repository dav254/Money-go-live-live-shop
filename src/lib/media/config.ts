import * as path from 'path';
import { MAX_VIDEO_SECONDS } from '@/lib/listings/limits';

/**
 * Vidnov media system — central configuration.
 *
 * All limits are environment-configurable; these are safe production
 * defaults for a small VPS. Never expose secret values to the browser —
 * only import this module from server code.
 */

function num(env: string | undefined, fallback: number): number {
  const parsed = Number(env);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function bool(env: string | undefined, fallback: boolean): boolean {
  if (env === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(env.trim());
}

export const MEDIA_CONFIG = {
  // Images
  IMAGE_MAX_UPLOAD_MB: num(process.env.VIDNOV_MAX_IMAGE_UPLOAD_MB, 10),
  IMAGE_MAX_DIMENSION: num(process.env.VIDNOV_MAX_IMAGE_DIMENSION, 2048),
  /**
   * WebP quality for the stored copy. 92 is the practical sweet spot: the
   * result is visually indistinguishable from the source at a fraction of the
   * size of the original JPEG/PNG. Lower it (e.g. 80) to save more disk/bandwidth.
   */
  IMAGE_QUALITY: num(process.env.VIDNOV_IMAGE_QUALITY, 92),
  /**
   * True lossless WebP (pixel-identical). Off by default because it is 4-6x
   * larger than q92 for photos with no visible benefit — turn it on only for
   * material that must never be re-encoded (e.g. design masters).
   */
  IMAGE_LOSSLESS: bool(process.env.VIDNOV_IMAGE_LOSSLESS, false),
  IMAGE_LOSSLESS_EFFORT: num(process.env.VIDNOV_IMAGE_LOSSLESS_EFFORT, 6),
  THUMBNAIL_DIMENSION: num(process.env.VIDNOV_THUMBNAIL_DIMENSION, 400),

  // Videos
  VIDEO_MAX_UPLOAD_MB: num(process.env.VIDNOV_MAX_VIDEO_UPLOAD_MB, 500),
  VIDEO_MAX_DURATION_SECONDS: num(process.env.VIDNOV_MAX_VIDEO_DURATION_SECONDS, MAX_VIDEO_SECONDS),
  VIDEO_MAX_HEIGHT: num(process.env.VIDNOV_VIDEO_MAX_HEIGHT, 1080),
  /**
   * H.264 CRF 28, not 18.
   *
   * CRF 18 is visually lossless, and the difference between 18 and 28 is
   * invisible on a 400px phone thumbnail in a scrolling feed — which is where
   * every one of these clips is actually watched. At 28 the stored file is
   * roughly half the size, and because there is no CDN in front of
   * `/api/media/serve`, that saving is paid TWICE: once on disk, and again on
   * every view.
   *
   * `VIDNOV_VIDEO_CRF=18` goes back to near-master; `VIDNOV_VIDEO_LOSSLESS=true`
   * is a true master copy. Neither is what a marketplace feed should be stored
   * at.
   */
  VIDEO_CRF: num(process.env.VIDNOV_VIDEO_CRF, 28),
  VIDEO_LOSSLESS: bool(process.env.VIDNOV_VIDEO_LOSSLESS, false),
  VIDEO_PRESET: process.env.VIDNOV_VIDEO_PRESET || 'slow',

  // Request marketplace limits (spec §25) — raise later on bigger servers.
  REQUEST_VIDEO_MAX_DURATION_SECONDS: num(
    process.env.VIDNOV_MAX_REQUEST_VIDEO_DURATION_SECONDS,
    MAX_VIDEO_SECONDS,
  ),
  REQUEST_VIDEO_MAX_UPLOAD_MB: num(process.env.VIDNOV_MAX_REQUEST_VIDEO_SIZE_MB, 500),
  REQUEST_MAX_IMAGES: num(process.env.VIDNOV_MAX_REQUEST_IMAGES, 8),
  REQUEST_MAX_VIDEOS: num(process.env.VIDNOV_MAX_REQUEST_VIDEOS, 8),
  OFFER_MAX_IMAGES: num(process.env.VIDNOV_MAX_OFFER_IMAGES, 5),
  OFFER_MAX_VIDEOS: num(process.env.VIDNOV_MAX_OFFER_VIDEOS, 2),

  // Generic FILE uploads stored as-is into a user folder (chat attachments,
  // support tickets, verification documents). Not transcoded — kept byte for
  // byte, so the cap stays small on purpose.
  FILE_MAX_UPLOAD_MB: num(process.env.VIDNOV_MAX_FILE_UPLOAD_MB, 25),
  // Deleted request media retention before hard deletion (days, spec §33/34).
  DELETED_MEDIA_RETENTION_DAYS: num(process.env.VIDNOV_DELETED_MEDIA_RETENTION_DAYS, 7),

  // Storage protection thresholds (% of disk used)
  STORAGE_WARNING_PERCENT: num(process.env.VIDNOV_STORAGE_WARNING_PERCENT, 70),
  STORAGE_HIGH_PERCENT: num(process.env.VIDNOV_STORAGE_HIGH_PERCENT, 80),
  STORAGE_CRITICAL_PERCENT: num(process.env.VIDNOV_STORAGE_CRITICAL_PERCENT, 90),
  STORAGE_EMERGENCY_PERCENT: num(process.env.VIDNOV_STORAGE_EMERGENCY_PERCENT, 95),

  // Temp file retention (minutes) before the cleanup sweeper removes
  // abandoned uploads. Uploads in a vid-* work dir are removed by the
  // pipeline's finally block, so that is not what this setting protects.
  TEMP_RETENTION_MINUTES: num(process.env.VIDNOV_TEMP_RETENTION_MINUTES, 20),
  // Maximum open uploads the cron loop may sweep per invocation (0 = unlimited).
  // Crew use 0/1 when they run it by hand; CI use 1 so a sweep of a full disk
  // cannot bounce a build for minutes.
  MAX_TEMP_BEFORE_CRON: num(process.env.VIDNOV_MAX_TEMP_BEFORE_CRON, 1),
  /**
   * Enables the cron entry point. Off by default — a build can only consume
   * the temp directory while it is actively being filled, so it is safe to
   * disable for CI and local runs.
   */
  CRON_ENABLED: bool(process.env.VIDNOV_CRON_ENABLED, false),
} as const;

/** Root for all permanent (processed) media. */
export const MEDIA_ROOT = process.env.VIDNOV_MEDIA_ROOT || '/var/lib/vidnov/media';
/** Root for temporary in-flight uploads. */
export const MEDIA_TMP_ROOT = process.env.VIDNOV_TMP_ROOT || '/var/lib/vidnov/tmp';

/** Firestore collection holding one record per media file. */
export const MEDIA_COLLECTION = 'media';

/** Storage namespaces. Public namespaces live under images/videos/thumbnails;
 *  request/offer media lives under requests/<ownerId>/ with PRIVATE delivery. */
export type MediaNamespace = 'general' | 'requests' | 'offers';

/** Firestore collections for the request marketplace. */
export const REQUESTS_COLLECTION = 'requests';
export const OFFERS_COLLECTION = 'offers';

/** Privacy statuses for stored media (spec §32–33). */
export type StorageState = 'LOCAL_ONLY' | 'SYNCED' | 'PUBLISHED';
export type MediaVisibility = 'PRIVATE' | 'PUBLIC';

export const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const ALLOWED_VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
  'video/x-matroska', // .mkv
]);

/** Resolves a YYYY/MM subfolder for the current date. */
export function dateFolder(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}/${m}`;
}

/**
 * Destination folder for private request/offer media (spec §26):
 * media/requests/request_<id>/ or media/requests/offer_<id>/ — one folder
 * per request/offer so deletion and quotas are trivial.
 * ownerId guards the folder name so client-supplied ids can never traverse.
 */
export function requestFolder(requestId: string): string {
  return path.join('requests', sanitizeSegment(`request_${requestId}`));
}
export function offerFolder(offerId: string): string {
  return path.join('requests', sanitizeSegment(`offer_${offerId}`));
}

function sanitizeSegment(segment: string): string {
  return segment.replace(/[^\w-]+/g, '_').slice(0, 80);
}
