
'use server';

import { initializeAdminApp } from '@/firebase/admin';
// Do not import from 'firebase-admin' at the top level
import type { Order } from '@/lib/types';

interface InvoiceNotificationPayload {
    sellerId: string;
    orderId: string;
    productName: string;
}

export async function sendInvoiceNotification(payload: InvoiceNotificationPayload): Promise<{ success: boolean; error?: string }> {
    try {
        initializeAdminApp();
        const { getFirestore, serverTimestamp } = await import('firebase-admin/firestore');
        const db = getFirestore();

        await db.collection('notifications').add({
            userId: payload.sellerId,
            type: 'invoice',
            title: 'New Invoice Generated',
            message: `An invoice has been generated for your sale of "${payload.productName}".`,
            link: `/invoice/${payload.orderId}`,
            status: 'unread',
            timestamp: serverTimestamp(),
        });

        return { success: true };

    } catch (error: any) {
        console.error("Error sending invoice notification:", error);
        return { success: false, error: 'Failed to send notification. Check server logs.' };
    }
}
