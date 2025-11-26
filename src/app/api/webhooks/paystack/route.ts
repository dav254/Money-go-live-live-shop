
import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { db } from '@/firebase/server';
import { doc, updateDoc, increment, getDoc, collection } from 'firebase/firestore';
import type { Product } from '@/lib/types';

const PLATFORM_FEE_RATE = 0.10; // 10%

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

        if (userId && points) {
          const userProfileRef = doc(db, 'userProfiles', userId);
          await updateDoc(userProfileRef, {
            aiPoints: increment(points)
          });
          console.log(`Credited ${points} points to user ${userId} via Paystack.`);
        }

      } else { // Default to product purchase
        const orderId = event.data.reference;
        
        if (orderId) {
          const orderRef = doc(db, 'orders', orderId);
          const orderSnap = await getDoc(orderRef);
          if (!orderSnap.exists()) {
              throw new Error(`Order ${orderId} not found.`);
          }
          const orderData = orderSnap.data();
          const productRef = doc(db, 'products', orderData.productId);
          const productSnap = await getDoc(productRef);

          if (!productSnap.exists()) {
              throw new Error(`Product ${orderData.productId} not found for order ${orderId}.`);
          }

          const productData = productSnap.data() as Product;
          const platformFee = orderData.productPrice * PLATFORM_FEE_RATE;
          let resellerCommission = 0;

          if (orderData.resellerId && productData.commissionRate && productData.commissionRate > 0) {
              resellerCommission = orderData.productPrice * (productData.commissionRate / 100);
          }

          await updateDoc(orderRef, {
            orderStatus: 'processing',
            paymentMethod: `paystack_${event.data.channel}`,
            platformFee: platformFee,
            resellerCommission: resellerCommission > 0 ? resellerCommission : null,
          });
          console.log(`Order ${orderId} updated to processing via Paystack webhook. Fees calculated.`);
        }
      }
    }

    return NextResponse.json({ status: 'success' });

  } catch (error: any) {
    console.error('Paystack Webhook Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed', details: error.message }, { status: 500 });
  }
}
