/**
 * Live smoke test for the Gemini image path (text-to-image).
 * Uses the configured GEMINI_API_KEY — the key is never printed.
 *
 * Usage: npx tsx scripts/test-image-generation.ts
 */
import { imagenBuffer } from '../src/lib/ai/gemini-adapter';

async function main() {
  const started = Date.now();
  const out = await imagenBuffer({
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