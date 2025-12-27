

'use server';

import { NextResponse } from 'next/server';
import paypal from '@paypal/checkout-server-sdk';
import { db } from '@/firebase/server';
import { doc, updateDoc, increment, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { Order, Product } from '@/lib/types';

const PLATFORM_FEE_RATE = 0.10; // 10%

function getPayPalClient() {
    const clientId = process.env.PAYPAL_CLIENT_ID!;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET!;
    const environment = process.env.PAYPAL_ENVIRONMENT === 'live'
        ? new paypal.core.LiveEnvironment(clientId, clientSecret)
        : new paypal.core.SandboxEnvironment(clientId, clientSecret);
    return new paypal.core.PayPalHttpClient(environment);
}

export async function POST(request: Request) {
    try {
        const event = await request.json();

        if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
            const resource = event.resource;
            const purchaseUnit = resource.purchase_units[0];
            const customId = purchaseUnit.custom_id;
            let metadata;
            
            try {
                metadata = JSON.parse(customId);
            } catch (e) {
                const orderId = customId;
                metadata = { transactionType: 'product-purchase', orderId };
            }

            const transactionType = metadata?.transactionType;
            
            if (transactionType === 'points-purchase') {
                const userId = metadata.userId;
                const points = metadata.points;
                const amount = parseFloat(purchaseUnit.amount.value);

                if (userId && points) {
                    const userProfileRef = doc(db, 'userProfiles', userId);
                    await updateDoc(userProfileRef, {
                        aiPoints: increment(points)
                    });
                    
                    const paymentRef = collection(db, 'payments');
                    await addDoc(paymentRef, {
                        userId: userId,
                        amount: amount,
                        paymentMethod: 'paypal',
                        paymentStatus: 'completed',
                        paymentDate: serverTimestamp(),
                        transactionType: 'points-purchase',
                        transactionId: resource.id,
                    });
                    console.log(`Credited ${points} points to user ${userId} and logged payment via PayPal.`);
                }

            } else { // Default to product purchase
                const orderId = metadata.orderId;
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
                        paymentMethod: 'paypal',
                        platformFee: platformFee,
                        resellerCommission: resellerCommission > 0 ? resellerCommission : 0,
                    });
                     
                    const paymentRef = collection(db, 'payments');
                    await addDoc(paymentRef, {
                        orderId: orderId,
                        userId: orderData.buyerId,
                        amount: orderData.totalAmount,
                        paymentMethod: 'paypal',
                        paymentStatus: 'completed',
                        paymentDate: serverTimestamp(),
                        transactionType: 'product-purchase',
                        transactionId: resource.id,
                    });
                    console.log(`Order ${orderId} updated to processing and payment logged via PayPal webhook.`);
                }
            }
        }
        
        return NextResponse.json({ status: 'success' });

    } catch (error: any) {
        console.error('PayPal Webhook Error:', error);
        return NextResponse.json({ error: 'Webhook processing failed', details: error.message }, { status: 500 });
    }
}
