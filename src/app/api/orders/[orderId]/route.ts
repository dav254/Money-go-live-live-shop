
import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { doc, getDoc, deleteDoc } from 'firebase-admin/firestore';
import type { Order } from '@/lib/types';

/**
 * DELETE handler to permanently delete an order.
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
  const orderRef = doc(db, 'orders', orderId);

  try {
    // 2. Verify the user is the owner of the order
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    const order = orderSnap.data() as Order;
    if (order.sellerId !== userId) {
      // If the user is not the seller, they are not authorized to delete it.
      return NextResponse.json({ message: 'Forbidden: You do not have permission to delete this order' }, { status: 403 });
    }

    // 3. Delete the document
    await deleteDoc(orderRef);

    return NextResponse.json({ success: true, message: 'Order successfully deleted' });
  } catch (error: any) {
    console.error(`Error deleting order ${orderId}:`, error);
    return NextResponse.json({ message: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
