
import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { Order } from '@/lib/types';

/**
 * PUT handler to update the status of an order.
 * This is an admin-only protected route.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const orderId = params.orderId;
  if (!orderId) {
    return NextResponse.json({ message: 'Order ID is required' }, { status: 400 });
  }

  // 1. Verify the user is an authenticated admin
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ message: 'Unauthorized: Missing or malformed token' }, { status: 401 });
  }
  const token = authHeader.split('Bearer ')[1];

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(token);
    // Check for admin custom claim
    if (decodedToken.role !== 'admin') {
      return NextResponse.json({ message: 'Forbidden: User is not an admin' }, { status: 403 });
    }
  } catch (error) {
    return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
  }

  try {
    const { status } = await request.json();
    const validStatuses: Order['orderStatus'][] = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'disputed'];

    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ message: 'Invalid status provided' }, { status: 400 });
    }

    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    // 2. Update the document with the new status and timeline event
    await orderRef.update({
      orderStatus: status,
      timeline: FieldValue.arrayUnion({
        status: status,
        date: FieldValue.serverTimestamp(),
        updatedBy: 'admin' // Optional: tag that an admin made this change
      }),
    });

    return NextResponse.json({ success: true, message: `Order status updated to ${status}` });

  } catch (error: any) {
    console.error(`Error updating order ${orderId}:`, error);
    return NextResponse.json({ message: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
