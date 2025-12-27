
'use server';

import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import type { Order, Product } from '@/lib/types';

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

    const orderRef = db.doc(`orders/${orderId}`);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    const orderData = orderSnap.data() as Order;

    // --- Perform the same logic as the payment webhooks ---
    
    // Determine the primary product ID from the order
    const firstItemProductId = orderData.items?.[0]?.productId;
    const legacyProductId = orderData.productId;
    const primaryProductId = firstItemProductId || legacyProductId;

    if (!primaryProductId) {
         throw new Error(`Product ID is missing from order ${orderId}.`);
    }
    
    // 1. Fetch the product to get the commission rate
    const productRef = db.doc(`products/${primaryProductId}`);
    const productSnap = await productRef.get();
    if (!productSnap.exists) {
        throw new Error(`Product not found for order ${orderId}.`);
    }
    const productData = productSnap.data() as Product;

    // 2. Calculate fees and commissions
    const subtotal = orderData.subtotal ?? orderData.productPrice ?? 0;
    const platformFee = subtotal * PLATFORM_FEE_RATE;
    let resellerCommission = 0;
    if (orderData.resellerId && productData.commissionRate && productData.commissionRate > 0) {
        resellerCommission = (orderData.productPrice || 0) * (productData.commissionRate / 100);
    }
    
    // 3. Update the order to 'processing'
    await orderRef.update({
      orderStatus: 'processing',
      paymentMethod: 'demo_simulation',
      platformFee: platformFee,
      resellerCommission: resellerCommission > 0 ? resellerCommission : null,
    });

    // 4. Create a payment log entry
    const paymentRef = db.collection('payments');
    await paymentRef.add({
        orderId: orderId,
        userId: orderData.buyerId,
        amount: orderData.totalAmount,
        paymentMethod: 'demo_simulation',
        paymentStatus: 'completed',
        paymentDate: new Date(),
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
