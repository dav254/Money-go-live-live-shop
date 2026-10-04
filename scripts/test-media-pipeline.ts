/**
 * Dev-only diagnostic: exercises the image + video processing pipelines
 * WITHOUT Firestore. Verifies sharp/ffmpeg work on this host.
 * Run: npx tsx scripts/test-media-pipeline.ts
 */
import * as path from 'path';
import * as fsp from 'fs/promises';
import * as os from 'os';
import sharp from 'sharp';
import { spawnSync } from 'child_process';

async function main() {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'vidnov-test-'));
  console.log('[1] tmp dir:', tmp);

  // --- IMAGE PIPELINE ---
  const imgPath = path.join(tmp, 'test.jpg');
  await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 255, g: 77, b: 46 } } })
    .jpeg()
    .toFile(imgPath);
  console.log('[2] test image written');

  const { processImage } = await import('../src/lib/media/image');
  const imgResult = await processImage(imgPath, 'test.jpg', { destDir: 'requests/test_request' });
  console.log('[3] processImage OK →', JSON.stringify(imgResult, null, 2));

  // --- VIDEO PIPELINE ---
  const vidPath = path.join(tmp, 'test.mp4');
  const gen = spawnSync('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=320x240:rate=15',
    '-pix_fmt', 'yuv420p', vidPath,
  ], { stdio: 'ignore' });
  if (gen.status !== 0) throw new Error('ffmpeg testsrc generation failed');
  console.log('[4] test video written (2s)');

  const { processVideo } = await import('../src/lib/media/video');
  const vidResult = await processVideo(vidPath, { destDir: 'requests/test_request' });
  console.log('[5] processVideo OK →', JSON.stringify(vidResult, null, 2));

  // cleanup test outputs
  await fsp.rm(path.join('/var/lib/vidnov/media', 'requests', 'test_request'), { recursive: true, force: true });
  await fsp.rm(tmp, { recursive: true, force: true });
  console.log('[6] ALL PIPELINES PASS — server-side processing works on this host');
}

main().catch((err) => {
  console.error('PIPELINE FAILURE:', err);
  process.exit(1);
});
