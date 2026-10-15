/**
 * Read-only diagnostics: dump the media fields of listings named "Jjjj"
 * (or the most recent listings by dave2545) so we can see what URL the
 * discovery feed is being asked to render.
 * Usage: npx tsx scripts/tmp-inspect-jjjj.ts
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from '../service-account.json';

initializeApp({ credential: cert(serviceAccount as never) });
const db = getFirestore();

async function main() {
  const byName = await db.collection('products').where('name', '==', 'Jjjj').get();
  const docs = byName.docs;
  console.log(`products named "Jjjj": ${docs.length}`);
  for (const d of docs) {
    const p = d.data() as Record<string, unknown>;
    console.log('---', d.id);
    for (const k of [
      'imageUrl', 'imageUrls', 'videoUrl', 'videoUrls', 'videoThumbnailUrls',
      'thumbnailUrls', 'mediaIds', 'sellerId', 'status', 'createdAt', 'listingType',
    ]) {
      if (p[k] !== undefined) console.log(`  ${k}:`, JSON.stringify(p[k]));
    }
  }

  if (docs.length === 0) {
    const recent = await db.collection('products').orderBy('createdAt', 'desc').limit(5).get();
    console.log('\nmost recent 5 products:');
    recent.forEach((d) => {
      const p = d.data() as Record<string, unknown>;
      console.log(' -', d.id, '|', p.name, '| seller', p.sellerId,
        '| videoUrl', JSON.stringify(p.videoUrl ?? null),
        '| imageUrls', JSON.stringify(p.imageUrls ?? null));
    });
  }
  process.exit(0);
}
void main().catch((e) => { console.error(e); process.exit(1); });
