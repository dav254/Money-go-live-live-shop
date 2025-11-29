
'use server';

import { collection, addDoc } from 'firebase/firestore';
import { initializeAdminApp } from '@/firebase/admin';
import { getFirestore, serverTimestamp } from 'firebase-admin/firestore';

interface InvoiceNotificationPayload {
    sellerId: string;
    orderId: string;
    productName: string;
}

export async function sendInvoiceNotification(payload: InvoiceNotificationPayload): Promise<{ success: boolean; error?: string }> {
    try {
        const adminApp = initializeAdminApp();
        const db = getFirestore(adminApp);

        const notificationsRef = collection(db, 'notifications');
        
        await addDoc(notificationsRef, {
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
