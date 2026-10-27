/**
 * One-time backfill: Firestore → PocketBase for the PER-USER subcollections.
 *
 * Copies three subcollections that live under a user profile to the local
 * PocketBase instance:
 *
 *   userProfiles/{uid}/cart/{productId}      → user_carts
 *   userProfiles/{uid}/paymentMethods/{id}   → user_payment_methods
 *   userProfiles/{uid}/payoutMethods/{id}    → user_payout_methods
 *
 * The money LEDGERS (`payments`, `payouts`) were already mirrored by
 * migrate-wallet.ts. What was left behind was everything they point at: the
 * cart a buyer checks out with, and the destinations a payout is sent to.
 *
 * Subcollections have no top-level listing in Firestore, so each set is read
 * with a collection-group query (one query per set, not one per user) and the
 * owning uid is taken from the parent profile — never from document content.
 * Only documents whose parent really is a `userProfiles` document are copied.
 *
 * Safe to re-run: records already copied (matched by `userId` + `fsId`) are
 * skipped, so an interrupted run resumes.
 *
 * Usage (from the project root on the VPS, with env loaded):
 *   npx -y tsx scripts/migrate-user-data.ts
 *
 * Requires the same env the app uses, plus:
 *   POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import {
  ensureCollection,
  pbCreateRecord,
  pbListRecords,
  getPocketBaseConfig,
  scrubForPocketBase,
} from '../src/lib/pocketbase/server';
import {
  USER_DATA_COLLECTION,
  USER_DATA_FIELDS,
  type UserDataKind,
} from '../src/lib/pocketbase/user-data';

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

/** Firestore collection id → the kind of document that lives in it. */
const GROUPS: { collectionId: string; kind: UserDataKind }[] = [
  { collectionId: 'cart', kind: 'cart' },
  { collectionId: 'paymentMethods', kind: 'paymentMethod' },
  { collectionId: 'payoutMethods', kind: 'payoutMethod' },
];

async function copyGroup(
  db: Firestore,
  collectionId: string,
  kind: UserDataKind,
): Promise<{ copied: number; skipped: number; failed: number }> {
  const collection = USER_DATA_COLLECTION[kind];
  await ensureCollection(collection, USER_DATA_FIELDS);

  // Existing userId:fsId pairs in PocketBase → skip on re-run.
  const done = new Set<string>();
  for (let page = 1; ; page++) {
    const items = await pbListRecords(collection, {
      fields: 'userId,fsId',
      perPage: 500,
      page,
    });
    for (const r of items) {
      if (typeof r.userId === 'string' && typeof r.fsId === 'string') {
        done.add(`${r.userId}:${r.fsId}`);
      }
    }
    if (items.length < 500) break;
  }

  let copied = 0;
  let skipped = 0;
  let failed = 0;
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = db.collectionGroup(collectionId).limit(300);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const docSnap of snap.docs) {
      // Only `userProfiles/{uid}/…` — never another parent that happens to
      // reuse the collection id.
      const profile = docSnap.ref.parent.parent;
      const uid = profile?.parent?.id === 'userProfiles' ? profile.id : null;
      if (!uid) continue;

      if (done.has(`${uid}:${docSnap.id}`)) {
        skipped++;
        continue;
      }
      const data = scrubForPocketBase(docSnap.data()) as Record<string, unknown>;
      try {
        await pbCreateRecord(collection, {
          fsId: docSnap.id,
          userId: uid,
          kind,
          data,
        });
        copied++;
      } catch (error) {
        failed++;
        console.error(`  ✗ ${collectionId}/${uid}/${docSnap.id}:`, (error as Error).message);
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

  let anyFailed = false;
  for (const group of GROUPS) {
    console.log(`Backing up userProfiles/*/ ${group.collectionId} → ${USER_DATA_COLLECTION[group.kind]} …`);
    const result = await copyGroup(db, group.collectionId, group.kind);
    console.log(
      `  ${group.collectionId}: copied ${result.copied}, skipped ${result.skipped}, failed ${result.failed}`,
    );
    if (result.failed) anyFailed = true;
  }

  console.log('\nDone.');
  if (anyFailed) {
    console.error('Some records failed — re-run this script to retry just those.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal:', error);
  process.exit(1);
});
