
import { NextResponse } from 'next/server';
import Paystack from 'paystack';
import paypal from '@paypal/checkout-server-sdk';

const paystack = Paystack(process.env.PAYSTACK_SECRET_KEY || '');

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
        const body = await request.json();
        const { orderId, amount, email, gateway } = body;

        if (!orderId || !amount || !email || !gateway) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        let checkoutUrl;

        if (gateway === 'paystack') {
            const response = await paystack.transaction.initialize({
                email: email,
                amount: amount * 100, // Paystack expects amount in the smallest currency unit (cents)
                currency: 'USD',
                reference: orderId,
                metadata: { orderId },
            });
            
            if (!response.status || !response.data.authorization_url) {
                throw new Error('Paystack initialization failed');
            }
            checkoutUrl = response.data.authorization_url;

        } else if (gateway === 'paypal') {
            const paypalClient = getPayPalClient();
            const paypalRequest = new paypal.orders.OrdersCreateRequest();
            paypalRequest.prefer("return=representation");
            paypalRequest.requestBody({
                intent: 'CAPTURE',
                purchase_units: [{
                    reference_id: orderId,
                    amount: {
                        currency_code: 'USD', // Changed to USD
                        value: amount.toString(),
                    },
                }],
                application_context: {
                    return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/success?orderId=${orderId}`,
                    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/${orderId}`,
                },
            });
            
            const response = await paypalClient.execute(paypalRequest);
            const approveLink = response.result.links.find(link => link.rel === 'approve');
            if (!approveLink) {
                 throw new Error('Could not find PayPal approval link');
            }
            checkoutUrl = approveLink.href;

        } else {
            return NextResponse.json({ error: 'Invalid payment gateway' }, { status: 400 });
        }

        return NextResponse.json({ checkoutUrl });

    } catch (error: any) {
        console.error('Payment intent error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
