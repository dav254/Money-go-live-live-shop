
import { NextResponse } from 'next/server';
import Paystack from 'paystack';
import paypal from '@paypal/checkout-server-sdk';
import { randomBytes } from 'crypto';

const paystack = Paystack(process.env.PAYSTACK_SECRET_KEY || '');

function getPayPalClient() {
    const clientId = process.env.PAYPAL_CLIENT_ID!;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET!;
    const environment = process.env.PAYPAL_ENVIRONMENT === 'live'
        ? new paypal.core.LiveEnvironment(clientId, clientSecret)
        : new paypal.core.SandboxEnvironment(clientId, clientSecret);
    return new paypal.core.PayPalHttpClient(environment);
}

// Health check function for this API endpoint
export async function healthCheck() {
    // In a real scenario, you might check connectivity to PayPal/Paystack here.
    // For now, we confirm the environment variables are present.
    const paystackReady = !!process.env.PAYSTACK_SECRET_KEY;
    const paypalReady = !!process.env.PAYPAL_CLIENT_ID && !!process.env.PAYPAL_CLIENT_SECRET;
    
    if (paystackReady && paypalReady) {
        return { status: 'operational' };
    } else {
        return { status: 'degraded', message: 'Payment gateway configuration is missing.' };
    }
}


export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        // Handle health check requests
        if (body.action === 'health_check') {
            const health = await healthCheck();
            return NextResponse.json(health);
        }

        const { orderId, amount, email, gateway, transactionType = 'product-purchase', metadata } = body;

        if (!amount || !email || !gateway) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        
        const reference = orderId || `${transactionType}-${randomBytes(8).toString('hex')}`;

        let checkoutUrl;
        
        const finalMetadata = {
            ...metadata,
            transactionType: transactionType,
            orderId: orderId,
        };

        if (gateway === 'paystack') {
            const response = await paystack.transaction.initialize({
                email: email,
                amount: amount * 100,
                currency: 'USD',
                reference: reference,
                metadata: finalMetadata,
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
                     custom_id: JSON.stringify(finalMetadata),
                }],
                application_context: {
                    return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/success?ref=${reference}`,
                    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/${orderId || ''}`,
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
