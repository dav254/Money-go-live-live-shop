

'use client';

import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { db } from '@/firebase/server';
import { doc, updateDoc, increment, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { Order, Product } from '@/lib/types';

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
        const amount = event.data.amount / 100; // Convert from kobo to USD

        if (userId && points) {
          const userProfileRef = doc(db, 'userProfiles', userId);
          await updateDoc(userProfileRef, {
            aiPoints: increment(points)
          });

          // Create a payment log for this transaction
          const paymentRef = collection(db, 'payments');
          await addDoc(paymentRef, {
            userId: userId, // Link to the user who bought points
            amount: amount,
            paymentMethod: `paystack_${event.data.channel}`,
            paymentStatus: 'completed',
            paymentDate: serverTimestamp(),
            transactionType: 'points-purchase',
            transactionId: event.data.id,
          });

          console.log(`Credited ${points} points to user ${userId} and logged payment via Paystack.`);
        }

      } else { // Default to product purchase
        const orderId = metadata?.orderId || event.data.reference; // Fallback to reference
        
        if (orderId) {
          const orderRef = doc(db, 'orders', orderId);
          const orderSnap = await getDoc(orderRef);
          if (!orderSnap.exists()) {
              throw new Error(`Order ${orderId} not found.`);
          }
          const orderData = orderSnap.data() as Order;
          
          const subtotal = orderData.subtotal || 0;
          const platformFee = subtotal * PLATFORM_FEE_RATE;

          let resellerCommission = 0;
          // If a reseller is involved, calculate a fixed 10% commission
          if (orderData.resellerId) {
              resellerCommission = subtotal * 0.10;
          }
          
          await updateDoc(orderRef, {
            orderStatus: 'processing',
            paymentMethod: `paystack_${event.data.channel}`,
            platformFee: platformFee,
            resellerCommission: resellerCommission > 0 ? resellerCommission : 0,
          });
          
          const paymentRef = collection(db, 'payments');
          await addDoc(paymentRef, {
              orderId: orderId,
              userId: orderData.buyerId, 
              amount: orderData.totalAmount,
              paymentMethod: `paystack_${event.data.channel}`,
              paymentStatus: 'completed',
              paymentDate: serverTimestamp(),
              transactionType: 'product-purchase',
              transactionId: event.data.id,
          });
          
          console.log(`Order ${orderId} updated to processing and payment logged via Paystack webhook.`);
        }
      }
    }

    return NextResponse.json({ status: 'success' });

  } catch (error: any) {
    console.error('Paystack Webhook Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed', details: error.message }, { status: 500 });
  }
}
