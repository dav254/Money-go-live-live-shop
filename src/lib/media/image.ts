import * as path from 'path';
import * as fsp from 'fs/promises';
import sharp from 'sharp';
import { MEDIA_CONFIG, MEDIA_ROOT, dateFolder, ALLOWED_IMAGE_MIME } from './config';
import { promoteFile } from './storage';

/**
 * Image pipeline (spec section 1):
 * validate → strip metadata → resize only if larger than the cap (never
 * upscale) → WebP. Encoding is LOSSLESS by default: the file gets smaller
 * than the source JPEG/PNG but no pixel is altered, and metadata (EXIF/GPS)
 * is always removed for privacy. Set VIDNOV_IMAGE_LOSSLESS=false for the
 * smaller lossy encode. Finally a thumbnail (max 400px) is written next to
 * it; the original upload is deleted by the caller after the DB record is
 * written.
 */

export interface ProcessedImage {
  storagePath: string; // relative to MEDIA_ROOT
  thumbnailPath: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailSizeBytes: number;
  width: number;
  height: number;
}

export interface ImageValidationResult {
  ok: boolean;
  reason?: string;
  width?: number;
  height?: number;
  format?: string;
}

/** Magic-byte sniffing — never trust the client-supplied MIME type. */
function detectImageFormat(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  // GIF: GIF8
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'gif';
  // WEBP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return 'webp';
  return null;
}

export function validateImageMime(mime: string): boolean {
  return ALLOWED_IMAGE_MIME.has(mime.toLowerCase());
}

/** Validates actual content format + dimensions using sharp metadata. */
export async function validateImageContent(
  buf: Buffer,
  declaredMime: string,
): Promise<ImageValidationResult> {
  const sniffed = detectImageFormat(buf);
  if (!sniffed) return { ok: false, reason: 'Unrecognized or unsupported image file.' };

  // Declared MIME must roughly match actual content (image/* families)
  const familyOk =
    declaredMime.toLowerCase().includes(sniffed) ||
    (sniffed === 'jpeg' && declaredMime.includes('jpg')) ||
    (sniffed === 'jpeg' && declaredMime.includes('jpeg'));
  if (!familyOk) {
    return { ok: false, reason: 'File content does not match its declared type.' };
  }

  try {
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) return { ok: false, reason: 'Could not read image dimensions.' };
    return { ok: true, width: meta.width, height: meta.height, format: sniffed };
  } catch {
    return { ok: false, reason: 'Corrupted or unsupported image file.' };
  }
}

/** Builds the YYYY/MM storage path under media/images/, or a custom
 *  destination folder (request/offer attachments). */
function imageDest(fileName: string, destDir?: string): string {
  if (destDir) return path.join(destDir, fileName);
  return path.join('images', dateFolder(), fileName);
}
function thumbDest(fileName: string, destDir?: string): string {
  if (destDir) return path.join(destDir, fileName);
  return path.join('thumbnails', dateFolder(), fileName);
}

/**
 * Processes an uploaded image from tmpPath and promotes optimized files
 * into permanent storage. Returns relative paths + metadata for the DB.
 */
export async function processImage(
  tmpPath: string,
  originalName: string,
  opts?: { destDir?: string },
): Promise<ProcessedImage> {
  const buf = await fsp.readFile(tmpPath);
  const maxDim = MEDIA_CONFIG.IMAGE_MAX_DIMENSION;
  const q = MEDIA_CONFIG.IMAGE_QUALITY;
  const lossless = MEDIA_CONFIG.IMAGE_LOSSLESS;
  const thumbDim = MEDIA_CONFIG.THUMBNAIL_DIMENSION;

  /** Lossless WebP (default) or the smaller lossy encode. */
  const encode = () =>
    lossless
      ? { lossless: true as const, effort: MEDIA_CONFIG.IMAGE_LOSSLESS_EFFORT }
      : { quality: q };

  const pipeline = sharp(buf, { failOn: 'error' }).rotate(); // respect EXIF orientation
  const meta = await pipeline.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  // Resize only if larger than the cap — never upscale.
  const needsResize = Math.max(width, height) > maxDim;
  const main = needsResize
    ? pipeline.resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true })
    : pipeline;

  // Main image: WebP, metadata stripped (lossless unless configured otherwise).
  const mainBuf = await main.webp(encode()).toBuffer();
  const mainMeta = await sharp(mainBuf).metadata();

  // Thumbnail: max 400px, WebP (small + fast for feeds).
  const thumbBuf = await sharp(buf)
    .rotate()
    .resize({ width: thumbDim, height: thumbDim, fit: 'inside', withoutEnlargement: true })
    .webp(lossless ? { lossless: true, effort: 4 } : { quality: Math.min(q, 75) })
    .toBuffer();

  // Generate our own opaque filenames — user input never touches the path.
  const id = generateMediaId();
  const mainName = `${id}.webp`;
  const thumbName = `${id}_t.webp`;

  const mainRel = imageDest(mainName, opts?.destDir);
  const thumbRel = thumbDest(thumbName, opts?.destDir);

  // Write via tmp promote (atomic rename on same FS).
  const mainTmp = path.join(path.dirname(tmpPath), `${id}.main.tmp`);
  const thumbTmp = path.join(path.dirname(tmpPath), `${id}.thumb.tmp`);
  await fsp.writeFile(mainTmp, mainBuf);
  await fsp.writeFile(thumbTmp, thumbBuf);
  await promoteFile(mainTmp, path.join(MEDIA_ROOT, mainRel));
  await promoteFile(thumbTmp, path.join(MEDIA_ROOT, thumbRel));

  return {
    storagePath: mainRel,
    thumbnailPath: thumbRel,
    mimeType: 'image/webp',
    sizeBytes: mainBuf.length,
    thumbnailSizeBytes: thumbBuf.length,
    width: mainMeta.width ?? width,
    height: mainMeta.height ?? height,
  };
}

/** Shared opaque ID generator (also used by the video pipeline). */
export function generateMediaId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
