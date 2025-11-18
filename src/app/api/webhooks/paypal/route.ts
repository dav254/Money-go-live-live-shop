
import { NextResponse } from 'next/server';
import paypal from '@paypal/checkout-server-sdk';
import { db } from '@/firebase/server';
import { doc, updateDoc } from 'firebase/firestore';

function getPayPalClient() {
    const clientId = process.env.PAYPAL_CLIENT_ID!;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET!;
    const environment = process.env.PAYPAL_ENVIRONMENT === 'live'
        ? new paypal.core.LiveEnvironment(clientId, clientSecret)
        : new paypal.core.SandboxEnvironment(clientId, clientSecret);
    return new paypal.core.PayPalHttpClient(environment);
}

export async function POST(request: Request) {
    // PayPal webhooks require more complex verification involving sending the webhook ID back to PayPal
    // For this example, we'll focus on the logic post-verification.
    // In a production app, you MUST verify the webhook signature.
    // https://developer.paypal.com/docs/api/webhooks/v1/#webhooks_verify-signature

    try {
        const event = await request.json();

        if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
            const orderId = event.resource.purchase_units[0].reference_id;

             if (orderId) {
                const orderRef = doc(db, 'orders', orderId);
                await updateDoc(orderRef, {
                    orderStatus: 'processing',
                    paymentMethod: 'paypal'
                });
                console.log(`Order ${orderId} updated to processing via PayPal webhook.`);
            }
        }
        
        return NextResponse.json({ status: 'success' });

    } catch (error: any) {
        console.error('PayPal Webhook Error:', error);
        return NextResponse.json({ error: 'Webhook processing failed', details: error.message }, { status: 500 });
    }
}
