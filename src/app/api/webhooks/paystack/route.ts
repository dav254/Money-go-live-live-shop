import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { notify } from '@/lib/notifications';
import { broadcastAdminAlert } from '@/lib/whatsapp/bridge';
import { pocketBaseEnabled } from '@/lib/pocketbase/server';
import { pbPatchOrder } from '@/lib/pocketbase/orders';
import { pbMirrorPayment } from '@/lib/pocketbase/wallet';
import { pbAdjustAiPoints } from '@/lib/pocketbase/profiles';
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
        const amount = event.data.amount / 100;        if (userId && points) {
          const userProfileRef = db.collection('userProfiles'). doc(userId);

          /*
           * Points credited VPS-first (the balance the go-live charge reads
           * lives there too), with the Firestore increment as the other half
           * of the pair — either way both stores end up with the same credit.
           */
          let creditedOnVps = false;
          if (pocketBaseEnabled()) {
            creditedOnVps = (await pbAdjustAiPoints(userId, Number(points) || 0)) !== null;
          }
          if (!creditedOnVps) {
            await userProfileRef.update({
              aiPoints: FieldValue.increment(points)
            });
            void pbAdjustAiPoints(userId, Number(points) || 0); // reflect it on the VPS
          } else {
            try {
              await userProfileRef.update({
                aiPoints: FieldValue.increment(points)
              });
            } catch (error) {
              console.error('[paystack] Firestore balance mirror failed (credit kept on VPS):', error);
            }
          }

          /*
           * The payment row itself — VPS-PRIMARY with a deterministic id, so
           * a webhook retry upserts the SAME VPS row (no double credit of the
           * ledger) and a Firestore outage cannot swallow a real payment.
           */
          const paymentRef = db.collection('payments'). doc();
          const plainPayment = {
            userId: userId,
            amount: amount,
            paymentMethod: `paystack_${event.data.channel}`,
            paymentStatus: 'completed',
            paymentDate: new Date().toISOString(),
            transactionType: 'points-purchase',
            transactionId: event.data.id,
          };
          let mirrored = false;
          if (pocketBaseEnabled()) {
            mirrored = await pbMirrorPayment(paymentRef.id, plainPayment);
          }
          try {
            await paymentRef.set({
              userId: userId,
              amount: amount,
              paymentMethod: `paystack_${event.data.channel}`,
              paymentStatus: 'completed',
              paymentDate: FieldValue.serverTimestamp(),
              transactionType: 'points-purchase',
              transactionId: event.data.id,
            });
          } catch (error) {
            if (!mirrored) throw error; // Neither store took it — retry as before.
            console.error('[paystack] Firestore payment mirror failed (payment kept on VPS):', error);
          }
        }
      } else {
        const orderId = metadata?.orderId || event.data.reference;
        if (orderId) {
          const orderRef = db.collection('orders').doc(orderId);
          const orderSnap = await orderRef.get();
          if (orderSnap.exists) {
            const orderData = orderSnap.data() as Order;
            /*
             * Payment acknowledged → the order is `processing`. VPS-PRIMARY
             * when PocketBase is on (a real payment must land somewhere even
             * if Firestore is down — Paystack retries a 500 forever), with a
             * best-effort copy to the other store either way.
             */
            const channel = `paystack_${event.data.channel}`;
            const patch = {
              orderStatus: 'processing',
              paymentMethod: channel,
              updatedAt: new Date().toISOString(),
            };
            let updatedOnVps = false;
            if (pocketBaseEnabled()) {
              updatedOnVps = await pbPatchOrder(orderId, patch);
              if (updatedOnVps) {
                try {
                  await orderRef.update({
                    orderStatus: 'processing',
                    paymentMethod: channel,
                    updatedAt: FieldValue.serverTimestamp(),
                  });
                } catch (error) {
                  console.error('[paystack] Firestore mirror failed (paid order kept on VPS):', error);
                }
              }
            }
            if (!updatedOnVps) {
              await orderRef.update({
                orderStatus: 'processing',
                paymentMethod: channel,
                updatedAt: FieldValue.serverTimestamp(),
              });
              void pbPatchOrder(orderId, patch);
            }
            // Payment row — VPS-PRIMARY with a deterministic id (retries
            // upsert the same row), Firestore best-effort either way.
            const paymentRef = db.collection('payments'). doc();
            const plainPayment = {
              orderId: orderId,
              userId: orderData.buyerId,
              amount: orderData.totalAmount,
              paymentMethod: `paystack_${event.data.channel}`,
              paymentStatus: 'completed',
              paymentDate: new Date().toISOString(),
              transactionType: 'product-purchase',
              transactionId: event.data.id,
            };
            let mirroredPayment = false;
            if (pocketBaseEnabled()) {
              mirroredPayment = await pbMirrorPayment(paymentRef.id, plainPayment);
            }
            try {
              await paymentRef.set({
                orderId: orderId,
                userId: orderData.buyerId,
                amount: orderData.totalAmount,
                paymentMethod: `paystack_${event.data.channel}`,
                paymentStatus: 'completed',
                paymentDate: FieldValue.serverTimestamp(),
                transactionType: 'product-purchase',
                transactionId: event.data.id,
              });
            } catch (error) {
              if (!mirroredPayment) throw error;
              console.error('[paystack] Firestore payment mirror failed (payment kept on VPS):', error);
            }

            /*
             * Both sides find out immediately. The buyer gets "payment
             * received", the seller gets the "prepare for delivery" alert that
             * answers "how do I know the buyer has paid". `notify` swallows its
             * own failures — a notification problem must never fail the
             * webhook that just recorded a real payment.
             */
            /*
             * Recipient addresses for the payment emails, from the profiles.
             * A missing address or profile read failure only skips the mail —
             * `notify` never lets email problems fail this webhook.
             */
            const buyerProfile = await db
              .collection('userProfiles')
              .doc(orderData.buyerId)
              .get()
              .catch(() => null);
            const buyerEmail = buyerProfile?.data()?.email as string | undefined;
            const buyerName = buyerProfile?.data()?.fullName as string | undefined;
            const orderAmount =
              typeof orderData.totalAmount === 'number'
                ? orderData.totalAmount.toLocaleString()
                : String(orderData.totalAmount ?? '');
            // Paystack's charge payload carries the settled currency — the
            // order document itself has no currency field.
            const orderCurrency =
              (event.data as { currency?: string }).currency || 'KES';
            const orderNumber = `#${orderId.slice(0, 8)}`;

            await notify({
              db,
              userId: orderData.buyerId,
              type: 'PAYMENT_CONFIRMED',
              title: 'Payment received',
              message: `We received your payment for order #${orderId.slice(0, 8)}. The seller is preparing it now.`,
              entityType: 'ORDER',
              entityId: orderId,
              link: '/buyer/my-orders',
              email: buyerEmail
                ? {
                    to: buyerEmail,
                    templateKey: 'payment-confirmation',
                    category: 'payments',
                    userName: buyerName,
                    vars: {
                      amount: orderAmount,
                      currency: orderCurrency,
                      order_number: orderNumber,
                    },
                  }
                : undefined,
            }).catch(() => undefined);
            if (orderData.sellerId) {
              const sellerProfile = await db
                .collection('userProfiles')
                .doc(orderData.sellerId)
                .get()
                .catch(() => null);
              const sellerEmail = sellerProfile?.data()?.email as string | undefined;
              const sellerName = sellerProfile?.data()?.fullName as string | undefined;
              const businessName =
                (sellerProfile?.data()?.shopName as string | undefined) || sellerName;

              await notify({
                db,
                userId: orderData.sellerId,
                type: 'PAYMENT_RECEIVED',
                title: 'Buyer has paid — prepare for delivery',
                message: `Payment confirmed for order #${orderId.slice(0, 8)}. Mark it as shipped from your Orders page once it's dispatched.`,
                entityType: 'ORDER',
                entityId: orderId,
                link: '/dashboard/seller/orders',
                email: sellerEmail
                  ? {
                      to: sellerEmail,
                      templateKey: 'payment-received',
                      category: 'payments',
                      userName: sellerName,
                      vars: {
                        business_name: businessName || 'Your business',
                        amount: orderAmount,
                        currency: orderCurrency,
                        order_number: orderNumber,
                      },
                    }
                  : undefined,
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
