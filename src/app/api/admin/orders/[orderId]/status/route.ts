import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
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
    const userProfile = await db.collection('userProfiles').doc(decodedToken.uid).get();
    if (userProfile.data()?.userRole !== 'admin') {
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

    await orderRef.update({
      orderStatus: status,
      timeline: FieldValue.arrayUnion({
        status: status,
        date: FieldValue.serverTimestamp(),
        updatedBy: 'admin'
      }),
    });

    return NextResponse.json({ success: true, message: `Order status updated to ${status}` });

  } catch (error: any) {
    console.error(`Error updating order ${orderId}:`, error);
    return NextResponse.json({ message: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
