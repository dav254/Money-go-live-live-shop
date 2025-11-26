
import { NextResponse } from 'next/server';
import paypal from '@paypal/checkout-server-sdk';
import { db } from '@/firebase/server';
import { doc, updateDoc, increment } from 'firebase/firestore';

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
                // Fallback to old method if JSON parsing fails
                const orderId = purchaseUnit.reference_id;
                if (orderId) {
                   const orderRef = doc(db, 'orders', orderId);
                   await updateDoc(orderRef, { orderStatus: 'processing', paymentMethod: 'paypal' });
                   console.log(`Order ${orderId} updated to processing via PayPal webhook (fallback).`);
                }
                return NextResponse.json({ status: 'success' });
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
                    await updateDoc(orderRef, {
                        orderStatus: 'processing',
                        paymentMethod: 'paypal'
                    });
                    console.log(`Order ${orderId} updated to processing via PayPal webhook.`);
                }
            }
        }
        
        return NextResponse.json({ status: 'success' });

    } catch (error: any) {
        console.error('PayPal Webhook Error:', error);
        return NextResponse.json({ error: 'Webhook processing failed', details: error.message }, { status: 500 });
    }
}
