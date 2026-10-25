/**
 * One-time backfill: Firestore → PocketBase for the ORDERS section.
 *
 * Copies every `orders` document (items, timeline, tracking, totals…) to the
 * `orders` collection on the local PocketBase instance, so the seller order
 * screen, the payment webhooks and the admin consoles survive whatever
 * Firestore does. Timestamps are converted to ISO strings on the way across.
 *
 * Safe to re-run: orders already copied (matched by their original Firestore
 * id in `fsId`) are skipped, so an interrupted run resumes.
 *
 * Usage (from the project root, with env loaded):
 *   npx -y tsx scripts/migrate-orders.ts
 *
 * Requires POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD
 * plus Firebase credentials resolving exactly like src/firebase/server.ts
 * (GOOGLE_APPLICATION_CREDENTIALS → FIREBASE_SERVICE_ACCOUNT_JSON →
 * ./service-account.json → ADC).
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import {
  ensureCollection,
  pbListRecords,
  pbCreateRecord,
  getPocketBaseConfig,
  scrubForPocketBase,
} from '../src/lib/pocketbase/server';
import { ORDERS_COLLECTION, ORDER_FIELDS } from '../src/lib/pocketbase/orders';

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

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const iso = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

async function copyOrders(
  db: Firestore,
): Promise<{ copied: number; skipped: number; failed: number }> {
  await ensureCollection(ORDERS_COLLECTION, ORDER_FIELDS);

  const done = new Set<string>();
  for (let page = 1; ; page++) {
    const items = await pbListRecords(ORDERS_COLLECTION, { fields: 'fsId', perPage: 500, page });
    for (const r of items) if (typeof r.fsId === 'string') done.add(r.fsId);
    if (items.length < 500) break;
  }

  let copied = 0;
  let skipped = 0;
  let failed = 0;
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q: FirebaseFirestore.Query = db.collection('orders').limit(300);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      if (done.has(doc.id)) {
        skipped++;
        continue;
      }
      const data = scrubForPocketBase(doc.data()) as Record<string, unknown>;
      try {
        await pbCreateRecord(ORDERS_COLLECTION, {
          fsId: doc.id,
          sellerId: str(data.sellerId) ?? '',
          buyerId: str(data.buyerId) ?? '',
          resellerId: str(data.resellerId) ?? '',
          orderStatus: str(data.orderStatus) ?? '',
          totalAmount: num(data.totalAmount) ?? 0,
          orderDate: iso(data.orderDate),
          createdAt: iso(data.createdAt) ?? iso(data.orderDate),
          data,
        });
        copied++;
      } catch (error) {
        failed++;
        console.error(`  ✗ orders/${doc.id}:`, (error as Error).message);
      }
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < 300) break;
  }
  return { copied, skipped, failed };
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

  console.log(`Backing up orders → ${ORDERS_COLLECTION} …`);
  const orders = await copyOrders(db);
  console.log(`  orders: copied ${orders.copied}, skipped ${orders.skipped}, failed ${orders.failed}`);

  console.log('\nDone.');
  if (orders.failed) {
    console.error('Some records failed — re-run this script to retry just those.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
