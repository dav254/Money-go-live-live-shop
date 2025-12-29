
import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { Order } from '@/lib/types';

/**
 * API route to update the status of a specific order.
 * Only accessible by administrators.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const orderId = params.orderId;
  if (!orderId) {
    return NextResponse.json({ message: 'Order ID is required' }, { status: 400 });
  }

  const { status } = await request.json();
  const validStatuses: Order['orderStatus'][] = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'disputed'];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ message: 'Invalid status provided' }, { status: 400 });
  }

  // 1. Verify the user is an authenticated admin
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ message: 'Unauthorized: Missing or malformed token' }, { status: 401 });
  }
  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(token);
    const userProfileSnap = await db.doc(`userProfiles/${decodedToken.uid}`).get();
    
    if (!userProfileSnap.exists || userProfileSnap.data()?.userRole !== 'admin') {
      return NextResponse.json({ message: 'Forbidden: You do not have permission to perform this action' }, { status: 403 });
    }

    // 2. Update the order document
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }
    
    // Add the new status to the history timeline
    const timelineEntry = {
        status: status,
        date: FieldValue.serverTimestamp(),
    };

    await orderRef.update({
        orderStatus: status,
        timeline: FieldValue.arrayUnion(timelineEntry)
    });

    return NextResponse.json({ success: true, message: 'Order status updated successfully' });

  } catch (error: any) {
    if (error.code === 'auth/id-token-expired') {
      return NextResponse.json({ message: 'Unauthorized: Token expired' }, { status: 401 });
    }
    console.error(`Error updating order status for ${orderId}:`, error);
    return NextResponse.json({ message: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
