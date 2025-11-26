
import { NextResponse } from 'next/server';
import paypal from '@paypal/checkout-server-sdk';
import { db } from '@/firebase/server';
import { doc, updateDoc, increment, getDoc, collection } from 'firebase/firestore';
import type { Product } from '@/lib/types';

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
            const purchaseUnit = event.resource.purchase_units[0];
            const customId = purchaseUnit.custom_id;
            let metadata;
            
            try {
                metadata = JSON.parse(customId);
            } catch (e) {
                console.error("Could not parse PayPal custom_id JSON:", customId);
                // Fallback for older transactions without JSON metadata
                return NextResponse.json({ status: 'success', message: 'Fallback handling, no metadata.' });
            }

            const transactionType = metadata?.transactionType;
            
            if (transactionType === 'points-purchase') {
                const userId = metadata.userId;
                const points = metadata.points;

                if (userId && points) {
                    const userProfileRef = doc(db, 'userProfiles', userId);
                    await updateDoc(userProfileRef, {
                        aiPoints: increment(points)
                    });
                    console.log(`Credited ${points} points to user ${userId} via PayPal.`);
                }

            } else { // Default to product purchase
                const orderId = metadata.orderId || purchaseUnit.reference_id;
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
                        paymentMethod: 'paypal',
                        platformFee: platformFee,
                        resellerCommission: resellerCommission > 0 ? resellerCommission : null,
                    });
                    console.log(`Order ${orderId} updated to processing via PayPal webhook. Fees calculated.`);
                }
            }
        }
        
        return NextResponse.json({ status: 'success' });

    } catch (error: any) {
        console.error('PayPal Webhook Error:', error);
        return NextResponse.json({ error: 'Webhook processing failed', details: error.message }, { status: 500 });
    }
}
