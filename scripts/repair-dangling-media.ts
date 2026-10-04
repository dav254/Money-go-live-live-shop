/**
 * Repair: drop attachment references whose files are no longer on the VPS disk.
 *
 * A request could end up pointing at a media record that was already bound to
 * an older request (and therefore cleaned up with it). The UI then rendered a
 * broken image/video. This removes only the dangling references — files that
 * exist are never touched.
 *
 * Usage: npx tsx scripts/repair-dangling-media.ts [--apply]
 */
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from '../service-account.json';

initializeApp({ credential: cert(serviceAccount as never) });
const db = getFirestore();

const MEDIA_ROOT = process.env.VIDNOV_MEDIA_ROOT || '/var/lib/vidnov/media';
const APPLY = process.argv.includes('--apply');

async function fileExists(relPath: string | null | undefined): Promise<boolean> {
  if (!relPath) return false;
  const abs = path.resolve(MEDIA_ROOT, relPath);
  if (!abs.startsWith(path.resolve(MEDIA_ROOT))) return false;
  try {
    const st = await fsp.stat(abs);
    return st.isFile();
  } catch {
    return false;
  }
}

async function main() {
  const media = await db.collection('media').get();
  const good = new Set<string>();
  const dead = new Map<string, string>(); // mediaId → storagePath

  for (const doc of media.docs) {
    const d = doc.data() as { storagePath?: string; status?: string };
    if (d.status === 'READY' && (await fileExists(d.storagePath))) good.add(doc.id);
    else dead.set(doc.id, d.storagePath ?? '(none)');
  }

  console.log(`media records: ${media.size} · present: ${good.size} · missing: ${dead.size}`);

  let removed = 0;
  for (const collectionName of ['requests', 'offers']) {
    const snap = await db.collection(collectionName).get();
    for (const doc of snap.docs) {
      const d = doc.data() as { mediaIds?: string[]; requestId?: string };
      const ids = d.mediaIds ?? [];
      const dangling = ids.filter((id) => !good.has(id));
      if (dangling.length === 0) continue;
      console.log(
        `  ${collectionName}/${doc.id}: dropping ${dangling.length} dangling attachment(s) ` +
          dangling.map((id) => `${id.slice(0, 8)} (${dead.get(id) ?? 'unknown'})`).join(', '),
      );
      if (APPLY) {
        await doc.ref.update({ mediaIds: ids.filter((id) => good.has(id)), updatedAt: new Date() });
      }
      removed += dangling.length;
    }
  }

  console.log(APPLY ? `repaired ${removed} reference(s)` : `${removed} reference(s) would be removed (re-run with --apply)`);
  process.exit(0);
}

void main();