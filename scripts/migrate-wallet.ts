/**
 * One-time backfill: Firestore → PocketBase for the WALLET section.
 *
 * Copies the three ledger collections to the local PocketBase instance so the
 * money trail survives whatever Firestore does:
 *
 *   `payouts`           → `payouts`            (seller withdrawal requests)
 *   `walletTransactions`→ `wallet_transactions`(credits/debits: refunds…)
 *   `payments`          → `payments`           (money in: gateway webhooks…)
 *
 * Timestamps are converted to ISO strings on the way across.
 *
 * Safe to re-run: records already copied (matched by their original Firestore
 * id in `fsId`) are skipped, so an interrupted run resumes.
 *
 * Usage (from the project root, with env loaded):
 *   npx -y tsx scripts/migrate-wallet.ts
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
import {
  PAYOUTS_COLLECTION,
  PAYOUT_FIELDS,
  WALLET_TRANSACTIONS_COLLECTION,
  WALLET_TRANSACTION_FIELDS,
  PAYMENTS_COLLECTION,
  PAYMENT_FIELDS,
} from '../src/lib/pocketbase/wallet';

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

/** The indexed columns each ledger collection keeps. */
function columnsFor(collection: string, d: Record<string, unknown>): Record<string, unknown> {
  switch (collection) {
    case PAYOUTS_COLLECTION:
      return {
        sellerId: str(d.sellerId) ?? '',
        amount: num(d.amount) ?? 0,
        status: str(d.status) ?? '',
        requestedAt: iso(d.requestedAt) ?? iso(d.createdAt),
        createdAt: iso(d.createdAt) ?? iso(d.requestedAt),
      };
    case WALLET_TRANSACTIONS_COLLECTION:
      return {
        userId: str(d.userId) ?? '',
        orderId: str(d.orderId) ?? '',
        type: str(d.type) ?? '',
        amount: num(d.amount) ?? 0,
        createdAt: iso(d.timestamp) ?? iso(d.createdAt),
      };
    default:
      return {
        orderId: str(d.orderId) ?? '',
        userId: str(d.userId) ?? '',
        amount: num(d.amount) ?? 0,
        paymentMethod: str(d.paymentMethod) ?? '',
        paymentStatus: str(d.paymentStatus) ?? '',
        transactionType: str(d.transactionType) ?? '',
        createdAt: iso(d.paymentDate) ?? iso(d.createdAt),
      };
  }
}

async function copyCollection(
  db: Firestore,
  source: string,
  target: string,
  fields: Parameters<typeof ensureCollection>[1],
): Promise<{ copied: number; skipped: number; failed: number }> {
  await ensureCollection(target, fields);

  const done = new Set<string>();
  for (let page = 1; ; page++) {
    const items = await pbListRecords(target, { fields: 'fsId', perPage: 500, page });
    for (const r of items) if (typeof r.fsId === 'string') done.add(r.fsId);
    if (items.length < 500) break;
  }

  let copied = 0;
  let skipped = 0;
  let failed = 0;
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q: FirebaseFirestore.Query = db.collection(source).limit(300);
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
        await pbCreateRecord(target, { fsId: doc.id, ...columnsFor(target, data), data });
        copied++;
      } catch (error) {
        failed++;
        console.error(`  ✗ ${source}/${doc.id}:`, (error as Error).message);
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

  console.log(`Backing up payouts → ${PAYOUTS_COLLECTION} …`);
  const payouts = await copyCollection(db, 'payouts', PAYOUTS_COLLECTION, PAYOUT_FIELDS);
  console.log(`  payouts: copied ${payouts.copied}, skipped ${payouts.skipped}, failed ${payouts.failed}`);

  console.log(`Backing up walletTransactions → ${WALLET_TRANSACTIONS_COLLECTION} …`);
  const txns = await copyCollection(
    db,
    'walletTransactions',
    WALLET_TRANSACTIONS_COLLECTION,
    WALLET_TRANSACTION_FIELDS,
  );
  console.log(`  transactions: copied ${txns.copied}, skipped ${txns.skipped}, failed ${txns.failed}`);

  console.log(`Backing up payments → ${PAYMENTS_COLLECTION} …`);
  const payments = await copyCollection(db, 'payments', PAYMENTS_COLLECTION, PAYMENT_FIELDS);
  console.log(`  payments: copied ${payments.copied}, skipped ${payments.skipped}, failed ${payments.failed}`);

  console.log('\nDone.');
  if (payouts.failed || txns.failed || payments.failed) {
    console.error('Some records failed — re-run this script to retry just those.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
