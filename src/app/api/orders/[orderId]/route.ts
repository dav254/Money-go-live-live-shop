import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
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
  const orderRef = db.collection('orders').doc(orderId);

  try {
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    const order = orderSnap.data() as Order;
    const userProfile = await db.collection('userProfiles').doc(userId).get();
    const isAdmin = userProfile.data()?.userRole === 'admin';

    if (order.sellerId !== userId && !isAdmin) {
      return NextResponse.json({ message: 'Forbidden: You do not have permission to delete this order' }, { status: 403 });
    }

    await orderRef.delete();
    return NextResponse.json({ success: true, message: 'Order successfully deleted' });
  } catch (error: any) {
    console.error(`Error deleting order ${orderId}:`, error);
    return NextResponse.json({ message: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}