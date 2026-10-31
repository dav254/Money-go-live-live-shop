/**
 * THE MANUAL "COME RE-CRAWL NOW" COMMAND for the AI exposure engine.
 *
 *   npx tsx scripts/ping-indexnow.ts              # honours INDEXNOW_ENABLED
 *   npx tsx scripts/ping-indexnow.ts --force      # ping once regardless
 *   npx tsx scripts/ping-indexnow.ts --force /products/abc123 /sellers/xyz
 *   (or, via package script: bun run ping:search -- --force)
 *
 * ## What it does
 * Submits the given site-relative URLs to IndexNow (Bing, DuckDuckGo,
 * Yandex, Seznam) so they are re-crawled in minutes instead of days. With no
 * paths given it pings the discovery surfaces that matter for AI agents:
 * home, `/llms.txt` and `/products.json`.
 *
 * ## Which side is automatic?
 * Listing create/edit/delete already pings from the app itself — gated by
 * the `INDEXNOW_ENABLED` flag (`src/lib/seo/indexnow.ts`). This command is
 * the deliberate override: `--force` sets that flag for THIS run only, so a
 * human asking for a ping always gets one without editing any environment.
 *
 * ## Before the first run
 * IndexNow receivers verify the key file at `/indexnow-key.txt`; it ships
 * with this codebase, so run this AFTER deploying — a 404 key location makes
 * receivers ignore the batch. Output is status-only, never response bodies.
 *
 * Google does not use IndexNow: Google is served by `/sitemap.xml`
 * (submit it once in Google Search Console).
 */
import { indexnowEnabled, pingIndexNow } from '../src/lib/seo/indexnow';

/** The discovery surfaces AI agents fetch — pings with no paths given. */
const DEFAULT_PATHS = ['/', '/llms.txt', '/products.json'];

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const extra = args
    .filter((arg) => arg !== '--force')
    .map((arg) => (arg.startsWith('/') ? arg : `/${arg}`));

  if (force) {
    // An explicit human request IS the consent this run needs; the flag
    // keeps guarding the automatic fire-and-forget pings only.
    process.env.INDEXNOW_ENABLED = 'true';
  } else if (!indexnowEnabled()) {
    console.log('Automatic pings are off (INDEXNOW_ENABLED is not "true").');
    console.log('Run again with --force to ping once anyway.');
    return;
  }

  const paths = extra.length ? extra : DEFAULT_PATHS;
  const result = await pingIndexNow(paths);

  if (result.sent) {
    console.log(`Ping sent for ${paths.length} URL(s) — status ${result.status}.`);
    console.log('Bing/DuckDuckGo/Yandex should re-crawl within minutes to hours.');
    console.log('Google: submit /sitemap.xml in Google Search Console (it does not use IndexNow).');
  } else {
    console.log(`Ping NOT sent (${result.reason ?? 'unknown'}).`);
    if (result.status) console.log(`Receiver answered with status ${result.status}.`);
    process.exitCode = 1;
  }
}

void main();
