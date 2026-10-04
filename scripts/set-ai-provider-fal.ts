/**
 * Points the stored AI Studio settings (aiSettings/main) at a provider.
 * Run once after changing engines so existing saved settings don't keep
 * routing jobs to the old provider.
 *
 * Usage: npx tsx scripts/set-ai-provider-fal.ts [providerId]
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const PROVIDERS = ['text-to-image', 'image-to-image', 'text-to-video', 'image-to-video', 'image-animation'];

async function main() {
  const providerId = process.argv[2] ?? 'FAL_AI';
  if (getApps().length === 0) {
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(path.join(process.cwd(), 'service-account.json'), 'utf8'))) });
  }

  const activeProviders = Object.fromEntries(PROVIDERS.map((key) => [key, providerId]));
  await getFirestore().doc('aiSettings/main').set(
    { activeProviders, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  console.log(`AI Studio now routes every capability to ${providerId}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});