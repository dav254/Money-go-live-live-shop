/**
 * Runs one real text→image job through the AI Studio provider chain
 * (fal.ai) to prove the wiring works. The key is never printed.
 *
 * Usage: npx tsx scripts/test-fal-studio-image.ts
 */
import { falTextToImage } from '../src/lib/ai/fal-adapter';

async function main() {
  const started = Date.now();
  const out = await falTextToImage({
    prompt: 'A matte black skincare bottle on a marble pedestal, soft studio lighting',
    aspectRatio: '1:1',
    quality: 'standard',
  });
  console.log('model:', out.model);
  console.log('mime:', out.mimeType);
  console.log('bytes:', out.imageBuffer.length);
  console.log('took:', `${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error('FAILED:', e?.message ?? e);
  process.exit(1);
});