/**
 * One-time backfill: Firestore → PocketBase for the products section.
 *
 * Copies every `products` document (the full listing: name, description,
 * media arrays, price, stock, likes…) to the `products` collection on the
 * local PocketBase instance, so the catalog survives whatever Firestore does.
 * Timestamps are converted to ISO strings on the way across.
 *
 * Safe to re-run: listings already copied (matched by their original
 * Firestore id in `fsId`) are skipped, so an interrupted run resumes.
 *
 * Usage (from the project root on the VPS, with env loaded):
 *   npx -y tsx scripts/migrate-products.ts
 *
 * Requires the same env the app uses, plus:
 *   POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD
 *
 * Firebase credentials resolve exactly like src/firebase/server.ts
 * (GOOGLE_APPLICATION_CREDENTIALS → FIREBASE_SERVICE_ACCOUNT_JSON →
 * ./service-account.json → ADC).
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import {
  ensureCollection,
  pbListRecords,
  pbCreateRecord,
  getPocketBaseConfig,
  type PbField,
} from '../src/lib/pocketbase/server';
import { PRODUCTS_COLLECTION } from '../src/lib/pocketbase/products';

function initFirebase() {
  if (getApps().length > 0) return;
  const adcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const localPath = path.join(process.cwd(), 'service-account.json');
  if (adcPath && fs.existsSync(adcPath)) {
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(adcPath, 'utf8'))) });
  } else if (inline) {
    initializeApp({ credential: cert(JSON.parse(inline)) });
  } else if (fs.existsSync(localPath)) {
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(localPath, 'utf8'))) });
  } else {
    initializeApp(); // ADC fallback
  }
}

/** Firestore Timestamp / Date / string → ISO string (or null). */
function iso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  const t = value as { toDate?: () => Date };
  return t.toDate?.().toISOString() ?? null;
}

/** Recursively convert Timestamps to ISO strings; drop FieldValue junk. */
function scrub(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(scrub);
  const maybeDate = value as { toDate?: () => Date };
  if (typeof maybeDate.toDate === 'function') {
    try {
      return maybeDate.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrub(v);
    }
    return out;
  }
  return null;
}

const PRODUCT_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true },
  { name: 'sellerId', type: 'text' },
  { name: 'name', type: 'text' },
  { name: 'category', type: 'text' },
  { name: 'listingType', type: 'text' },
  { name: 'price', type: 'number' },
  { name: 'stock', type: 'number' },
  { name: 'imageUrl', type: 'text' },
  { name: 'status', type: 'text' },
  { name: 'createdAt', type: 'date' },
  { name: 'data', type: 'json' },
];

async function main() {
  if (!getPocketBaseConfig()) {
    console.error(
      'PocketBase is not configured. Set POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL\n' +
        'and POCKETBASE_ADMIN_PASSWORD in the environment (e.g. .env) first.',
    );
    process.exit(1);
  }

  initFirebase();
  const db = getFirestore();

  await ensureCollection(PRODUCTS_COLLECTION, PRODUCT_FIELDS);

  // Existing fsIds in PocketBase → skip on re-run.
  const done = new Set<string>();
  for (let page = 1; ; page++) {
    const items = await pbListRecords(PRODUCTS_COLLECTION, { fields: 'fsId', perPage: 500, page });
    for (const r of items) if (typeof r.fsId === 'string') done.add(r.fsId);
    if (items.length < 500) break;
  }

  let copied = 0;
  let skipped = 0;
  let failed = 0;
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q: FirebaseFirestore.Query = db.collection('products').limit(300);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const docSnap of snap.docs) {
      if (done.has(docSnap.id)) {
        skipped++;
        continue;
      }
      const d = docSnap.data() as Record<string, unknown>;
      const clean = scrub(d) as Record<string, unknown>;
      try {
        await pbCreateRecord(PRODUCTS_COLLECTION, {
          fsId: docSnap.id,
          sellerId: clean.sellerId ?? '',
          name: clean.name ?? '',
          category: clean.category ?? '',
          listingType: clean.listingType ?? 'product',
          price: typeof clean.price === 'number' ? clean.price : 0,
          stock: typeof clean.stock === 'number' ? clean.stock : 0,
          imageUrl: clean.imageUrl ?? '',
          status: 'active',
          createdAt: iso(d.uploadDate) ?? iso(d.createdAt),
          data: clean,
        });
        copied++;
      } catch (error) {
        failed++;
        console.error(`  ✗ products/${docSnap.id}:`, (error as Error).message);
      }
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < 300) break;
  }

  console.log('\nDone.');
  console.log(`  products → copied ${copied}, skipped ${skipped}, failed ${failed}`);
  if (failed) {
    console.error('\nSome listings failed — re-run this script to retry just those.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal:', error);
  process.exit(1);
});
