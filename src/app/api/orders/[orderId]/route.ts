import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { pocketBaseEnabled } from '@/lib/pocketbase/server';
import { pbGetOrder, pbDeleteOrder } from '@/lib/pocketbase/orders';
import { pbGetProfile } from '@/lib/pocketbase/profiles';
import type { Order } from '@/lib/types';

/**
 * DELETE handler updated for Next.js 15 Async Params.
 */
export async function DELETE(
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

  const userId = decodedToken.uid;
  const orderRef = db.collection('orders').doc(orderId);  try {
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
        console.error('[order-delete] Firestore read failed:', error);
        if (!mirrored) {
          return NextResponse.json({ message: 'Order store unreachable.' }, { status: 503 });
        }
      }
    }
    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    // Role: VPS profile first, Firestore second.
    let isAdmin = (await pbGetProfile(userId))?.userRole === 'admin';
    if (!isAdmin) {
      isAdmin = await db
        .collection('userProfiles')
        . doc(userId)
        .get()
        .then((p) => p.data()?.userRole === 'admin')
        .catch(() => false);
    }

    if (order.sellerId !== userId && !isAdmin) {
      return NextResponse.json({ message: 'Forbidden: You do not have permission to delete this order' }, { status: 403 });
    }

    // VPS-PRIMARY when PocketBase is on: drop the VPS copy first, then the
    // Firestore doc best-effort. The original Firestore delete is the fallback.
    let deletedOnVps = false;
    if (pocketBaseEnabled()) {
      deletedOnVps = await pbDeleteOrder(orderId);
      if (deletedOnVps) {
        try {
          await orderRef.delete();
        } catch (error) {
          console.error('[order-delete] Firestore mirror failed (order removed on VPS):', error);
        }
        return NextResponse.json({ success: true, message: 'Order successfully deleted' });
      }
    }
    await orderRef.delete();
    void pbDeleteOrder(orderId);
    return NextResponse.json({ success: true, message: 'Order successfully deleted' });
  } catch (error: any) {
    console.error(`Error deleting order ${orderId}:`, error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}