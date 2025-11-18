
import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { db } from '@/firebase/server';
import { doc, updateDoc } from 'firebase/firestore';

export async function POST(request: Request) {
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY!;
  const signature = request.headers.get('x-paystack-signature');
  
  // Important: You need to read the raw body, not the parsed JSON
  const rawBody = await request.text();

  const hash = createHmac('sha512', paystackSecret).update(rawBody).digest('hex');

  if (hash !== signature) {
    console.warn('Paystack Webhook: Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    const event = JSON.parse(rawBody);

    if (event.event === 'charge.success') {
      const orderId = event.data.reference;
      
      if (orderId) {
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
          orderStatus: 'processing',
          paymentMethod: `paystack_${event.data.channel}`,
        });
        console.log(`Order ${orderId} updated to processing via Paystack webhook.`);
      }
    }

    return NextResponse.json({ status: 'success' });

  } catch (error: any) {
    console.error('Paystack Webhook Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed', details: error.message }, { status: 500 });
  }
}
