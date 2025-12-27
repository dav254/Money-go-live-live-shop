

'use server';

import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import type { Order, Product } from '@/lib/types';
import { collection, doc, getDoc, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

const PLATFORM_FEE_RATE = 0.10; // 10%

/**
 * API route to simulate a successful payment for a given order.
 * This is for testing/demo purposes only and should be secured or removed in production.
 */
export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    const orderData = orderSnap.data() as Order;

    // --- Perform the same logic as the payment webhooks ---
    
    // 1. Calculate fees and commissions
    const subtotal = orderData.subtotal ?? orderData.productPrice ?? 0;
    const platformFee = subtotal * PLATFORM_FEE_RATE;
    
    let resellerCommission = 0;
    // If a reseller is involved, calculate 10% commission.
    if (orderData.resellerId) {
        resellerCommission = subtotal * 0.10;
    }
    
    // 2. Update the order to 'processing'
    await updateDoc(orderRef, {
      orderStatus: 'processing',
      paymentMethod: 'demo_simulation',
      platformFee: platformFee,
      resellerCommission: resellerCommission,
    });

    // 3. Create a payment log entry
    const paymentRef = collection(db, 'payments');
    await addDoc(paymentRef, {
        orderId: orderId,
        userId: orderData.buyerId,
        amount: orderData.totalAmount,
        paymentMethod: 'demo_simulation',
        paymentStatus: 'completed',
        paymentDate: serverTimestamp(),
        transactionType: 'product-purchase',
        transactionId: `SIM_${Date.now()}`,
    });

    console.log(`Order ${orderId} successfully simulated as 'processing' and payment logged.`);
    
    // The onUpdate Cloud Function on the 'orders' collection will now trigger automatically.

    return NextResponse.json({ success: true, message: 'Order status updated to processing.' });

  } catch (error: any) {
    console.error('Simulation Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
