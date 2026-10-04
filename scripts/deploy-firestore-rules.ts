/**
 * Deploys firestore.rules to the project via the Firebase Rules API
 * (no Firebase CLI required — uses the service account directly).
 *
 * Usage: npx tsx scripts/deploy-firestore-rules.ts [rulesFile]
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

function init() {
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
    initializeApp();
  }
}

async function getAccessToken(): Promise<string> {
  const app = getApps()[0];
  const credential = app.options.credential as { getAccessToken?: () => Promise<{ access_token: string }> } | undefined;
  if (!credential?.getAccessToken) throw new Error('No credential with getAccessToken available.');
  const token = await credential.getAccessToken();
  return token.access_token;
}

async function main() {
  const rulesFile = process.argv[2] ?? 'firestore.rules';
  const source = fs.readFileSync(path.join(process.cwd(), rulesFile), 'utf8');
  init();

  // Project id from the service account (or env) — never logged beyond name.
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'service-account.json');
  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8')) as { project_id?: string };
  const projectId =
    sa.project_id ?? process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Could not resolve Firebase project id (service account project_id or FIREBASE_PROJECT_ID).');
  if (!projectId) throw new Error('Could not resolve Firebase project id.');

  const token = await getAccessToken();
  // REST resource names are always RELATIVE to the API root — embedding the
  // full URL inside the body fails with "Request contains an invalid argument".
  const apiRoot = 'https://firebaserules.googleapis.com/v1';
  const base = `${apiRoot}/projects/${projectId}`;
  const releaseName = `projects/${projectId}/releases/cloud.firestore`;

  // 1. Create the ruleset.
  const createRes = await fetch(`${base}/rulesets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: { files: [{ name: 'firestore.rules', content: source }] },
    }),
  });
  const created = (await createRes.json()) as { name?: string; error?: { message: string } };
  if (!createRes.ok) {
    throw new Error(`Ruleset creation failed: ${created.error?.message ?? createRes.status}`);
  }
  const rulesetName = created.name!; // full relative name: projects/<id>/rulesets/<uuid>
  console.log(`Ruleset created: ${rulesetName.split('/').pop()}`);

  // 2. Point the cloud.firestore release at it. UpdateReleaseRequest takes
  // the Release nested under `release` plus an updateMask — both relative.
  const releaseRes = await fetch(`${base}/releases/cloud.firestore`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      release: { name: releaseName, rulesetName },
      updateMask: 'rulesetName',
    }),
  });
  const released = (await releaseRes.json()) as { error?: { message: string } };
  if (!releaseRes.ok) {
    throw new Error(`Release update failed: ${released.error?.message ?? releaseRes.status}`);
  }
  console.log(`✅ Firestore rules for project "${projectId}" are now LIVE (ruleset ${rulesetName.split('/').pop()}).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
