
import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { Order } from '@/lib/types';

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
