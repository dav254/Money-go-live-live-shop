/**
 * Read-only: print the latest errorLogs entries so we can see the real
 * client-side error message caught by GlobalErrorBoundary.
 * Usage: npx tsx scripts/read-error-logs.ts
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from '../service-account.json';

initializeApp({ credential: cert(serviceAccount as never) });
const db = getFirestore();

async function main() {
  const snap = await db.collection('errorLogs').orderBy('timestamp', 'desc').limit(4).get();
  if (snap.empty) {
    console.log('No errorLogs entries found.');
  } else {
    snap.forEach((d) => {
      const data = d.data();
      console.log('---');
      console.log('id:', d.id);
      console.log('message:', data.errorMessage ?? data.message);
      console.log('timestamp:', data.timestamp?.toDate?.()?.toISOString?.() ?? '');
      const ctx = data.context ?? data.errorContext ?? data.errorInfo;
      if (ctx) {
        console.log('context:', JSON.stringify(ctx, null, 1).slice(0, 3000));
      } else {
        console.log('(no context field) keys:', Object.keys(data).join(', '));
      }
    });
  }
  process.exit(0);
}
void main();
