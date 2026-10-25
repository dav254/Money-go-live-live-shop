import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { notify } from '@/lib/notifications';
import { awardDeliveryPoints, DELIVERY_POINTS_PER_PARTY } from '@/lib/points/delivery';
import { broadcastAdminAlert } from '@/lib/whatsapp/bridge';
import { pocketBaseEnabled } from '@/lib/pocketbase/server';
import { pbGetOrder, pbPatchOrder } from '@/lib/pocketbase/orders';
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

    /*
     * VPS store first, Firestore second — moving an order along must not
     * depend on the same store whose outage would strand it at "processing".
     */
    const mirrored = await pbGetOrder(orderId);
    let order: Order | null =
      mirrored?.data && Object.keys(mirrored.data).length > 0
        ? (mirrored.data as unknown as Order)
        : null;
    if (!order) {
      try {
        const orderSnap = await orderRef.get();
        order = orderSnap.exists ? ((orderSnap.data() ?? null) as Order | null) : null;
      } catch (error) {
        console.error('[seller/order-status] Firestore read failed:', error);
        if (!mirrored) {
          return NextResponse.json({ error: 'Order store unreachable.' }, { status: 503 });
        }
      }
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
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
    /*
     * Plain-JSON twin of the update for the VPS mirror — the mirror merges
     * plain values (no FieldValue sentinels), appended onto whatever timeline
     * the mirrored copy already carries.
     */
    const patch: Record<string, unknown> = {
      orderStatus: status,
      timeline: [
        ...((Array.isArray(order.timeline) ? order.timeline : []) as unknown[]),
        { status, date: new Date().toISOString(), updatedBy: uid },
      ],
    };
    if (status === 'shipped') {
      if (body.trackingNumber) {
        update.trackingNumber = body.trackingNumber;
        patch.trackingNumber = body.trackingNumber;
      }
      if (body.courierName) {
        update.courierName = body.courierName;
        patch.courierName = body.courierName;
      }
    }

    /*
     * VPS-PRIMARY WRITE (PocketBase configured): the status lands on this
     * machine first, and Firestore receives the same update best-effort — its
     * failure must not keep an order stuck. The original Firestore update
     * stays as the path when PocketBase is off or its write failed.
     */
    let updatedOnVps = false;
    if (pocketBaseEnabled()) {
      updatedOnVps = await pbPatchOrder(orderId, patch);
      if (updatedOnVps) {
        try {
          await orderRef.update(update);
        } catch (error) {
          console.error('[seller/order-status] Firestore mirror failed (status kept on VPS):', error);
        }
      }
    }
    if (!updatedOnVps) {
      await orderRef.update(update);
      // Keep the VPS copy in step when Firestore was the store that took it.
      void pbPatchOrder(orderId, patch);
    }

    /*
     * Tell the buyer. Their order screen updates live, but a dispatch or a
     * cancellation is exactly what a buyer wants pushed to their phone rather
     * than discovered on a future visit. `notify` fans out in-app + email +
     * push and swallows its own failures, so a notification problem can never
     * fail the status change that triggered it.
     */
    const BUYER_MESSAGE: Partial<Record<Order['orderStatus'], { title: string; message: string }>> = {
      shipped: {
        title: 'Your order is on the way',
        message: `Order #${orderId.slice(0, 8)} has been dispatched by the seller.`,
      },
      delivery: {
        title: 'Your order is out for delivery',
        message: `Order #${orderId.slice(0, 8)} is in delivery.`,
      },
      delivered: {
        title: 'Order delivered',
        message: `Order #${orderId.slice(0, 8)} has been marked as delivered — you earned ${DELIVERY_POINTS_PER_PARTY} points. Confirm everything arrived in order.`,
      },
      cancelled: {
        title: 'Order cancelled',
        message: `Order #${orderId.slice(0, 8)} was cancelled by the seller. Any payment will be refunded.`,
      },
    };
    const buyerMessage = BUYER_MESSAGE[status];
    if (buyerMessage && order.buyerId) {
      /*
       * Email address for the order-status mail — looked up from the buyer's
       * profile, and simply skipped when the account has no address. `notify`
       * swallows email failures, so a missing profile can never affect the
       * status change.
       */
      const buyerProfile = await db
        .collection('userProfiles')
        .doc(order.buyerId)
        .get()
        .catch(() => null);
      const buyerEmail = buyerProfile?.data()?.email as string | undefined;
      const buyerName = buyerProfile?.data()?.fullName as string | undefined;

      await notify({
        db,
        userId: order.buyerId,
        type: 'ORDER_STATUS',
        title: buyerMessage.title,
        message: buyerMessage.message,
        entityType: 'ORDER',
        entityId: orderId,
        link: '/buyer/my-orders',
        email: buyerEmail
          ? {
              to: buyerEmail,
              templateKey: 'order-status',
              category: 'orders',
              userName: buyerName,
              vars: {
                order_number: `#${orderId.slice(0, 8)}`,
                status,
              },
            }
          : undefined,
      }).catch(() => undefined);
    }

    /*
     * A confirmed delivery pays both sides in points — seller and buyer get
     * the same amount, because both held up their end. The award is one-shot
     * (guarded on the order inside a transaction), and the seller is told so
     * the balance change never looks arbitrary. See lib/points/delivery.ts.
     */
    // WhatsApp alert for the admin team (self-hosted bridge; a no-op until a
    // phone is paired). Fire-and-forget — never blocks the status change.
    broadcastAdminAlert(
      '📦 Order update',
      `Order #${orderId.slice(0, 8)} is now "${status}".`,
    ).catch(() => undefined);

    if (status === 'delivered') {
      const awarded = await awardDeliveryPoints(db, order, orderId).catch(() => false);
      if (awarded && order.sellerId) {
        await notify({
          db,
          userId: order.sellerId,
          type: 'ORDER_STATUS',
          title: 'Delivery complete',
          message: `Order #${orderId.slice(0, 8)} is delivered. ${DELIVERY_POINTS_PER_PARTY} points were added to your balance.`,
          entityType: 'ORDER',
          entityId: orderId,
          link: '/app/seller/points',
        }).catch(() => undefined);
      }
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error updating seller order ${orderId}:`, message);
    return NextResponse.json({ error: 'Could not update the order' }, { status: 500 });
  }
}