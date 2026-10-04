import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { db } from '@/firebase/server';
import { ensureBusinessForSeller } from '@/lib/business/ensure';

/**
 * CREATE A BUSINESS ON FIRST LISTING.
 *
 * Called by the seller after their first publish succeeds. Idempotent: a seller
 * who already has a business gets a no-op, so this can be called on every
 * publish without checking anything on the client first.
 *
 * ## Why the seller comes from a listing, not the body
 *
 * The body names a `productId`. The server reads that product, takes ITS
 * `sellerId`, and checks it matches the caller's verified uid. If they differ,
 * it refuses. So a client cannot create a business on somebody else's account
 * by posting their uid — the uid in the request is never used to decide who
 * the business belongs to.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    uid = decoded.uid || '';
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { productId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const productId = String(body?.productId || '');
  if (!productId) return NextResponse.json({ error: 'productId is required' }, { status: 400 });

  try {
    const snap = await db.collection('products').doc(productId).get();
    if (!snap.exists) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });

    const sellerId = (snap.data() as { sellerId?: string })?.sellerId || '';
    // The one authorisation that matters.
    if (sellerId !== uid) {
      return NextResponse.json({ error: 'Not your listing' }, { status: 403 });
    }

    const result = await ensureBusinessForSeller(uid);
    if (!result) {
      return NextResponse.json(
        { error: 'Set your name first, then publish again — we need it to name your business.' },
        { status: 422 },
      );
    }

    // Stamp the listing that triggered this, in case it missed the batch above.
    if (!snap.data()?.businessId) {
      await snap.ref.set({ businessId: result.businessId }, { merge: true });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[business] ensure failed', error);
    return NextResponse.json({ error: 'Could not set up the business' }, { status: 500 });
  }
}
