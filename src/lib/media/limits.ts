/**
 * MEDIA LIMITS — the browser-safe half of the media configuration.
 *
 * ## Why this file exists at all
 *
 * `config.ts` is the server's source of truth, but it imports `node:path` and
 * reads the media environment, so a client component cannot import it: the
 * bundler would try to resolve a Node built-in for the browser. The UI still
 * needs to know the size cap so it can say "too big" *before* spending the
 * seller's mobile data on an upload that is going to be rejected.
 *
 * So the numbers are declared here as well, read from the same environment
 * variables. That duplication is the risk, which is why
 * `src/tests/media-config.test.ts` asserts the two agree — if someone raises
 * the server cap and forgets this file, that test fails rather than the UI
 * quietly rejecting files the server would have accepted.
 */

/** Same env var as `config.ts`, same fallback. */
function num(env: string | undefined, fallback: number): number {
  const parsed = Number(env);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const IMAGE_LIMITS = {
  /** Largest image the server will accept, in megabytes. */
  maxUploadMb: num(process.env.VIDNOV_MAX_IMAGE_UPLOAD_MB, 10),
  /** Longest edge kept after resizing; the rest is scaled down. */
  maxDimension: num(process.env.VIDNOV_MAX_IMAGE_DIMENSION, 2048),
  /** WebP quality of the stored copy — visually lossless to the eye. */
  quality: num(process.env.VIDNOV_IMAGE_QUALITY, 92),
  /** Video ceiling, shown on the upload screen so nobody is surprised. */
  videoMaxUploadMb: num(process.env.VIDNOV_MAX_VIDEO_UPLOAD_MB, 500),
  videoMaxSeconds: num(process.env.VIDNOV_MAX_VIDEO_DURATION_SECONDS, 600),
} as const;