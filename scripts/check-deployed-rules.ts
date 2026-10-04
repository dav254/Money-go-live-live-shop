/**
 * Read-only inspection of the Firestore security rules that are CURRENTLY
 * deployed to the Firebase project (does not change anything).
 *
 * Usage: npx tsx scripts/check-deployed-rules.ts
 */
import { GoogleAuth } from 'google-auth-library';

const projectId = (process.env.FIREBASE_PROJECT_ID as string) || 'studio-1725493862-5cb95';

async function main() {
  const auth = new GoogleAuth({
    keyFile: 'service-account.json',
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const headers = {
    Authorization: `Bearer ${typeof token === 'string' ? token : token.token}`,
  };

  const releaseRes = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`,
    { headers },
  );
  const release = (await releaseRes.json()) as { name?: string; rulesetName?: string };
  console.log('release status:', releaseRes.status, JSON.stringify(release));

  const rulesetName = release.rulesetName || release.name?.split('/').pop();
  if (!rulesetName) return;

  const rulesetRes = await fetch(
    `https://firebaserules.googleapis.com/v1/${rulesetName}`,
    { headers },
  );
  const ruleset = (await rulesetRes.json()) as { source?: { files?: { content?: string }[] } };
  const content = ruleset.source?.files?.[0]?.content ?? '(no source returned)';
  console.log('ruleset status:', rulesetRes.status);
  console.log('----- deployed rules -----');
  console.log(content);
}

main().catch((e) => {
  console.error('failed:', e?.message ?? e);
});