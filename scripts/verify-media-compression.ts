/**
 * PROOF, NOT A UNIT TEST — run once, numbers printed, file deleted after.
 *
 * Exercises the real `processImage()` against the real MEDIA_ROOT so the
 * "compress it but keep the quality" claim rests on a measurement rather than
 * on reading the config file. Nothing here is imported by the app.
 */
import * as fsp from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { processImage } from '../src/lib/media/image';
import { MEDIA_CONFIG, MEDIA_ROOT, MEDIA_TMP_ROOT } from '../src/lib/media/config';

async function main() {
  // A photo-sized canvas with real detail (gradient + XOR structure), 3000x2000
  // like a phone landscape shot, written as quality-100 JPEG.
  const width = 3000;
  const height = 2000;
  const raw = Buffer.alloc(width * height * 3);
  for (let p = 0, i = 0; p < width * height; p++, i += 3) {
    const x = p % width;
    const y = (p / width) | 0;
    raw[i] = (x * 255) / width;
    raw[i + 1] = (y * 255) / height;
    raw[i + 2] = (x ^ y) & 0xff;
  }
  const jpeg = await sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 100 })
    .toBuffer();

  await fsp.mkdir(MEDIA_TMP_ROOT, { recursive: true });
  const tmp = path.join(MEDIA_TMP_ROOT, `verify_${Date.now()}.jpg`);
  await fsp.writeFile(tmp, jpeg);

  const result = await processImage(tmp, 'verify.jpg');
  const storedAbs = path.join(MEDIA_ROOT, result.storagePath);
  const thumbAbs = path.join(MEDIA_ROOT, result.thumbnailPath);
  const stored = await fsp.stat(storedAbs);
  const thumb = await fsp.stat(thumbAbs);
  const meta = await sharp(storedAbs).metadata();

  console.log(
    JSON.stringify(
      {
        input: { bytes: jpeg.length, width, height, format: 'jpeg' },
        stored: {
          bytes: stored.size,
          width: meta.width,
          height: meta.height,
          format: meta.format,
          onDisk: storedAbs,
        },
        thumbnail: { bytes: thumb.size, path: thumbAbs },
        sizeRatio: Number((stored.size / jpeg.length).toFixed(3)),
        settings: {
          maxDimension: MEDIA_CONFIG.IMAGE_MAX_DIMENSION,
          quality: MEDIA_CONFIG.IMAGE_QUALITY,
          thumbDimension: MEDIA_CONFIG.THUMBNAIL_DIMENSION,
        },
      },
      null,
      2,
    ),
  );

  await fsp.rm(tmp, { force: true });
  await fsp.rm(storedAbs, { force: true });
  await fsp.rm(thumbAbs, { force: true });
}

main().catch((e) => {
  console.error('FAILED', e);
  process.exit(1);
});