/**
 * MEDIA COST REPORT — read-only.
 *
 * Measures what the media system actually costs on this disk, so the "should
 * we limit sellers?" question is answered with numbers instead of intuition.
 *
 * Nothing is written, moved or deleted.
 */
import { MEDIA_ROOT } from '@/lib/media/config';
import { getStorageStats } from '@/lib/media/storage';

const MB = 1024 * 1024;
const GB = 1024 * MB;

async function main() {
  const stats = await getStorageStats();
  const { mediaBytes = 0, images = 0, videos = 0, thumbnails = 0 } = stats as {
    mediaBytes?: number; images?: number; videos?: number; thumbnails?: number;
  };

  console.log('=== what is on disk ===');
  console.log(`root            ${MEDIA_ROOT}`);
  console.log(`images          ${images}`);
  console.log(`videos          ${videos}`);
  console.log(`thumbnails      ${thumbnails}`);
  console.log(`media total     ${(mediaBytes / MB).toFixed(1)} MB (${(mediaBytes / GB).toFixed(2)} GB)`);
  if (typeof (stats as { totalBytes?: number }).totalBytes === 'number') {
    const total = (stats as { totalBytes: number }).totalBytes;
    const free = (stats as { freeBytes?: number }).freeBytes;
    if (typeof free === 'number') {
      console.log(`disk total      ${(total / GB).toFixed(1)} GB`);
      console.log(`disk free       ${(free / GB).toFixed(1)} GB  (${((free / total) * 100).toFixed(1)}%)`);
    }
  }

  /*
   * Extrapolation.
   *
   * A 2-minute 720p H.264 clip at CRF 18 lands around 1.5-2.5 Mbps, so roughly
   * 20-40 MB. The two columns are what a seller costs you at one and at five
   * video listings — the numbers a decision about per-seller quotas is
   * actually made from.
   */
  console.log('\n=== what a seller costs if they use video ===');
  const clipLo = 20 * MB;
  const clipHi = 40 * MB;
  for (const clips of [1, 3, 5]) {
    console.log(
      `  ${clips} clip${clips > 1 ? 's' : ''}  ${((clipLo * clips) / GB).toFixed(2)}–${((clipHi * clips) / GB).toFixed(2)} GB   ` +
      `(80-item quota, all video)`,
    );
  }
  const allVideo = 80;
  console.log(`  80 clips (the current quota, all video)  ${((clipLo * allVideo) / GB).toFixed(1)}–${((clipHi * allVideo) / GB).toFixed(1)} GB per seller`);
  console.log('\n  At CRF 28 instead of 18 that band drops by roughly half.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
