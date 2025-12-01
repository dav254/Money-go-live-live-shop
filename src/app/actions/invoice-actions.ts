
'use server';

import { initializeAdminApp } from '@/firebase/admin';
import { getFirestore, serverTimestamp } from 'firebase-admin/firestore';
import { collection, addDoc } from 'firebase/firestore'; // Use client SDK for types, but admin for execution

interface InvoiceNotificationPayload {
    sellerId: string;
    orderId: string;
    productName: string;
}

export async function sendInvoiceNotification(payload: InvoiceNotificationPayload): Promise<{ success: boolean; error?: string }> {
    try {
        const adminApp = initializeAdminApp(); // Ensure app is initialized
        const db = getFirestore(adminApp);

        // This should use the admin SDK `addDoc`, which is different from the client's.
        // We'll point to the collection path directly.
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
