import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { Order } from '@/lib/types';

/**
 * Seller order status transition.
 *
 * The admin route (`/api/admin/orders/[orderId]/status`) is admin-only, so the
 * seller dashboard's inline actions ("Confirm payment", "Mark shipped", …) had
 * nowhere to go. This route performs the same update but authorises the caller
 * as the seller of THAT order — a seller can only move their own orders, and
 * only through the forward transitions below.
 */

const ALLOWED_TRANSITIONS: Record<string, Order['orderStatus'][]> = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivery', 'delivered'],
  delivery: ['delivered'],
  disputed: ['processing'],
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized: Missing or malformed token' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await auth.verifyIdToken(authHeader.split('Bearer ')[1]);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      status?: Order['orderStatus'];
      trackingNumber?: string;
      courierName?: string;
    };
    const status = body.status;
    if (!status) {
      return NextResponse.json({ error: 'A target status is required' }, { status: 400 });
    }

    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orderSnap.data() as Order;
    const isOwner = order.sellerId === uid || order.resellerId === uid;
    if (!isOwner) {
      return NextResponse.json({ error: 'Forbidden: This order belongs to another seller' }, { status: 403 });
    }

    const current = order.orderStatus;
    const allowed = ALLOWED_TRANSITIONS[current] ?? [];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `Cannot move an order from "${current}" to "${status}".` },
        { status: 400 },
      );
    }

    const update: Record<string, unknown> = {
      orderStatus: status,
      timeline: FieldValue.arrayUnion({
        status,
        date: FieldValue.serverTimestamp(),
        updatedBy: uid,
      }),
    };
    if (status === 'shipped') {
      if (body.trackingNumber) update.trackingNumber = body.trackingNumber;
      if (body.courierName) update.courierName = body.courierName;
    }

    await orderRef.update(update);
    return NextResponse.json({ success: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error updating seller order ${orderId}:`, message);
    return NextResponse.json({ error: 'Could not update the order' }, { status: 500 });
  }
}