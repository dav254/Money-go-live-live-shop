/**
 * One-time backfill: Firestore → PocketBase for the SHOPS section.
 *
 * Copies every `sellerShops/{uid}` document (shop name, logo, banner,
 * category, location, policies, social links…) to the `seller_shops`
 * collection on the local PocketBase instance. The listings behind a shop
 * were already mirrored by migrate-products.ts; without this the storefront
 * itself still vanished whenever Firestore could not answer, leaving the
 * catalog with no shop attached.
 *
 * The Firestore doc id IS the owner's uid, so `fsId` and `ownerId` are the
 * same value and the mirror stays re-runnable.
 *
 * Safe to re-run: shops already copied (matched by their Firestore id in
 * `fsId`) are skipped, so an interrupted run resumes.
 *
 * Usage (from the project root on the VPS, with env loaded):
 *   npx -y tsx scripts/migrate-shops.ts
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
  pbCreateRecord,
  pbListRecords,
  getPocketBaseConfig,
} from '../src/lib/pocketbase/server';
import { SHOPS_COLLECTION, SHOP_FIELDS } from '../src/lib/pocketbase/shops';

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

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

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

  await ensureCollection(SHOPS_COLLECTION, SHOP_FIELDS);

  // Existing fsIds in PocketBase → skip on re-run.
  const done = new Set<string>();
  for (let page = 1; ; page++) {
    const items = await pbListRecords(SHOPS_COLLECTION, { fields: 'fsId', perPage: 500, page });
    for (const r of items) if (typeof r.fsId === 'string') done.add(r.fsId);
    if (items.length < 500) break;
  }

  let copied = 0;
  let skipped = 0;
  let failed = 0;
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q: FirebaseFirestore.Query = db.collection('sellerShops').limit(300);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const docSnap of snap.docs) {
      if (done.has(docSnap.id)) {
        skipped++;
        continue;
      }
      const d = docSnap.data() as Record<string, unknown>;
      try {
        await pbCreateRecord(SHOPS_COLLECTION, {
          fsId: docSnap.id,
          ownerId: docSnap.id,
          shopName: str(d.shopName) || str(d.name),
          category: str(d.category),
          county: str(d.county),
          cityTown: str(d.cityTown),
          logoUrl: str(d.logoUrl),
          data: d,
        });
        copied++;
      } catch (error) {
        failed++;
        console.error(`  ✗ sellerShops/${docSnap.id}:`, (error as Error).message);
      }
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < 300) break;
  }

  console.log('\nDone.');
  console.log(`  sellerShops → copied ${copied}, skipped ${skipped}, failed ${failed}`);
  if (failed) {
    console.error('\nSome shops failed — re-run this script to retry just those.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal:', error);
  process.exit(1);
});
