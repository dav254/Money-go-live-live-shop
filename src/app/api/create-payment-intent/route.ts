
import { NextResponse } from 'next/server';
import paypal from '@paypal/checkout-server-sdk';
import { randomBytes } from 'crypto';
import axios from 'axios';

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
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

    try {
        const body = await request.json();
        const { amount, email, gateway, metadata, transactionType, orderId } = body;

        if (!paystackSecret && gateway === 'paystack') {
            return NextResponse.json({ error: 'Paystack is not configured on the server.' }, { status: 500 });
        }

        const reference = `${orderId || 'PTS'}-${randomBytes(8).toString('hex')}`;
        let checkoutUrl;

        if (gateway === 'paystack') {
            const response = await axios.post('https://api.paystack.co/transaction/initialize', {
                email: email,
                amount: Math.round(amount * 100), 
                currency: 'USD',
                reference: reference,
                metadata: {
                    ...metadata,
                    orderId: orderId,
                    transactionType: transactionType || 'product-purchase'
                }
            }, {
                headers: {
                    Authorization: `Bearer ${paystackSecret}`
                }
            });
            
            if (!response.data.status || !response.data.data.authorization_url) {
                throw new Error(response.data.message || 'Paystack initialization failed');
            }
            checkoutUrl = response.data.data.authorization_url;

        } else if (gateway === 'paypal') {
            const paypalClient = getPayPalClient();
            if (!paypalClient) throw new Error("PayPal is not configured on this server.");

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
            
            const response = await paypalClient.execute(paypalRequest);
            const approveLink = response.result.links.find((link: any) => link.rel === 'approve');
            if (!approveLink) throw new Error('Could not find PayPal approval link');
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
