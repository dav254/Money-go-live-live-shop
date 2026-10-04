/**
 * Read-only diagnostic: inspect media records bound to a request and whether
 * the referenced files actually exist on the VPS media disk.
 * Usage: npx tsx scripts/check-request-media.ts [requestId]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from '../service-account.json';

initializeApp({ credential: cert(serviceAccount as never) });
const db = getFirestore();

const MEDIA_ROOT = process.env.VIDNOV_MEDIA_ROOT || '/var/lib/vidnov/media';

async function main() {
  const requestId = process.argv[2];

  if (requestId) {
    const snap = await db.collection('requests').doc(requestId).get();
    if (!snap.exists) {
      console.log('Request not found:', requestId);
      process.exit(0);
    }
    const data = snap.data()!;
    console.log('REQUEST', requestId);
    console.log('  status      :', data.status);
    console.log('  title       :', data.title);
    console.log('  mediaIds    :', JSON.stringify(data.mediaIds ?? []));
    console.log('  offersCount :', data.offersCount);
  }

  // Every media record that belongs to a request (or is orphaned) with its
  // on-disk presence.
  const all = await db.collection('media').orderBy('createdAt', 'desc').limit(40).get();
  console.log(`\nMEDIA RECORDS (latest ${all.size}):`);
  all.forEach((d) => {
    const m = d.data() as Record<string, unknown>;
    const rel = (m.storagePath as string) ?? '';
    const thumb = (m.thumbnailPath as string) ?? '';
    const fileExists = rel ? fs.existsSync(path.join(MEDIA_ROOT, rel)) : false;
    const thumbExists = thumb ? fs.existsSync(path.join(MEDIA_ROOT, thumb)) : false;
    console.log(
      [
        `  ${d.id.slice(0, 8)}`,
        `kind=${(m.kind as string) ?? '?'}`,
        `state=${(m.storageState as string) ?? '?'}`,
        `vis=${(m.visibility as string) ?? '?'}`,
        `req=${(m.requestId as string) ?? '-'}`,
        `offer=${(m.offerId as string) ?? '-'}`,
        `file=${fileExists ? 'OK' : 'MISSING'}`,
        `thumb=${thumb ? (thumbExists ? 'OK' : 'MISSING') : '-'}`,
        `path=${rel}`,
      ].join(' '),
    );
  });

  // Offers attached to the request (if we were given one).
  if (requestId) {
    const offers = await db.collection('offers').where('requestId', '==', requestId).get();
    console.log(`\nOFFERS on ${requestId}: ${offers.size}`);
    offers.forEach((d) => {
      const o = d.data() as Record<string, unknown>;
      console.log(`  offer ${d.id} status=${o.status} mediaIds=${JSON.stringify(o.mediaIds ?? [])}`);
    });
  }

  process.exit(0);
}

void main();