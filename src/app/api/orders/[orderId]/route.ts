
import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import type { Order } from '@/lib/types';

/**
 * DELETE handler to permanently delete an order.
 * This uses the correct Firebase Admin SDK syntax.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const orderId = params.orderId;
  if (!orderId) {
    return NextResponse.json({ message: 'Order ID is required' }, { status: 400 });
  }

  // 1. Verify the user is authenticated
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
  // Correct: Use the Admin SDK's object-oriented syntax
  const orderRef = db.collection('orders').doc(orderId);

  try {
    // 2. Verify the user is the owner of the order
    // Correct: Use orderRef.get()
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) { // Correct: .exists is a property
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    const order = orderSnap.data() as Order;
    if (order.sellerId !== userId) {
      // If the user is not the seller, they are not authorized to delete it.
      return NextResponse.json({ message: 'Forbidden: You do not have permission to delete this order' }, { status: 403 });
    }

    // 3. Delete the document
    // Correct: Use orderRef.delete()
    await orderRef.delete();

    return NextResponse.json({ success: true, message: 'Order successfully deleted' });
  } catch (error: any) {
    console.error(`Error deleting order ${orderId}:`, error);
    return NextResponse.json({ message: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
