/**
 * One-time backfill: Firestore → PocketBase for the LIVE SESSIONS section.
 *
 * Two phases, because go-live reads both:
 *
 *  1. `liveSessions` → `live_sessions` on the local PocketBase instance, so
 *     the seller studio, the buyer viewer-token mint and the LIVE NOW grid
 *     keep working when Firestore does not.
 *  2. `userProfiles` balances → `user_profiles.aiPoints` (+ shopName/fullName),
 *     because POST /api/live-session reads the points balance VPS-first and
 *     REFUSES to invent one: without this phase every go-live on a profile
 *     row that only exists here would answer "Could not read your points
 *     balance". Profiles already mirrored by signup are only patched when
 *     their balance is missing — an existing VPS balance is never clobbered
 *     (it may have moved since the last mirror).
 *
 * Safe to re-run: records matched by their original Firestore id (`fsId` /
 * `uid`) are skipped or only patched where empty, so an interrupted run
 * resumes.
 *
 * Usage (from the project root, with env loaded):
 *   npx -y tsx scripts/migrate-live-sessions.ts
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
  pbRequest,
  getPocketBaseConfig,
} from '../src/lib/pocketbase/server';
import {
  LIVE_SESSIONS_COLLECTION,
  LIVE_SESSION_FIELDS,
  scrubForPocketBase,
} from '../src/lib/pocketbase/live-sessions';
import {
  USER_PROFILES_COLLECTION,
  PROFILE_FIELDS,
} from '../src/lib/pocketbase/profiles';

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

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/* -------------------------------------------------------------------------- */
/* Phase 1 — liveSessions                                                     */
/* -------------------------------------------------------------------------- */

async function copyLiveSessions(db: Firestore): Promise<{ copied: number; skipped: number; failed: number }> {
  await ensureCollection(LIVE_SESSIONS_COLLECTION, LIVE_SESSION_FIELDS);

  const done = new Set<string>();
  for (let page = 1; ; page++) {
    const items = await pbListRecords(LIVE_SESSIONS_COLLECTION, { fields: 'fsId', perPage: 500, page });
    for (const r of items) if (typeof r.fsId === 'string') done.add(r.fsId);
    if (items.length < 500) break;
  }

  let copied = 0;
  let skipped = 0;
  let failed = 0;
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q: FirebaseFirestore.Query = db.collection('liveSessions').limit(300);
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
        await pbCreateRecord(LIVE_SESSIONS_COLLECTION, {
          fsId: doc.id,
          sellerId: str(data.sellerId) ?? doc.id,
          status: str(data.status) ?? '',
          title: str(data.title) ?? '',
          provider: str(data.provider) ?? '',
          livekitRoomName: str(data.livekitRoomName) ?? '',
          viewerCount: typeof data.viewerCount === 'number' ? data.viewerCount : 0,
          startTime: iso(data.startTime) ?? undefined,
          createdAt: iso(data.initialStartTime) ?? iso(data.startTime) ?? undefined,
          data,
        });
        copied++;
      } catch (error) {
        failed++;
        console.error(`  ✗ liveSessions/${doc.id}:`, (error as Error).message);
      }
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < 300) break;
  }
  return { copied, skipped, failed };
}

/* -------------------------------------------------------------------------- */
/* Phase 2 — profile balances the go-live charge reads                        */
/* -------------------------------------------------------------------------- */

async function backfillProfileBalances(
  db: Firestore,
): Promise<{ created: number; patched: number; skipped: number; failed: number }> {
  await ensureCollection(USER_PROFILES_COLLECTION, PROFILE_FIELDS);

  // Existing VPS rows by uid (with whatever they already carry).
  const existing = new Map<
    string,
    { id: string; aiPoints: unknown; shopName: string; fullName: string }
  >();
  for (let page = 1; ; page++) {
    const rows = await pbListRecords(USER_PROFILES_COLLECTION, {
      fields: 'id,uid,aiPoints,shopName,fullName',
      perPage: 500,
      page,
    });
    for (const r of rows) {
      const uid = typeof r.uid === 'string' ? r.uid : null;
      if (uid) {
        existing.set(uid, {
          id: r.id,
          aiPoints: r.aiPoints,
          shopName: typeof r.shopName === 'string' ? r.shopName : '',
          fullName: typeof r.fullName === 'string' ? r.fullName : '',
        });
      }
    }
    if (rows.length < 500) break;
  }

  let created = 0;
  let patched = 0;
  let skipped = 0;
  let failed = 0;
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q: FirebaseFirestore.Query = db.collection('userProfiles').limit(300);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      const d = doc.data();
      const uid = doc.id;
      const known: Record<string, unknown> = {};
      for (const key of [
        'email', 'fullName', 'username', 'userRole', 'status',
        'phoneNumber', 'profilePictureUrl', 'joinDate', 'shopName',
      ] as const) {
        const v = d[key];
        if (typeof v === 'string' && v) known[key] = v;
      }
      const points = typeof d.aiPoints === 'number' ? d.aiPoints : null;
      const row = existing.get(uid);
      try {
        if (!row) {
          await pbCreateRecord(USER_PROFILES_COLLECTION, {
            uid,
            ...known,
            ...(points !== null ? { aiPoints: points } : {}),
          });
          created++;
          continue;
        }
        // Already mirrored — only fill what is missing. A balance the VPS
        // already knows wins (it may have moved since the last sync), and
        // display names are only added when the row has none.
        const patch: Record<string, unknown> = {};
        if ((row.aiPoints === null || row.aiPoints === undefined) && points !== null) {
          patch.aiPoints = points;
        }
        if (!row.shopName && typeof d.shopName === 'string' && d.shopName) {
          patch.shopName = d.shopName;
        }
        if (!row.fullName && typeof d.fullName === 'string' && d.fullName) {
          patch.fullName = d.fullName;
        }
        if (Object.keys(patch).length === 0) {
          skipped++;
          continue;
        }
        const res = await pbRequest(
          `/api/collections/${USER_PROFILES_COLLECTION}/records/${row.id}`,
          { method: 'PATCH', body: JSON.stringify(patch) },
        );
        if (res.ok) patched++;
        else {
          failed++;
          console.error(`  ✗ user_profiles/${uid}: PATCH ${res.status}`);
        }
      } catch (error) {
        failed++;
        console.error(`  ✗ user_profiles/${uid}:`, (error as Error).message);
      }
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < 300) break;
  }
  return { created, patched, skipped, failed };
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

  console.log('Backing up liveSessions →', `${LIVE_SESSIONS_COLLECTION} …`);
  const sessions = await copyLiveSessions(db);
  console.log(
    `  sessions: copied ${sessions.copied}, skipped ${sessions.skipped}, failed ${sessions.failed}`,
  );

  console.log(`Backing up userProfiles balances → ${USER_PROFILES_COLLECTION} …`);
  const balances = await backfillProfileBalances(db);
  console.log(
    `  profiles: created ${balances.created}, patched ${balances.patched}, ` +
      `skipped ${balances.skipped}, failed ${balances.failed}`,
  );

  console.log('\nDone.');
  if (sessions.failed || balances.failed) {
    console.error('Some records failed — re-run this script to retry just those.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
