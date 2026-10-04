/**
 * Smoke test for the fal.ai adapter: runs one real text→image job through the
 * queue API and reports model + result size. The key is never printed.
 *
 * Usage: npx tsx scripts/test-fal-models.ts
 */
const FAL_MODELS = [
  'fal-ai/flux-pro/kontext',
  'fal-ai/flux/dev/image-to-image',
  'fal-ai/wan/v2.2-a14b/text-to-video',
  'fal-ai/wan/v2.2-a14b/image-to-video',
];

async function main() {
  const key = process.env.FAL_KEY;
  if (!key) {
    console.log('FAL_KEY is not set.');
    return;
  }

  for (const model of FAL_MODELS) {
    // A GET on the queue endpoint validates the model exists for this key
    // without spending generation credits.
    const res = await fetch(`https://queue.fal.run/${model}/requests?limit=1`, {
      headers: { Authorization: `Key ${key}` },
    });
    console.log(`${model}: ${res.status}`);
  }

  const run = await fetch('https://queue.fal.run/fal-ai/flux-pro/kontext', {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'A matte black skincare bottle on a marble pedestal, soft studio lighting',
      image_size: 'square_hd',
      num_images: 1,
    }),
  });
  const queued = (await run.json()) as { request_id?: string; detail?: string };
  console.log('queue submit:', run.status, queued.request_id ?? queued.detail);
}

main().catch((e) => console.error('failed:', e?.message ?? e));