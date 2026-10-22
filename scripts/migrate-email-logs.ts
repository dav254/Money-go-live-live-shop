/**
 * One-time backfill: Firestore → PocketBase for the email-logs section.
 *
 * Copies every `emailLogs` record to the `email_logs` collection and every
 * `devMailbox` message to the `dev_mailbox` collection on the local PocketBase
 * instance. Safe to re-run: records already copied (matched by their original
 * Firestore id in `fsId`) are skipped, so an interrupted run resumes.
 *
 * Usage (from the project root on the VPS, with env loaded):
 *   npx -y tsx scripts/migrate-email-logs.ts
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
import { ensureCollection, pbListRecords, pbCreateRecord, getPocketBaseConfig, type PbField } from '../src/lib/pocketbase/server';
import { DEV_MAILBOX_COLLECTION, EMAIL_LOGS_COLLECTION } from '../src/lib/pocketbase/email-logs';

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

async function copyCollection(
  db: ReturnType<typeof getFirestore>,
  source: string,
  target: string,
  fields: PbField[],
  map: (data: Record<string, unknown>, id: string) => Record<string, unknown>,
): Promise<{ copied: number; skipped: number; failed: number }> {
  await ensureCollection(target, fields);

  // Existing fsIds in PocketBase → skip on re-run.
  const done = new Set<string>();
  for (let page = 1; ; page++) {
    const items = await pbListRecords(target, { fields: 'fsId', perPage: 500, page });
    for (const r of items) if (typeof r.fsId === 'string') done.add(r.fsId);
    if (items.length < 500) break;
  }

  let copied = 0, skipped = 0, failed = 0;
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q: FirebaseFirestore.Query = db.collection(source).limit(300);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      if (done.has(doc.id)) { skipped++; continue; }
      try {
        await pbCreateRecord(target, { ...map(doc.data(), doc.id), fsId: doc.id });
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

  console.log(`Backing up emailLogs → ${EMAIL_LOGS_COLLECTION} …`);
  const logs = await copyCollection(db, 'emailLogs', EMAIL_LOGS_COLLECTION,
    [
      { name: 'fsId', type: 'text' },
      { name: 'to', type: 'text', required: true },
      { name: 'from', type: 'text', required: true },
      { name: 'subject', type: 'text' },
      { name: 'template', type: 'text' },
      { name: 'category', type: 'text' },
      { name: 'status', type: 'text', required: true },
      { name: 'provider', type: 'text' },
      { name: 'providerId', type: 'text' },
      { name: 'userId', type: 'text' },
      { name: 'failureReason', type: 'text' },
      { name: 'devMode', type: 'bool' },
      { name: 'createdAt', type: 'date' },
    ],
    (d) => ({
      to: d.to ?? '', from: d.from ?? '', subject: d.subject ?? '',
      template: d.template ?? '', category: d.category ?? '', status: d.status ?? 'SENT',
      provider: d.provider ?? '', providerId: d.providerId ?? null,
      userId: d.userId ?? null, failureReason: d.failureReason ?? null,
      devMode: Boolean(d.devMode), createdAt: iso(d.createdAt),
    }),
  );

  console.log(`Backing up devMailbox → ${DEV_MAILBOX_COLLECTION} …`);
  const mailbox = await copyCollection(db, 'devMailbox', DEV_MAILBOX_COLLECTION,
    [
      { name: 'fsId', type: 'text' },
      { name: 'to', type: 'text', required: true },
      { name: 'from', type: 'text', required: true },
      { name: 'replyTo', type: 'text' },
      { name: 'subject', type: 'text' },
      { name: 'text', type: 'text' },
      { name: 'html', type: 'text' },
      { name: 'templateKey', type: 'text' },
      { name: 'category', type: 'text' },
      { name: 'userId', type: 'text' },
      { name: 'capturedAt', type: 'date' },
      { name: 'devMode', type: 'bool' },
    ],
    (d) => ({
      to: d.to ?? '', from: d.from ?? '', replyTo: d.replyTo ?? null,
      subject: d.subject ?? '', text: d.text ?? '', html: d.html ?? '',
      templateKey: d.templateKey ?? '', category: d.category ?? '',
      userId: d.userId ?? null, capturedAt: iso(d.capturedAt) ?? iso(d.createdAt),
      devMode: true,
    }),
  );

  console.log('\nDone.');
  console.log(`  emailLogs  → copied ${logs.copied}, skipped ${logs.skipped}, failed ${logs.failed}`);
  console.log(`  devMailbox → copied ${mailbox.copied}, skipped ${mailbox.skipped}, failed ${mailbox.failed}`);
  if (logs.failed || mailbox.failed) {
    console.error('\nSome records failed — re-run this script to retry just those.');
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
