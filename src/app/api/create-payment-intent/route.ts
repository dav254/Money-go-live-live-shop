// The PayPal checkout SDK ships no TypeScript declarations in this project, so the
// module is imported as `any` on purpose. We only touch it through one well-known
// path (`paypal.orders.OrdersCreateRequest` / `PayPalHttpClient`), and we keep that
// loose rather than re-declaring the whole SDK here.
import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { publicUrl } from '@/lib/site-url';

const paypal = require('@paypal/checkout-server-sdk');

function getPayPalClient() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  const environment =
    process.env.PAYPAL_ENVIRONMENT === 'live'
      ? new paypal.core.LiveEnvironment(clientId, clientSecret)
      : new paypal.core.SandboxEnvironment(clientId, clientSecret);

  return new paypal.core.PayPalHttpClient(environment);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, email, gateway, metadata, transactionType, orderId, channel } = body;

    if (!amount || !email || !gateway) {
      return NextResponse.json({ error: 'Missing required payment details.' }, { status: 400 });
    }

    const reference =
      `${orderId || 'PTS'}-${(() => {
        const b = randomBytes(8);
        return [...b].map((n) => n.toString(16).padStart(2, '0')).join('');
      })()}`;
    let checkoutUrl: string | undefined;
    let fallbackNotice: string | undefined;

    if (gateway === 'paystack') {
      const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecret) {
        return NextResponse.json({ error: 'Paystack is not configured on the server.' }, { status: 500 });
      }

      // Paystack requires KES for M-Pesa support.
      // We convert the USD amount to KES (using 130 as a standard rate)
      const kesAmount = Math.round(amount * 130 * 100); // Amount in cents (shillings)

      const ALL_CHANNELS = ['card', 'mobile_money', 'bank', 'ussd'];
      const requested = typeof channel === 'string' ? channel.trim() : '';
      const channels = ALL_CHANNELS.includes(requested) ? [requested] : ALL_CHANNELS;

      const initialize = async (channelList: string[]) => {
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            amount: kesAmount,
            currency: 'KES',
            channels: channelList,
            reference,
            metadata: {
              ...metadata,
              orderId,
              transactionType: transactionType || 'product-purchase',
              requestedChannel: requested || 'any',
            },
          }),
        });
        return response.json();
      };

      let data = await initialize(channels);

      const narrowed = channels.length < ALL_CHANNELS.length;
      if (narrowed && !data.data?.authorization_url) {
        const widened = await initialize(ALL_CHANNELS);
        if (widened.data?.authorization_url) {
          data = widened;
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
        return NextResponse.json({ error: 'PayPal is not configured on this server.' }, { status: 500 });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const paypalRequest = new (paypal as any).orders.OrdersCreateRequest();
      paypalRequest.prefer('return=representation');
      paypalRequest.requestBody({
        intent: 'CAPTURE',
        purchase_units: [
          {
            invoice_id: reference,
            amount: {
              currency_code: 'USD',
              value: amount.toFixed(2),
            },
            custom_id: JSON.stringify({
              ...metadata,
              orderId,
              transactionType: transactionType || 'product-purchase',
            }),
          },
        ],
        application_context: {
          return_url: publicUrl(`/checkout/${orderId ?? 'points'}?status=success`),
          cancel_url: publicUrl(`/checkout/${orderId ?? 'points'}?status=cancelled`),
        },
      });

      try {
        const response = await paypalClient.execute(paypalRequest);
        const approveLink = response.result.links.find((link: any) => link.rel === 'approve');
        if (!approveLink) throw new Error('Could not find PayPal approval link');
        checkoutUrl = approveLink.href;
      } catch (ppError: any) {
        return NextResponse.json(
          { error: 'PayPal execution failed.', details: ppError.message },
          { status: 500 },
        );
      }
    } else {
      return NextResponse.json({ error: 'Invalid payment gateway' }, { status: 400 });
    }

    return NextResponse.json({ checkoutUrl, fallbackNotice });
  } catch (error: any) {
    console.error('Payment intent error:', error);
    return NextResponse.json(
      {
        error: 'Server Error during payment setup',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
