import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { awardDeliveryPoints } from '@/lib/points/delivery';
import { pocketBaseEnabled } from '@/lib/pocketbase/server';
import { pbIsAdmin } from '@/lib/pocketbase/admins';
import { pbGetOrder, pbPatchOrder } from '@/lib/pocketbase/orders';
import { pbGetProfile } from '@/lib/pocketbase/profiles';
import type { Order } from '@/lib/types';

/**
 * PUT handler updated for Next.js 15 Async Params.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  
  if (!orderId) {
    return NextResponse.json({ message: 'Order ID is required' }, { status: 400 });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ message: 'Unauthorized: Missing or malformed token' }, { status: 401 });
  }
  const token = authHeader.split('Bearer ')[1];

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(token);
  } catch (error) {
    return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
  }
  // Role: local admin grant, then VPS profile, then Firestore — so the
  // buttons keep working when the Firestore project is blocked.
  const isAdmin =
    (await pbIsAdmin(decodedToken.uid)) === true ||
    (await pbGetProfile(decodedToken.uid))?.userRole === 'admin' ||
    (await db
      .collection('userProfiles')
      .doc(decodedToken.uid)
      .get()
      .then((p) => p.data()?.userRole === 'admin')
      .catch(() => false));
  if (!isAdmin) {
    return NextResponse.json({ message: 'Forbidden: User is not an admin' }, { status: 403 });
  }

  try {
    const { status } = await request.json();
    const validStatuses: Order['orderStatus'][] = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'disputed'];

    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ message: 'Invalid status provided' }, { status: 400 });
    }

    const orderRef = db.collection('orders').doc(orderId);

    // VPS store first, Firestore second.
    const mirrored = await pbGetOrder(orderId);
    let order: Order | null =
      mirrored?.data && Object.keys(mirrored.data).length > 0
        ? (mirrored.data as unknown as Order)
        : null;
    if (!order) {
      try {
        const orderSnap = await orderRef.get();
        order = orderSnap.exists ? ((orderSnap.data() ?? null) as Order | null) : null;
      } catch (error) {
        console.error('[admin/order-status] Firestore read failed:', error);
        if (!mirrored) {
          return NextResponse.json({ message: 'Order store unreachable.' }, { status: 503 });
        }
      }
    }

    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    const update: Record<string, unknown> = {
      orderStatus: status,
      timeline: FieldValue.arrayUnion({
        status: status,
        date: FieldValue.serverTimestamp(),
        updatedBy: 'admin'
      }),
    };
    // Plain-JSON twin of the update for the VPS mirror.
    const patch: Record<string, unknown> = {
      orderStatus: status,
      timeline: [
        ...((Array.isArray(order.timeline) ? order.timeline : []) as unknown[]),
        { status, date: new Date().toISOString(), updatedBy: 'admin' },
      ],
    };

    // VPS-PRIMARY when PocketBase is on; the other store gets a best-effort
    // copy either way, and the original Firestore update is the fallback.
    let updatedOnVps = false;
    if (pocketBaseEnabled()) {
      updatedOnVps = await pbPatchOrder(orderId, patch);
      if (updatedOnVps) {
        try {
          await orderRef.update(update);
        } catch (error) {
          console.error('[admin/order-status] Firestore mirror failed (status kept on VPS):', error);
        }
      }
    }
    if (!updatedOnVps) {
      await orderRef.update(update);
      void pbPatchOrder(orderId, patch);
    }

    // Same reward as the seller route: whoever confirms the delivery, both
    // sides earn their points. The flag on the order keeps an admin re-set of
    // the status from paying the same order twice. See lib/points/delivery.ts.
    if (status === 'delivered') {
      await awardDeliveryPoints(db, order as Order, orderId).catch((err) =>
        console.error(`Delivery points failed for order ${orderId}:`, err),
      );
    }

    return NextResponse.json({ success: true, message: `Order status updated to ${status}` });

  } catch (error: any) {
    console.error(`Error updating order ${orderId}:`, error);
    return NextResponse.json({ message: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}