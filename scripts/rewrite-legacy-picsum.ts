/**
 * Rewrite legacy picsum URLs stored in Firestore.
 *
 * Older builds wrote `https://picsum.photos/seed/...` into product/post media,
 * seller logos and banners. The code stopped generating those, but the rows
 * still carry them, so the feed keeps rendering stock photos. This script
 * rewrites every such string to the local, always-served placeholder.
 *
 * DRY RUN by default — nothing is written until you pass --apply:
 *
 *   npx tsx scripts/rewrite-legacy-picsum.ts            # report only
 *   npx tsx scripts/rewrite-legacy-picsum.ts --apply    # write the changes
 *
 * Credentials (any one of these, same order the app uses):
 *   FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   ./service-account.json
 */
import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Timestamp, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { config as loadEnv } from 'dotenv';
import * as fs from 'fs';

// Load the same env files `next start` loads in production, so the script
// finds Firebase credentials wherever the app finds them.
for (const envFile of ['.env.production', '.env.local', '.env']) {
  try {
    loadEnv({ path: envFile });
  } catch {
    /* file absent — try the next one */
  }
}

const PICSUM = /https?:\/\/(?:www\.)?picsum\.photos\/[^\s"']*/gi;
const REPLACEMENT = '/placeholder-image.svg';
const APPLY = process.argv.includes('--apply');
const REPORT_LIMIT = 8;
const PAGE_SIZE = 100;
const PAGE_PAUSE_MS = 300;

/** --collections=posts,products,sellerShops — scan only what can hold media. */
const COLLECTION_FILTER = (process.argv
  .find((a) => a.startsWith('--collections='))
  ?.split('=')[1] || '')
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Firestore answers RESOURCE_EXHAUSTED when a project's read quota is spent
 * (it resets on its own). Back off and retry instead of dying mid-scan, so a
 * long walk over a big collection survives a transient limit.
 */
async function withQuotaRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const delays = [5_000, 15_000, 45_000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const transient =
        err?.code === 4 || // RESOURCE_EXHAUSTED
        err?.code === 14 || // UNAVAILABLE
        /RESOURCE_EXHAUSTED|UNAVAILABLE|deadline/i.test(String(err?.message));
      if (!transient || attempt >= delays.length) throw err;
      const wait = delays[attempt];
      console.log(`  ⏳ ${label}: quota/transient error — waiting ${wait / 1000}s (attempt ${attempt + 1}/${delays.length})`);
      await sleep(wait);
    }
  }
}

function readFirst(...candidates: Array<string | false | undefined>): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c;
  }
  return '';
}

function loadServiceAccount(): ServiceAccount {
  const raw = readFirst(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
      fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'),
    fs.existsSync('./service-account.json') && fs.readFileSync('./service-account.json', 'utf8'),
  );

  if (!raw) {
    console.error(
      'No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT_JSON, GOOGLE_APPLICATION_CREDENTIALS, or put service-account.json in the app root.',
    );
    process.exit(1);
  }
  return JSON.parse(raw) as ServiceAccount;
}

/**
 * Returns the value with every picsum URL replaced, pushing a readable note
 * of each field it touched into `hits`. Untouched values are returned as-is,
 * so Timestamps, numbers and nulls pass through unchanged.
 */
function replacePicsum(value: unknown, path: string, hits: string[]): unknown {
  if (typeof value === 'string') {
    if (!PICSUM.test(value)) {
      PICSUM.lastIndex = 0;
      return value;
    }
    PICSUM.lastIndex = 0;
    hits.push(`${path}: ${value.slice(0, 90)}`);
    return value.replace(PICSUM, REPLACEMENT);
  }
  if (Array.isArray(value)) {
    return value.map((item, i) => replacePicsum(item, `${path}[${i}]`, hits));
  }
  if (value && typeof value === 'object' && !(value instanceof Timestamp)) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      obj[k] = replacePicsum(v, path ? `${path}.${k}` : k, hits);
    }
    return obj;
  }
  return value;
}

async function main() {
  initializeApp({ credential: cert(loadServiceAccount()) });
  const db = getFirestore();
  console.log(`Mode: ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN (no writes)'}`);

  const listed = await withQuotaRetry(() => db.listCollections(), 'listCollections');
  const collections = COLLECTION_FILTER.length
    ? listed.filter((c) => COLLECTION_FILTER.includes(c.id))
    : listed;
  if (COLLECTION_FILTER.length) {
    const missing = COLLECTION_FILTER.filter((id) => !listed.some((c) => c.id === id));
    if (missing.length) console.log(`(no such collections: ${missing.join(', ')})`);
  }
  console.log(`Scanning ${collections.length} of ${listed.length} collections.\n`);

  let totalDocs = 0;
  let totalChanged = 0;
  const samples: string[] = [];

  for (const col of collections) {
    let docsChanged = 0;
    let docsScanned = 0;
    let cursor: QueryDocumentSnapshot | undefined;

    for (;;) {
      let query = col.orderBy('__name__').limit(PAGE_SIZE);
      if (cursor) query = query.startAfter(cursor);
      const page = await withQuotaRetry(() => query.get(), `${col.id} page`);
      if (page.empty) break;
      cursor = page.docs[page.docs.length - 1] as QueryDocumentSnapshot;
      // Pace the reads — burst traffic is what trips the per-minute quota.
      await sleep(PAGE_PAUSE_MS);

      for (const doc of page.docs) {
        docsScanned++;
        const hits: string[] = [];
        const rewritten = replacePicsum(doc.data(), '', hits) as Record<string, unknown>;
        if (hits.length === 0) continue;

        docsChanged++;
        if (samples.length < REPORT_LIMIT) {
          samples.push(`  ${col.id}/${doc.id}\n${hits.map((h) => `    ${h}`).join('\n')}`);
        }
        if (APPLY) {
          await doc.ref.set(rewritten, { merge: true });
        }
      }
    }

    totalDocs += docsScanned;
    totalChanged += docsChanged;
    if (docsScanned > 0) {
      console.log(
        `${docsChanged > 0 ? '!' : ' '} ${col.id}: ${docsScanned} docs scanned, ${docsChanged} with picsum URLs`,
      );
    }
  }

  console.log(`\nTotal: ${totalDocs} documents scanned, ${totalChanged} affected.`);
  if (samples.length) {
    console.log(`\nSamples:\n${samples.join('\n')}`);
  }
  if (totalChanged === 0) {
    console.log('Nothing to do — no picsum URLs found.');
  } else if (!APPLY) {
    console.log('\nDRY RUN — no changes written. Re-run with --apply to rewrite them.');
  } else {
    console.log('\nDone. Feed images now use the local placeholder.');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
