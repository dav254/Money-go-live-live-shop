
import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { Order } from '@/lib/types';

export async function POST(request: Request) {
    try {
        const event = await request.json();

        if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
            const resource = event.resource;
            const purchaseUnit = resource.purchase_units[0];
            const customId = purchaseUnit.custom_id;
            let metadata;
            
            try {
                metadata = JSON.parse(customId);
            } catch (e) {
                metadata = { transactionType: 'product-purchase', orderId: customId };
            }

            const transactionType = metadata?.transactionType;
            
            if (transactionType === 'points-purchase') {
                const userId = metadata.userId;
                const points = metadata.points;
                const amount = parseFloat(purchaseUnit.amount.value);

                if (userId && points) {
                    const userRef = db.collection('userProfiles').doc(userId);
                    await userRef.update({
                        aiPoints: FieldValue.increment(points)
                    });
                    await db.collection('payments').add({
                        userId: userId,
                        amount: amount,
                        paymentMethod: 'paypal',
                        paymentStatus: 'completed',
                        paymentDate: FieldValue.serverTimestamp(),
                        transactionType: 'points-purchase',
                        transactionId: resource.id,
                    });
                }
            } else {
                const orderId = metadata.orderId;
                if (orderId) {
                    const orderRef = db.collection('orders').doc(orderId);
                    const orderSnap = await orderRef.get();
                    if (orderSnap.exists) {
                        const orderData = orderSnap.data() as Order;
                        await orderRef.update({
                            orderStatus: 'processing',
                            paymentMethod: 'paypal',
                            updatedAt: FieldValue.serverTimestamp(),
                        });
                        await db.collection('payments').add({
                            orderId: orderId,
                            userId: orderData.buyerId,
                            amount: orderData.totalAmount,
                            paymentMethod: 'paypal',
                            paymentStatus: 'completed',
                            paymentDate: FieldValue.serverTimestamp(),
                            transactionType: 'product-purchase',
                            transactionId: resource.id,
                        });
                    }
                }
            }
        }
        return NextResponse.json({ status: 'success' });
    } catch (error: any) {
        console.error('PayPal Webhook Error:', error);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}
