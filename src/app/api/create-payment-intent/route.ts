import { NextResponse } from 'next/server';
import paypal from '@paypal/checkout-server-sdk';
import { randomBytes } from 'crypto';
import { publicUrl } from '@/lib/site-url';

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
        const { amount, email, gateway, metadata, transactionType, orderId, channel } = body;

        if (!amount || !email || !gateway) {
            return NextResponse.json({ error: 'Missing required payment details.' }, { status: 400 });
        }

        const reference = `${orderId || 'PTS'}-${randomBytes(8).toString('hex')}`;
        let checkoutUrl;
        let fallbackNotice: string | undefined;

        if (gateway === 'paystack') {
            const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
            if (!paystackSecret) {
                return NextResponse.json({ error: 'Paystack is not configured on the server.' }, { status: 500 });
            }

            // Paystack requires KES for M-Pesa support.
            // We convert the USD amount to KES (using 130 as a standard rate)
            const kesAmount = Math.round(amount * 130 * 100); // Amount in cents (shillings)

            /*
             * Channels.
             *
             * When the client names one (the app checkout lets a buyer pick
             * M-PESA / card / bank explicitly) we forward that ONE so Paystack
             * opens already on the method they chose, instead of making them
             * pick again from a list.
             *
             * Without a choice we send all four. Note this only ever NARROWS
             * what Paystack may offer: Paystack intersects the list with the
             * channels actually enabled on the merchant account. So a card
             * missing at the real Paystack page is a dashboard setting, not
             * something this array can fix — send all of them and let the
             * account decide.
             */
            const ALL_CHANNELS = ['card', 'mobile_money', 'bank', 'ussd'];
            const requested = typeof channel === 'string' ? channel.trim() : '';
            const channels = ALL_CHANNELS.includes(requested) ? [requested] : ALL_CHANNELS;

            const initialize = async (channelList: string[]) => {
                const response = await fetch('https://api.paystack.co/transaction/initialize', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${paystackSecret}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: email,
                        amount: kesAmount,
                        currency: 'KES',
                        channels: channelList,
                        reference: reference,
                        metadata: {
                            ...metadata,
                            orderId: orderId,
                            transactionType: transactionType || 'product-purchase',
                            requestedChannel: requested || 'any'
                        }
                    })
                });
                return response.json();
            };

            let data = await initialize(channels);

            /*
             * A channel can be a valid Paystack name and still be switched off
             * on the merchant account. Paystack answers that with "No active
             * channel to process transaction" instead of an authorization URL.
             *
             * Without this the buyer who picked "Credit or debit card" on an
             * account without Cards enabled gets a raw 400 and no way to pay.
             * So we retry once with every channel and let Paystack offer
             * whatever IS active, telling the client we had to widen the
             * choice so the screen can say so rather than silently swapping
             * the method under them.
             */
            const narrowed = channels.length < ALL_CHANNELS.length;
            if (narrowed && !data.data?.authorization_url) {
                const widened = await initialize(ALL_CHANNELS);
                if (widened.data?.authorization_url) {
                    data = widened;
                    // Name only the method they actually asked for. We have
                    // proven that one is off; we have not probed the others, so
                    // claiming more than that would be a guess.
                    const CHANNEL_LABELS: Record<string, string> = {
                        card: 'Card payment',
                        bank: 'Bank transfer',
                        ussd: 'USSD payment',
                        mobile_money: 'Mobile money',
                    };
                    const label = CHANNEL_LABELS[requested] || 'That payment method';
                    fallbackNotice = `${label} is not enabled on our Paystack account yet, so Paystack will show the other methods available.`;
                }
            }

            if (!data.status || !data.data?.authorization_url) {
                return NextResponse.json({ error: data.message || 'Paystack initialization failed' }, { status: 400 });
            }
            checkoutUrl = data.data.authorization_url;

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
                    // `publicUrl` rather than a bare `process.env` read: with
                    // NEXT_PUBLIC_BASE_URL unset this used to send PayPal the
                    // literal string "undefined/checkout/…", and PayPal
                    // validates return URLs — so the buyer was returned to a
                    // dead link after paying.
                    return_url: publicUrl(`/checkout/${orderId || 'points'}?status=success`),
                    cancel_url: publicUrl(`/checkout/${orderId || 'points'}?status=cancelled`),
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

        return NextResponse.json({ checkoutUrl, fallbackNotice });

    } catch (error: any) {
        console.error('Payment intent error:', error);
        return NextResponse.json({ 
            error: 'Server Error during payment setup', 
            details: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
    }
}
