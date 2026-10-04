
'use server';

import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { pushExistingNotification } from '@/lib/notifications/push-server';

interface InvoiceNotificationPayload {
    sellerId: string;
    orderId: string;
    productName: string;
}

export async function sendInvoiceNotification(payload: InvoiceNotificationPayload): Promise<{ success: boolean; error?: string }> {
    try {
        const title = 'New Invoice Generated';
        const message = `An invoice has been generated for your sale of "${payload.productName}".`;

        await db.collection('notifications').add({
            userId: payload.sellerId,
            type: 'invoice',
            title,
            message,
            link: `/invoice/${payload.orderId}`,
            status: 'unread',
            timestamp: FieldValue.serverTimestamp(),
        });

        // Pre-engine writer: it owns its own field names, so push is dispatched
        // alongside the document rather than through `notify()`. A seller waiting
        // on money should not have to open the app to learn an invoice exists.
        void pushExistingNotification(db, payload.sellerId, {
            title,
            body: message,
            link: `/invoice/${payload.orderId}`,
            category: 'payments',
        });

        return { success: true };

    } catch (error: any) {
        console.error("Error sending invoice notification:", error);
        return { success: false, error: 'Failed to send notification. Check server logs.' };
    }
}
