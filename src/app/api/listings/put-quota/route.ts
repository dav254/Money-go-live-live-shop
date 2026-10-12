import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { db } from '@/firebase/server';
import { SELLER_MEDIA_QUOTA_FREE, mediaItemCount } from '@/lib/listings/limits';

/** SELLER MEDIA WRITE GATE — whether a creator (product or request)
 *  may add media while their total is already at quota.
 *
 * ## Why this exists
 *
 * `/api/listings/quota` answers *how much has this seller used*. A seller who
 * has already attached 80 items can still open the picker and take up the
 * free slots on the disk, then have everything refused at publish, or —
 * worse — have a partial write land. The publisher needs the opposite answer,
 * and it must be handed on the server: Firestore rules cannot count, and a
 * client that simply drops a `solutions` document with {media: []} would not
 * be stopped by any page in the UI.
 *
 * The bucket is one counter per seller, not one per listing: a seller gets
 * `mediaQuota` (default 80) items across every listing, and both products and
 * request attachments draw from that same pool.
 */
export const dynamic = 'force-dynamic';

/** Counted per request; a seller with a very large catalogue costs a paged read. */
const PAGE = 200;

async function idTokenUser(request: Request): Promise<string | null> {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded.uid || null;
  } catch {
    return null;
  }
}

/** Count a seller's current media usage across every listing. */
async function usedMediaFor(uid: string): Promise<{ used: number; listings: number }> {
  let used = 0;
  let listings = 0;
  let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let page = db.collection('products').where('sellerId', '==', uid).limit(PAGE);
    if (last) page = page.startAfter(last);

    const snap = await page.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      used += mediaItemCount(doc.data());
      listings += 1;
    }

    last = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE) break;
  }

  return { used, listings };
}

export async function POST(request: Request) {
  const uid = await idTokenUser(request);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { used, listings } = await usedMediaFor(uid);
    const quota = Number(
      (await db.collection('userProfiles').doc(uid).get()).data()?.mediaQuota,
    ) || SELLER_MEDIA_QUOTA_FREE;

    const remaining = Math.max(0, quota - used);
    return NextResponse.json({
      allowed: remaining > 0,
      remaining,
      quota,
      used,
      listings,
      blocked: remaining === 0,
    });
  } catch (error) {
    console.error('[listings/put-quota]', error);
    return NextResponse.json({ error: 'Could not check your media limit.' }, { status: 500 });
  }
}
