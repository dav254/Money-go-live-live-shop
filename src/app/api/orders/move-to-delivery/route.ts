import { NextResponse } from 'next/server';
import { db, auth as adminAuth } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { pocketBaseEnabled } from '@/lib/pocketbase/server';
import { pbGetOrder, pbPatchOrder } from '@/lib/pocketbase/orders';

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

    // VPS store first, Firestore second.
    const mirrored = await pbGetOrder(orderId);
    let orderData: Record<string, unknown> | null =
      mirrored?.data && Object.keys(mirrored.data).length > 0 ? mirrored.data : null;
    if (!orderData) {
      try {
        const orderDoc = await orderRef.get();
        orderData = orderDoc.exists ? ((orderDoc.data() ?? null) as Record<string, unknown> | null) : null;
      } catch (error) {
        console.error('[move-to-delivery] Firestore read failed:', error);
        if (!mirrored) {
          return NextResponse.json({ error: 'Order store unreachable.' }, { status: 503 });
        }
      }
    }

    if (!orderData) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (orderData.sellerId !== decodedToken.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const update: Record<string, unknown> = {
      orderStatus: 'delivery',
      courierName: courierName || null,
      dispatchNote: dispatchNote || null,
      updatedAt: FieldValue.serverTimestamp(),
    };
    // Plain-JSON twin for the VPS mirror.
    const patch: Record<string, unknown> = {
      orderStatus: 'delivery',
      courierName: courierName || null,
      dispatchNote: dispatchNote || null,
      updatedAt: new Date().toISOString(),
    };

    // VPS-PRIMARY when PocketBase is on; the other store gets a best-effort
    // copy either way, and the original Firestore update is the fallback.
    let updatedOnVps = false;
    if (pocketBaseEnabled()) {
      updatedOnVps = await pbPatchOrder(orderId, patch);
      if (updatedOnVps) {
        try {
          await orderRef.update(update);
        } catch (error) {
          console.error('[move-to-delivery] Firestore mirror failed (dispatch kept on VPS):', error);
        }
      }
    }
    if (!updatedOnVps) {
      await orderRef.update(update);
      void pbPatchOrder(orderId, patch);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Move to delivery error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}