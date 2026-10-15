/**
 * One-off migration: media still referenced through
 * `https://firebasestorage.googleapis.com/...` is DEAD — Cloud Storage for
 * Firebase returns 402 for this project (Spark plan), so every <video> on such
 * a URL sits on a black rectangle and every <img> shows a broken icon. That is
 * what read as "the video is crashing".
 *
 * For each occurrence in any collection:
 *   1. download the object through the admin SDK (the bucket itself is fine —
 *      only the public Firebase endpoint is blocked),
 *   2. store it under MEDIA_ROOT following the existing convention
 *      (images/…, videos/…, thumbnails/…, content-named 32-hex),
 *   3. rewrite the string to `/api/media/file/<rel>`.
 *
 * Videos get a poster generated next to them (`<name>_t.jpg`) so feed cards
 * have a real cover. Under `videoThumbnailUrls` a dead entry becomes that
 * poster — never the video itself (an mp4 poster is exactly the bug that made
 * the feed look crashed).
 *
 * Idempotent: objects are content-named from their storage path, and already
 * local URLs are skipped.
 *
 * Usage: npx tsx scripts/tmp-migrate-firebase-media.ts [--dry-run]
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import serviceAccount from '../service-account.json';

const DEAD = 'https://firebasestorage.googleapis.com/';
const BUCKET = 'studio-1725493862-5cb95.firebasestorage.app';
const MEDIA_ROOT = process.env.VIDNOV_MEDIA_ROOT || '/var/lib/vidnov/media';
const DRY = process.argv.includes('--dry-run');

const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.m4v', '.mkv', '.avi']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic']);

initializeApp({
  credential: cert(serviceAccount as never),
  storageBucket: BUCKET,
});
const db = getFirestore();
const bucket = getStorage().bucket();

function dateFolder(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

type Migration =
  | { ok: true; url: string; kind: 'video' | 'image' | 'other'; poster?: string }
  | { ok: false; reason: string };

const cache = new Map<string, Promise<Migration>>();

function objectPathOf(deadUrl: string): string {
  const noQuery = deadUrl.split('?')[0];
  const marker = '/o/';
  const i = noQuery.indexOf(marker);
  if (i < 0) return '';
  return decodeURIComponent(noQuery.slice(i + marker.length));
}

function migrate(deadUrl: string): Promise<Migration> {
  const cached = cache.get(deadUrl);
  if (cached) return cached;
  // Cache the promise so concurrent occurrences of the same URL download once.
  const pending = migrateUncached(deadUrl);
  cache.set(deadUrl, pending);
  return pending;
}

async function migrateUncached(deadUrl: string): Promise<Migration> {
  const objectPath = objectPathOf(deadUrl);
  if (!objectPath) return { ok: false, reason: 'cannot parse object path' };

  const ext = path.extname(objectPath).toLowerCase();
    const kind: 'video' | 'image' | 'other' = VIDEO_EXT.has(ext)
      ? 'video'
      : IMAGE_EXT.has(ext)
        ? 'image'
        : 'other';
    const folder = kind === 'video' ? 'videos' : kind === 'image' ? 'images' : 'files';
    const name =
      crypto.createHash('md5').update(objectPath).digest('hex') + (ext || '.bin');
    const rel = path.join(folder, dateFolder(), name);
    const abs = path.join(MEDIA_ROOT, rel);
    const publicUrl = `/api/media/file/${rel}`;

    try {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      if (!fs.existsSync(abs)) {
        const downloaded = (await bucket.file(objectPath).download()) as unknown as {
          0?: Buffer;
        };
        const buf = downloaded[0];
        if (!buf) throw new Error('empty download response');
        fs.writeFileSync(abs, buf);
      }
    } catch (e) {
      return { ok: false, reason: `download failed: ${(e as Error).message.slice(0, 200)}` };
    }

    let poster: string | undefined;
    if (kind === 'video') {
      const posterRel = rel.replace(/\.[A-Za-z0-9]+$/, '_t.jpg');
      const posterAbs = path.join(MEDIA_ROOT, posterRel);
      if (!fs.existsSync(posterAbs)) {
        try {
          execFileSync('ffmpeg', [
            '-y',
            '-i', abs,
            '-frames:v', '1',
            '-vf', 'scale=400:-2',
            '-q:v', '4',
            posterAbs,
          ], { stdio: 'pipe', timeout: 60_000 });
        } catch {
          poster = undefined; // no poster is fine — the clip still plays
        }
      }
      if (fs.existsSync(posterAbs)) poster = `/api/media/file/${posterRel}`;
    }

    return { ok: true, url: publicUrl, kind, poster };
}

/** Deep-copy `value`, replacing every dead URL. `key` is the parent field. */
async function rewrite(
  value: unknown,
  key: string | null,
): Promise<{ next: unknown; changed: boolean }> {
  if (typeof value === 'string') {
    if (!value.startsWith(DEAD)) return { next: value, changed: false };
    const m = await migrate(value);
    if (!m.ok) {
      console.log(`  ! keep dead (${m.reason}): ${value.slice(0, 100)}`);
      return { next: value, changed: false };
    }
    if (key === 'videoThumbnailUrls') {
      // A poster slot: only a real image may live here.
      return { next: m.kind === 'image' ? m.url : (m.poster ?? ''), changed: true };
    }
    if (m.kind === 'video' && key !== 'videoUrl' && key !== 'videoUrls') {
      // A video URL in an image-ish field: give the caller the poster instead.
      return { next: m.poster ?? '', changed: true };
    }
    return { next: m.url, changed: true };
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next: unknown[] = [];
    for (const v of value) {
      const r = await rewrite(v, key);
      changed ||= r.changed;
      next.push(r.next);
    }
    return { next, changed };
  }
  if (value && typeof value === 'object') {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const r = await rewrite(v, k);
      changed ||= r.changed;
      next[k] = r.next;
    }
    return { next, changed };
  }
  return { next: value, changed: false };
}

async function main() {
  const collections = await db.listCollections();
  let docsScanned = 0;
  let docsChanged = 0;

  for (const col of collections) {
    let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    for (;;) {
      let q = col.orderBy('__name__').limit(400);
      if (last) q = q.startAfter(last);
      const page = await q.get();
      if (page.empty) break;

      for (const doc of page.docs) {
        docsScanned++;
        const data = doc.data();
        const { next, changed } = await rewrite(data, null);
        if (!changed) continue;
        docsChanged++;
        console.log(`${DRY ? '[dry] ' : ''}${col.id}/${doc.id}`);
        if (!DRY) {
          // Only touch top-level fields that actually moved.
          const updates: Record<string, unknown> = {};
          const before = data as Record<string, unknown>;
          const after = next as Record<string, unknown>;
          for (const k of Object.keys(before)) {
            if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) updates[k] = after[k];
          }
          await doc.ref.update(updates);
        }
      }

      const cursor = page.docs[page.docs.length - 1];
      if (page.docs.length < 400 || cursor.id === last?.id) break;
      last = cursor;
    }
  }

  console.log(
    `scanned ${docsScanned} docs, ${docsChanged} updated, ${cache.size} unique dead URLs migrated`,
  );
  process.exit(0);
}
void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
