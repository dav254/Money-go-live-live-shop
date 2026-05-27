
import { NextResponse } from 'next/server';
import paypal from '@paypal/checkout-server-sdk';
import { randomBytes } from 'crypto';
import { submitPesapalOrder } from '@/lib/pesapal';

function getPayPalClient() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) return null;

    const environment = process.env.PAYPAL_ENVIRONMENT === 'live'
        ? new paypal.core.LiveEnvironment(clientId, clientSecret)
        : new paypal.core.SandboxEnvironment(clientId, clientSecret);
    return new paypal.core.PayPalHttpClient(environment);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { amount, email, gateway, metadata, transactionType, orderId } = body;

        if (!amount || !email || !gateway) {
            return NextResponse.json({ error: 'Missing required payment details.' }, { status: 400 });
        }

        const reference = `${orderId || 'PTS'}-${randomBytes(8).toString('hex')}`;
        let checkoutUrl;

        if (gateway === 'paystack') {
            const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
            if (!paystackSecret) {
                return NextResponse.json({ error: 'Paystack is not configured on the server.' }, { status: 500 });
            }

            const response = await fetch('https://api.paystack.co/transaction/initialize', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${paystackSecret}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    amount: Math.round(amount * 100), 
                    currency: 'USD',
                    reference: reference,
                    metadata: {
                        ...metadata,
                        orderId: orderId,
                        transactionType: transactionType || 'product-purchase'
                    }
                })
            });

            const data = await response.json();
            
            if (!data.status || !data.data?.authorization_url) {
                return NextResponse.json({ error: data.message || 'Paystack initialization failed' }, { status: 400 });
            }
            checkoutUrl = data.data.authorization_url;

        } else if (gateway === 'pesapal') {
            try {
                const res = await submitPesapalOrder({
                    orderId: orderId || reference,
                    amount: amount,
                    email: email,
                    firstName: email.split('@')[0] || 'Guest',
                    lastName: 'User',
                    description: transactionType === 'points-purchase' ? 'AI Points Top-up' : `Order for ${email}`,
                });
                checkoutUrl = res.redirectUrl;
            } catch (pesapalError: any) {
                console.error("PesaPal API Error:", pesapalError);
                return NextResponse.json({ error: 'PesaPal Initialization Failed', details: pesapalError.message }, { status: 500 });
            }

        } else if (gateway === 'paypal') {
            const paypalClient = getPayPalClient();
            if (!paypalClient) {
                return NextResponse.json({ error: "PayPal is not configured on this server." }, { status: 500 });
            }

            const paypalRequest = new paypal.orders.OrdersCreateRequest();
            paypalRequest.prefer("return=representation");
            paypalRequest.requestBody({
                intent: 'CAPTURE',
                purchase_units: [{
                    invoice_id: reference,
                    amount: {
                        currency_code: 'USD',
                        value: amount.toFixed(2),
                    },
                    custom_id: JSON.stringify({
                        ...metadata,
                        orderId: orderId,
                        transactionType: transactionType || 'product-purchase'
                    }),
                }],
                application_context: {
                    return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/${orderId || 'points'}?status=success`,
                    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/${orderId || 'points'}?status=cancelled`,
                },
            });
            
            try {
                const response = await paypalClient.execute(paypalRequest);
                const approveLink = response.result.links.find((link: any) => link.rel === 'approve');
                if (!approveLink) throw new Error('Could not find PayPal approval link');
                checkoutUrl = approveLink.href;
            } catch (ppError: any) {
                return NextResponse.json({ error: 'PayPal execution failed.', details: ppError.message }, { status: 500 });
            }

        } else {
            return NextResponse.json({ error: 'Invalid payment gateway' }, { status: 400 });
        }

        return NextResponse.json({ checkoutUrl });

    } catch (error: any) {
        console.error('Payment intent error:', error);
        return NextResponse.json({ 
            error: 'Server Error during payment setup', 
            details: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
    }
}
