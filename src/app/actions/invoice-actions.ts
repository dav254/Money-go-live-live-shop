
'use server';

import { pushExistingNotification } from '@/lib/notifications/push-server';
import { createNotification } from '@/lib/notifications/store';

interface InvoiceNotificationPayload {
    sellerId: string;
    orderId: string;
    productName: string;
}

export async function sendInvoiceNotification(payload: InvoiceNotificationPayload): Promise<{ success: boolean; error?: string }> {
    try {
        const title = 'New Invoice Generated';
        const message = `An invoice has been generated for your sale of "${payload.productName}".`;

        await createNotification({
            userId: payload.sellerId,
            type: 'invoice',
            title,
            message,
            link: `/invoice/${payload.orderId}`,
            category: 'payments',
        });

        // Push runs alongside the write. A seller waiting on money should not
        // have to open the app to learn an invoice exists.
        void pushExistingNotification(payload.sellerId, {
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
