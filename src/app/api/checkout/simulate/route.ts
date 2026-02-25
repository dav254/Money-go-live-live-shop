import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { Order } from '@/lib/types';

export async function POST(request: Request) {
    try {
        const { orderId } = await request.json();

        if (!orderId) {
            return NextResponse.json({ message: 'Order ID is required' }, { status: 400 });
        }

        const orderRef = db.collection('orders').doc(orderId);
        const orderSnap = await orderRef.get();

        if (!orderSnap.exists) {
            return NextResponse.json({ message: 'Order not found' }, { status: 404 });
        }

        const orderData = orderSnap.data() as Order;

        if (orderData.orderStatus !== 'pending') {
            return NextResponse.json({ message: 'Order has already been processed' }, { status: 400 });
        }
        
        const batch = db.batch();

        batch.update(orderRef, {
            orderStatus: 'processing',
            paymentMethod: 'simulated_demo',
        });
        
        const paymentRef = db.collection('payments').doc();
        batch.set(paymentRef, {
            orderId: orderId,
            userId: orderData.buyerId,
            amount: orderData.totalAmount,
            paymentMethod: 'simulated_demo',
            paymentStatus: 'completed',
            paymentDate: FieldValue.serverTimestamp(),
            transactionType: 'product-purchase',
            transactionId: `SIM_${Date.now()}`,
        });
        
        await batch.commit();
        
        return NextResponse.json({ success: true, message: 'Payment simulated successfully.' });

    } catch (error: any) {
        console.error('Payment Simulation Error:', error);
        return NextResponse.json({ message: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
