import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { MEDIA_COLLECTION } from '@/lib/media/config';
import { mediaRecordToUrls, type MediaRecord } from '@/lib/media/service';
import { verifyRequestUser } from '@/lib/media/api-auth';

export const runtime = 'nodejs';

/**
 * GET /api/media/mine — the caller's own media library.
 *
 * ## Why this exists
 *
 * Uploads land on the VPS disk (`/var/lib/vidnov/media`), compressed, and the
 * Firestore `media` collection is the index of what is there. A seller needs to
 * see that index: what they have uploaded, how much space it takes, and what it
 * was compressed down to. Without this there is no way to answer "did my video
 * actually save, and how big is it?" — the answer exists only as files on a
 * disk the seller cannot reach.
 *
 * ## Ordering is done in memory, not in the query
 *
 * `where userId == uid` + `orderBy createdAt desc` needs a composite index
 * (`userId ASC, createdAt DESC`) that has to be created in the Firebase console
 * before the query works at all. Until someone creates it, this endpoint would
 * return a 500 for every seller. A single-collection filter returns the owner's
 * documents in document-id order, and one seller has far fewer than the 300 a
 * single response carries, so sorting here is both correct and index-free.
 */

const MAX_RESULTS = 200;

function toMillis(value: unknown): number {
  if (value && typeof value === 'object') {
    const maybe = value as { toMillis?: () => number; _seconds?: number };
    if (typeof maybe.toMillis === 'function') return maybe.toMillis();
    if (typeof maybe._seconds === 'number') return maybe._seconds * 1000;
  }
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export async function GET(request: Request) {
  const user = await verifyRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // `firestore.rules` allows `read` on /media only when the document's userId
  // is the caller, and a Firestore list rule is evaluated per returned
  // document — so this filter is what makes the query permitted, not a
  // client-side convenience.
  const snap = await db
    .collection(MEDIA_COLLECTION)
    .where('userId', '==', user.uid)
    .limit(MAX_RESULTS)
    .get();

  const files = snap.docs
    .map((doc) => {
      const data = doc.data() as MediaRecord;
      return {
        mediaId: doc.id,
        type: data.type,
        originalName: data.originalName ?? '',
        mimeType: data.mimeType ?? '',
        // The bytes actually on disk after compression, which is the number a
        // seller asking "how much space does this take" wants — not the size of
        // the file they picked from their phone.
        sizeBytes: data.sizeBytes ?? 0,
        width: data.width ?? null,
        height: data.height ?? null,
        durationSeconds: data.durationSeconds ?? null,
        status: data.status,
        createdAtMs: toMillis(data.createdAt),
        ...mediaRecordToUrls(data),
      };
    })
    .filter((f) => f.status !== 'DELETED')
    .sort((a, b) => b.createdAtMs - a.createdAtMs);

  const totalBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);

  return NextResponse.json({
    files,
    totals: {
      count: files.length,
      images: files.filter((f) => f.type === 'image').length,
      videos: files.filter((f) => f.type === 'video').length,
      totalBytes,
      /** True when the list hit the cap, so the UI can say "showing N of many". */
      truncated: snap.size >= MAX_RESULTS,
    },
  });
}