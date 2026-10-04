/**
 * Lists the Gemini API models available to the configured API key.
 * Only model ids / supported methods are printed — the key is never logged.
 *
 * Usage: npx tsx scripts/list-gemini-models.ts
 */
async function main() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.log('GEMINI_API_KEY is not set.');
    return;
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${key}`,
  );
  const out = (await res.json()) as {
    models?: { name: string; supportedGenerationMethods?: string[] }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    console.log('status', res.status, JSON.stringify(out.error));
    return;
  }
  const interesting = (out.models ?? []).filter((m) =>
    /imagen|veo|image|video/i.test(m.name),
  );
  console.log('image/video models:');
  for (const m of interesting) {
    console.log(`- ${m.name.replace('models/', '')}  [${(m.supportedGenerationMethods ?? []).join(', ')}]`);
  }
  console.log(`\ntotal models: ${out.models?.length ?? 0}`);
}

main().catch((e) => console.error('failed:', e?.message ?? e));