/**
 * One-off repair: listings whose `videoThumbnailUrls` contain the VIDEO FILE
 * itself instead of a real thumbnail (the upload form's old fallbacks wrote
 * the clip's own URL whenever the poster was not at hand). An `.mp4` used as
 * a poster/image source never renders — Discovery showed a broken image over
 * black, which read as a crashed video.
 *
 * For every affected product the poster is rewritten to the thumbnail the
 * transcoder actually produced next to the clip
 * (videos/YYYY/MM/<id>.mp4 → thumbnails/YYYY/MM/<id>_t.jpg), or to '' when
 * no thumbnail exists on disk. Read-only except for the docs that need it.
 *
 * Usage: npx tsx scripts/tmp-repair-video-posters.ts [--dry-run]
 */
import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from '../service-account.json';

initializeApp({ credential: cert(serviceAccount as never) });
const db = getFirestore();

const MEDIA_ROOT = process.env.VIDNOV_MEDIA_ROOT || '/var/lib/vidnov/media';
const DRY = process.argv.includes('--dry-run');
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|avi|mkv)(\?|#|$)/i;

const usablePoster = (thumb: unknown, videoUrl: string): thumb is string =>
  typeof thumb === 'string' && thumb.trim() !== '' && !VIDEO_EXT.test(thumb) && thumb.trim() !== videoUrl;

/** videos/2026/10/<id>.mp4 → thumbnails/2026/10/<id>_t.jpg (if on disk). */
function thumbForVideoUrl(url: string): string {
  const rel = url.replace(/^\/api\/media\/file\//, '');
  if (!rel.startsWith('videos/')) return '';
  const base = rel.slice('videos/'.length).replace(/\.[A-Za-z0-9]+$/, '');
  for (const ext of ['_t.jpg', '_t.webp']) {
    const rel2 = `thumbnails/${base}${ext}`;
    if (fs.existsSync(path.join(MEDIA_ROOT, rel2))) return `/api/media/file/${rel2}`;
  }
  return '';
}

async function main() {
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let scanned = 0;
  let repaired = 0;

  for (;;) {
    const page = await db
      .collection('products')
      .select('videoUrl', 'videoUrls', 'videoThumbnailUrls')
      .limit(400)
      .get();
    if (page.empty) break;

    for (const doc of page.docs) {
      scanned++;
      const p = doc.data() as {
        videoUrl?: string;
        videoUrls?: string[];
        videoThumbnailUrls?: string[];
      };

      // Same dedupe order as listingMedia(): videoUrl first, then videoUrls.
      const vids: string[] = [];
      for (const u of [p.videoUrl ?? '', ...(p.videoUrls ?? [])]) {
        const clean = u.trim();
        if (clean && !vids.includes(clean)) vids.push(clean);
      }

      const oldThumbs = p.videoThumbnailUrls ?? [];
      const next = vids.map((v, i) =>
        usablePoster(oldThumbs[i], v) ? oldThumbs[i] : thumbForVideoUrl(v),
      );
      // Only a doc whose stored value actually changes is "repaired" — an
      // empty poster (video on Firebase Storage, no local thumbnail) is a
      // legitimate end state, not something to rewrite forever.
      const unchanged =
        oldThumbs.length === next.length && oldThumbs.every((t, i) => t === next[i]);
      if (unchanged) continue;
      console.log(`${DRY ? '[dry] ' : ''}${doc.id}: ${JSON.stringify(oldThumbs)} -> ${JSON.stringify(next)}`);
      if (!DRY) await doc.ref.update({ videoThumbnailUrls: next });
      repaired++;
    }

    const cursor = page.docs[page.docs.length - 1];
    if (page.docs.length < 400 || cursor.id === last?.id) break;
    last = cursor;
  }

  console.log(`scanned ${scanned} products, ${repaired} repaired`);
  process.exit(0);
}
void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
