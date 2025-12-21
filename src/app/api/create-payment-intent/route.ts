
import { NextResponse } from 'next/server';
import paypal from '@paypal/checkout-server-sdk';
import { randomBytes } from 'crypto';

// The paystack import has been moved inside the POST function.

function getPayPalClient() {
    const clientId = process.env.PAYPAL_CLIENT_ID!;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET!;
    const environment = process.env.PAYPAL_ENVIRONMENT === 'live'
        ? new paypal.core.LiveEnvironment(clientId, clientSecret)
        : new paypal.core.SandboxEnvironment(clientId, clientSecret);
    return new paypal.core.PayPalHttpClient(environment);
}

export async function POST(request: Request) {
    // Dynamically import paystack here to ensure it's only loaded on the server
    const Paystack = (await import('paystack')).default;
    const paystack = Paystack(process.env.PAYSTACK_SECRET_KEY || '');

    try {
        const { orderId, amount, email, gateway } = await request.json();

        if (!orderId || !amount || !email || !gateway) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        
        const reference = `${orderId}-${randomBytes(8).toString('hex')}`;
        let checkoutUrl;

        if (gateway === 'paystack') {
            const response = await paystack.transaction.initialize({
                email: email,
                amount: amount * 100, // Paystack expects amount in kobo/cents
                currency: 'USD',
                reference: reference,
                metadata: {
                    orderId: orderId,
                }
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
                    invoice_id: reference,
                    amount: {
                        currency_code: 'USD',
                        value: amount.toString(),
                    },
                    custom_id: orderId,
                }],
                application_context: {
                    return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/${orderId}?status=success`,
                    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/${orderId}?status=cancelled`,
                },
            });
            
            const response = await paypalClient.execute(paypalRequest);
            const approveLink = response.result.links.find((link: { rel: string; }) => link.rel === 'approve');
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
