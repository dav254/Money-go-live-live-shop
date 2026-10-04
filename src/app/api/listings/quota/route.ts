import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { db } from '@/firebase/server';
import { SELLER_MEDIA_QUOTA_FREE, mediaItemCount } from '@/lib/listings/limits';

/**
 * SELLER MEDIA QUOTA — how much a seller has used.
 *
 * ## Why this counts on the server
 *
 * The number that matters is the seller's TOTAL across every listing, not the
 * five images on the one being edited. Firestore rules cannot do that: a rule
 * sees a single document and has no way to sum a sibling collection, and there
 * is no composite index that would make it cheap either. So the honest place to
 * answer "how much has this seller used" is the Admin SDK, which reads the
 * seller's own listings and sums them.
 *
 * ## Where it is enforced
 *
 * Here for the count, and in the upload form for the gate. That split is
 * deliberate and it is also a known gap: the form blocks an over-quota submit
 * in the UI, but a seller who bypasses the form and writes `products/{id}`
 * directly through the client SDK would not be stopped. Firestore rules cannot
 * close that, because they cannot count. Fully closing it means routing listing
 * writes through a server route that re-checks the quota — that is the natural
 * home for the paid-upgrade gate too, since that is where "has this seller paid
 * for more" has to be answered.
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
      listings++;
    }

    last = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE) break;
  }

  return { used, listings };
}

export async function GET(request: Request) {
  const uid = await idTokenUser(request);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { used, listings } = await usedMediaFor(uid);
    const quota = Number(
      (await db.collection('userProfiles').doc(uid).get()).data()?.mediaQuota,
    ) || SELLER_MEDIA_QUOTA_FREE;

    return NextResponse.json({
      used,
      listings,
      quota,
      remaining: Math.max(0, quota - used),
      full: used >= quota,
    });
  } catch (error) {
    console.error('[quota] count failed', error);
    return NextResponse.json({ error: 'Could not read your usage' }, { status: 500 });
  }
}
