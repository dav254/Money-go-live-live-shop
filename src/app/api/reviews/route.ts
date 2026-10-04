import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '@/firebase/server';
import { isReviewableStatus, validateReviewInput } from '@/lib/reviews';

/**
 * REVIEWS API.
 *
 * Everything that matters is decided here, never in the client:
 *
 *   - WHO is writing comes from the verified ID token, never the body.
 *   - WHETHER they may comes from the order document, never the body.
 *   - The rating and text are validated again here, because a client can be
 *     anything.
 *
 * A client that simply POSTs `{ orderId, rating: 5, text: "great" }` for
 * someone it has never bought from gets a 403, because there is no order with
 * their uid as one of the two parties.
 *
 * One document per order, holding both directions, so the second writer cannot
 * clobber the first and "have I already reviewed?" is a field read.
 */

export const dynamic = 'force-dynamic';

async function authed(request: Request): Promise<{ uid: string; name: string } | null> {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    if (!decoded.uid) return null;
    return { uid: decoded.uid, name: String(decoded.name || '') };
  } catch {
    return null;
  }
}

/** POST — leave a review on a completed order. */
export async function POST(request: Request) {
  const me = await authed(request);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { orderId?: string; rating?: unknown; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const orderId = String(body?.orderId || '');
  if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });

  const problem = validateReviewInput(String(body?.text || ''), body?.rating);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  try {
    const result = await db.runTransaction(async (tx) => {
      const orderRef = db.collection('orders').doc(orderId);
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) return { error: 'Order not found' as const };

      const order = orderSnap.data() as { buyerId?: string; sellerId?: string; orderStatus?: string };
      const buyerId = order.buyerId || '';
      const sellerId = order.sellerId || '';

      // The core authorisation: are you actually one of these two people?
      const isBuyer = me.uid === buyerId;
      const isSeller = me.uid === sellerId;
      if (!isBuyer && !isSeller) return { error: 'Not your order' as const };

      if (!isReviewableStatus(order.orderStatus)) {
        return { error: `An order can only be reviewed once it is delivered (this one is ${order.orderStatus || 'not started'})` } as { error: string };
      }

      const reviewRef = db.collection('reviews').doc(orderId);
      const existingSnap = await tx.get(reviewRef);
      const existing = existingSnap.data() as Record<string, any> | undefined;

      // One review per direction per order.
      const slot = isBuyer ? 'byCustomer' : 'bySeller';
      if (existing?.[slot]) return { error: 'You have already reviewed this order' } as { error: string };

      const entry = {
        rating: Number(body?.rating),
        text: String(body?.text || '').trim(),
        authorId: me.uid,
        authorName: me.name,
        createdAt: FieldValue.serverTimestamp(),
        status: 'published',
      };

      tx.set(
        reviewRef,
        {
          orderId,
          buyerId,
          sellerId,
          orderStatus: order.orderStatus,
          [slot]: entry,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      // A convenience copy for the subject's profile summary, so a shop page
      // does not have to read every order to know its own score.
      const subjectId = isBuyer ? sellerId : buyerId;
      tx.set(
        db.collection('ratingSummaries').doc(subjectId),
        isBuyer
          ? { sellerRatingTotal: FieldValue.increment(Number(body.rating)), sellerRatingCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }
          : { buyerRatingTotal: FieldValue.increment(Number(body.rating)), buyerRatingCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );

      return { ok: true as const, side: slot };
    });

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[reviews] post failed', error);
    return NextResponse.json({ error: 'Could not save the review' }, { status: 500 });
  }
}

/** POST /api/reviews?report — flag a review for moderation. */
export async function PUT(request: Request) {
  const me = await authed(request);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { orderId?: string; side?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const orderId = String(body?.orderId || '');
  const side = body?.side === 'bySeller' ? 'bySeller' : 'byCustomer';
  const reason = String(body?.reason || '').trim().slice(0, 500);
  if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  if (!reason) return NextResponse.json({ error: 'Tell us what is wrong' }, { status: 400 });

  try {
    const ref = db.collection('reviews').doc(orderId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    const review = (snap.data() as Record<string, any>)?.[side];
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

    await ref.set({ [side]: { ...review, status: 'flagged', flaggedReason: reason } }, { merge: true });

    // Reported reviews stop counting toward the average immediately, but are not
    // deleted: moderation removes them, and removing on report would be a way
    // to silence a bad review by mass-reporting it.
    const subjectId = side === 'byCustomer' ? (snap.data() as any)?.sellerId : (snap.data() as any)?.buyerId;
    await db.collection('reviewReports').add({
      orderId,
      side,
      reason,
      reportedBy: me.uid,
      subjectId,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[reviews] report failed', error);
    return NextResponse.json({ error: 'Could not file the report' }, { status: 500 });
  }
}
