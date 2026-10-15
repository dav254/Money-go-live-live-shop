import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { notify } from '@/lib/notifications';
import { broadcastAdminAlert } from '@/lib/whatsapp/bridge';
import type { Order } from '@/lib/types';

/**
 * Paystack Webhook Handler (App Router)
 */
export async function POST(request: Request) {
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY!;
  const signature = request.headers.get('x-paystack-signature');
  
  const rawBody = await request.text();
  const hash = createHmac('sha512', paystackSecret).update(rawBody).digest('hex');

  if (hash !== signature) {
    console.warn('Paystack Webhook: Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    const event = JSON.parse(rawBody);

    if (event.event === 'charge.success') {
      const metadata = event.data.metadata;
      const transactionType = metadata?.transactionType;

      if (transactionType === 'points-purchase') {
        const userId = metadata.userId;
        const points = metadata.points;
        const amount = event.data.amount / 100;

        if (userId && points) {
          const userProfileRef = db.collection('userProfiles').doc(userId);
          await userProfileRef.update({
            aiPoints: FieldValue.increment(points)
          });

          await db.collection('payments').add({
            userId: userId,
            amount: amount,
            paymentMethod: `paystack_${event.data.channel}`,
            paymentStatus: 'completed',
            paymentDate: FieldValue.serverTimestamp(),
            transactionType: 'points-purchase',
            transactionId: event.data.id,
          });
        }
      } else {
        const orderId = metadata?.orderId || event.data.reference;
        if (orderId) {
          const orderRef = db.collection('orders').doc(orderId);
          const orderSnap = await orderRef.get();
          if (orderSnap.exists) {
            const orderData = orderSnap.data() as Order;
            await orderRef.update({
              orderStatus: 'processing',
              paymentMethod: `paystack_${event.data.channel}`,
              updatedAt: FieldValue.serverTimestamp(),
            });
            await db.collection('payments').add({
              orderId: orderId,
              userId: orderData.buyerId,
              amount: orderData.totalAmount,
              paymentMethod: `paystack_${event.data.channel}`,
              paymentStatus: 'completed',
              paymentDate: FieldValue.serverTimestamp(),
              transactionType: 'product-purchase',
              transactionId: event.data.id,
            });

            /*
             * Both sides find out immediately. The buyer gets "payment
             * received", the seller gets the "prepare for delivery" alert that
             * answers "how do I know the buyer has paid". `notify` swallows its
             * own failures — a notification problem must never fail the
             * webhook that just recorded a real payment.
             */
            await notify({
              db,
              userId: orderData.buyerId,
              type: 'PAYMENT_CONFIRMED',
              title: 'Payment received',
              message: `We received your payment for order #${orderId.slice(0, 8)}. The seller is preparing it now.`,
              entityType: 'ORDER',
              entityId: orderId,
              link: '/buyer/my-orders',
            }).catch(() => undefined);
            if (orderData.sellerId) {
              await notify({
                db,
                userId: orderData.sellerId,
                type: 'PAYMENT_RECEIVED',
                title: 'Buyer has paid — prepare for delivery',
                message: `Payment confirmed for order #${orderId.slice(0, 8)}. Mark it as shipped from your Orders page once it's dispatched.`,
                entityType: 'ORDER',
                entityId: orderId,
                link: '/dashboard/seller/orders',
              }).catch(() => undefined);
            }

            // WhatsApp alert for the admin team — the self-hosted bridge in
            // lib/whatsapp/bridge.ts, a silent no-op until a phone is paired.
            // Fire-and-forget: a WhatsApp hiccup must never fail the webhook
            // that just recorded a real payment.
            broadcastAdminAlert(
              '💰 Payment received',
              `Order #${orderId.slice(0, 8)} was paid${orderData.totalAmount ? ` — $${orderData.totalAmount}` : ''}.`,
            ).catch(() => undefined);
          }
        }
      }
    }
    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    console.error('Paystack Webhook Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
