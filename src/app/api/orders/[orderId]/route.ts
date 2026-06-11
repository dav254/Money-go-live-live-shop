import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import type { Order } from '@/lib/types';

/**
<<<<<<< HEAD
 * DELETE handler to permanently delete an order.
 * This uses the correct Firebase Admin SDK syntax and awaits params for Next.js 15.
=======
 * DELETE handler updated for Next.js 15 Async Params.
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
<<<<<<< HEAD
=======
  
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
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
<<<<<<< HEAD
    // Verify user is an admin or the seller owner
    const adminSnap = await db.doc(`userProfiles/${userId}`).get();
    const isAdmin = adminSnap.data()?.userRole === 'admin';

    if (order.sellerId !== userId && !isAdmin) {
      return NextResponse.json({ message: 'Forbidden: Unauthorized action' }, { status: 403 });
=======
    const userProfile = await db.collection('userProfiles').doc(userId).get();
    const isAdmin = userProfile.data()?.userRole === 'admin';

    if (order.sellerId !== userId && !isAdmin) {
      return NextResponse.json({ message: 'Forbidden: You do not have permission to delete this order' }, { status: 403 });
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
    }

    await orderRef.delete();
    return NextResponse.json({ success: true, message: 'Order successfully deleted' });
  } catch (error: any) {
    console.error(`Error deleting order ${orderId}:`, error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
