/**
 * One-time backfill: Firestore → PocketBase for the GROWTH ENGINE sections —
 * distribution jobs (the Control Center queues) and opportunity
 * applications (the admin review queue).
 *
 * Copies every `distributionJobs` document to the `distribution_jobs`
 * collection and every `opportunityApplications` document to
 * `opportunity_applications` on the local PocketBase instance, so the admin
 * consoles (admin/system/distribution, admin/system/opportunities) answer
 * from this machine when Firestore is blocked or unreachable.
 *
 * Safe to re-run: the mirror helpers upsert by the original Firestore id
 * (`fsId`), so a re-run refreshes rows instead of duplicating them.
 *
 * Usage (from the project root, with env loaded):
 *   npx -y tsx scripts/migrate-growth-jobs.ts
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
import { getPocketBaseConfig } from '../src/lib/pocketbase/server';
import { pbMirrorDistributionJob } from '../src/lib/pocketbase/distribution-jobs';
import { pbMirrorOpportunityApplication } from '../src/lib/pocketbase/opportunities';

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

async function copyCollection(
  db: Firestore,
  fsCollection: string,
  mirror: (fsId: string, data: Record<string, unknown>) => Promise<boolean>,
): Promise<{ copied: number; failed: number }> {
  let copied = 0;
  let failed = 0;
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q: FirebaseFirestore.Query = db.collection(fsCollection).limit(300);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      const ok = await mirror(doc.id, (doc.data() ?? {}) as Record<string, unknown>);
      if (ok) copied++;
      else {
        failed++;
        console.error(`  ✗ ${fsCollection}/${doc.id}: mirror returned false`);
      }
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < 300) break;
  }
  return { copied, failed };
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

  console.log('Backing up distributionJobs → distribution_jobs …');
  const jobs = await copyCollection(db, 'distributionJobs', pbMirrorDistributionJob);
  console.log(`  distribution jobs: copied ${jobs.copied}, failed ${jobs.failed}`);

  console.log('Backing up opportunityApplications → opportunity_applications …');
  const apps = await copyCollection(db, 'opportunityApplications', pbMirrorOpportunityApplication);
  console.log(`  opportunity applications: copied ${apps.copied}, failed ${apps.failed}`);

  console.log('\nDone.');
  if (jobs.failed || apps.failed) {
    console.error('Some records failed — re-run this script to retry just those.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
