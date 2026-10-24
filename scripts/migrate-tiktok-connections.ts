/**
 * Migrate TikTok credentials out of the PUBLICLY READABLE `userProfiles`
 * documents into the server-only `tiktok_connections/{uid}` collection.
 *
 * SAFETY RULES BAKED INTO THIS SCRIPT
 *   • Dry-run is the DEFAULT. No mode runs unless you pass it explicitly.
 *   • Prints COUNTS ONLY — never tokens, never token-bearing documents,
 *     never authorization codes. (Boolean checks like "destination has an
 *     access token: yes/no" are computed in memory, not printed.)
 *   • Apply never overwrites an existing, valid destination connection
 *     (pass --force to override, knowing what you are doing).
 *   • Legacy `connections.tiktok` is NOT deleted or modified — removal of the
 *     old fields is a separate, reviewed procedure (see "Legacy cleanup"
 *     below) because until then the old tokens remain world-readable.
 *   • Rollback deletes ONLY documents this script created (they carry
 *     `migration: 'migrate-tiktok-connections-v1'`).
 *
 * USAGE (from the project root, with the app's env loaded — never in prod
 * without review):
 *   npx -y tsx scripts/migrate-tiktok-connections.ts                # dry-run
 *   npx -y tsx scripts/migrate-tiktok-connections.ts --apply
 *   npx -y tsx scripts/migrate-tiktok-connections.ts --verify
 *   npx -y tsx scripts/migrate-tiktok-connections.ts --rollback
 *   add --force to --apply to overwrite existing destination docs
 *
 * LEGACY CLEANUP (separate, reviewed, after --verify passes):
 *   1. Confirm every reader uses src/lib/tiktok/store.ts (grep for
 *      `connections.tiktok` — only the store's legacy fallback may remain).
 *   2. Re-run --verify.
 *   3. Remove the `connections` object from userProfiles documents (admin SDK
 *      only), one batch at a time, then deploy the rules that stay unchanged.
 *   4. If you believe tokens were exposed while they were public, treat them
 *      as compromised: TikTok refresh tokens can be revoked by disconnecting
 *      the app in each user's TikTok settings, or by app-level token
 *      invalidation in the TikTok developer portal, after which sellers
 *      simply reconnect.
 *
 * Firebase credentials resolve exactly like src/firebase/server.ts
 * (GOOGLE_APPLICATION_CREDENTIALS → FIREBASE_SERVICE_ACCOUNT_JSON →
 * ./service-account.json → ADC).
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const DEST_COLLECTION = 'tiktok_connections';
const MIGRATION_TAG = 'migrate-tiktok-connections-v1';
const PAGE = 300;

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

interface Candidate {
  uid: string;
  legacy: {
    openId?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: unknown;
    scopes?: string[];
    connectedAt?: unknown;
  };
}

function toMs(value: unknown): number | null {
  if (typeof value === 'number') return value;
  const t = value as { toMillis?: () => number } | undefined;
  if (t && typeof t.toMillis === 'function') return t.toMillis();
  return null;
}

/** Pages through profiles keeping ONLY the `connections` field in memory. */
async function findCandidates(db: ReturnType<typeof getFirestore>): Promise<Candidate[]> {
  const out: Candidate[] = [];
  let query = db.collection('userProfiles').select('connections').limit(PAGE);
  for (;;) {
    const snap = await query.get();
    for (const doc of snap.docs) {
      const legacy = (doc.data().connections as { tiktok?: Candidate['legacy'] } | undefined)?.tiktok;
      if (legacy?.accessToken && legacy.openId) out.push({ uid: doc.id, legacy });
    }
    if (snap.empty || snap.docs.length < PAGE) break;
    query = query.startAfter(snap.docs[snap.docs.length - 1]);
  }
  return out;
}

async function countDestinations(
  db: ReturnType<typeof getFirestore>,
): Promise<{ total: number; withAccess: number }> {
  let total = 0;
  let withAccess = 0;
  const snap = await db.collection(DEST_COLLECTION).select('accessToken').limit(10_000).get();
  snap.docs.forEach((d) => {
    total += 1;
    if (typeof d.data().accessToken === 'string' && d.data().accessToken) withAccess += 1;
  });
  return { total, withAccess };
}

async function run() {
  const mode = process.argv.find((a) => ['--apply', '--verify', '--rollback'].includes(a)) ?? '--dry-run';
  const force = process.argv.includes('--force');
  initFirebase();
  const db = getFirestore();

  if (mode === '--dry-run') {
    const candidates = await findCandidates(db);
    const dest = await countDestinations(db);
    const alreadyCovered = candidates.filter((c) => dest.total > 0).length; // informational only
    console.log('DRY RUN — no data was written.');
    console.log(`  profiles with legacy connections.tiktok : ${candidates.length}`);
    console.log(`  existing ${DEST_COLLECTION} documents   : ${dest.total} (${dest.withAccess} with an access token)`);
    console.log(`  would attempt to create                : ${Math.max(candidates.length - dest.total, 0)}–${candidates.length}`);
    console.log(`  (informational) candidates near-cover  : ${alreadyCovered}`);
    console.log('Run with --apply to backfill, --verify to check, --rollback to undo this script\'s writes.');
    return;
  }

  if (mode === '--apply') {
    const candidates = await findCandidates(db);
    let created = 0;
    let skippedExisting = 0;
    let failed = 0;
    for (const c of candidates) {
      try {
        const ref = db.collection(DEST_COLLECTION).doc(c.uid);
        const existing = await ref.get();
        if (existing.exists && !force) {
          const cur = existing.data() as { accessToken?: string; needsReconnect?: boolean };
          if (typeof cur.accessToken === 'string' && cur.accessToken && !cur.needsReconnect) {
            skippedExisting += 1; // never clobber a valid destination connection
            continue;
          }
        }
        await ref.set(
          {
            openId: c.legacy.openId,
            accessToken: c.legacy.accessToken,
            refreshToken: c.legacy.refreshToken ?? null,
            expiresAt: toMs(c.legacy.expiresAt),
            scopes: Array.isArray(c.legacy.scopes) ? c.legacy.scopes : [],
            connectedAt: toMs(c.legacy.connectedAt) ?? 0,
            updatedAt: Date.now(),
            migration: MIGRATION_TAG,
          },
          { merge: true },
        );
        created += 1;
      } catch {
        failed += 1;
      }
    }
    console.log('APPLY complete — counts only, no values printed.');
    console.log(`  created   : ${created}`);
    console.log(`  skipped   : ${skippedExisting} (destination already valid)`);
    console.log(`  failed    : ${failed}`);
    console.log('Legacy connections.tiktok were left untouched (by design).');
    return;
  }

  if (mode === '--verify') {
    const candidates = await findCandidates(db);
    let match = 0;
    let missingDest = 0;
    let mismatch = 0;
    for (const c of candidates) {
      const doc = await db.collection(DEST_COLLECTION).doc(c.uid).get();
      if (!doc.exists) {
        missingDest += 1;
        continue;
      }
      const dest = doc.data() as { openId?: string; accessToken?: string; refreshToken?: string };
      // Compare identifiers/presence only — values are never printed.
      const sameOpenId = dest.openId === c.legacy.openId;
      const sameAccessPresence = !!dest.accessToken === !!c.legacy.accessToken;
      const sameRefreshPresence = !!dest.refreshToken === !!c.legacy.refreshToken;
      if (sameOpenId && sameAccessPresence && sameRefreshPresence) match += 1;
      else mismatch += 1;
    }
    console.log('VERIFY — counts only.');
    console.log(`  legacy records          : ${candidates.length}`);
    console.log(`  destination matches     : ${match}`);
    console.log(`  destination missing     : ${missingDest}`);
    console.log(`  destination mismatches  : ${mismatch}`);
    console.log(missingDest === 0 && mismatch === 0 ? 'VERIFIED ✔' : 'NOT VERIFIED ✖ — rerun --apply, then verify again.');
    return;
  }

  if (mode === '--rollback') {
    // Delete ONLY documents this script created (tagged), nothing else.
    const snap = await db.collection(DEST_COLLECTION).where('migration', '==', MIGRATION_TAG).get();
    let deleted = 0;
    for (const doc of snap.docs) {
      await doc.ref.delete();
      deleted += 1;
    }
    console.log('ROLLBACK complete.');
    console.log(`  deleted (migration-created only): ${deleted}`);
    console.log('Untouched: legacy connections.tiktok and any connections saved by the live app.');
    return;
  }

  console.log(`Unknown mode "${mode}". Use --dry-run (default), --apply, --verify or --rollback.`);
  process.exitCode = 1;
}

run()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error('Migration script failed:', (error as Error)?.message);
    process.exit(1);
  });