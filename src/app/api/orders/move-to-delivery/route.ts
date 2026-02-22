
import { NextResponse } from 'next/server';
import { db, auth as adminAuth } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * App Router endpoint to transition an order to the 'delivery' status.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const { orderId, courierName, dispatchNote } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const orderData = orderDoc.data();
    if (orderData?.sellerId !== decodedToken.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await orderRef.update({
      orderStatus: 'delivery',
      courierName: courierName || null,
      dispatchNote: dispatchNote || null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Move to delivery error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
