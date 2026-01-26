
'use server';

import { db } from '@/firebase/server';
import { writeBatch, collection, query, where, getDocs, doc, addDoc, serverTimestamp } from 'firebase-admin/firestore';

interface NotificationPayload {
    targetAudience: 'all' | 'buyers' | 'sellers' | 'resellers';
    title: string;
    message: string;
    link?: string;
}

export async function sendBulkNotifications(payload: NotificationPayload): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
        const usersRef = collection(db, 'userProfiles');
        let usersQuery;

        if (payload.targetAudience !== 'all') {
            usersQuery = query(usersRef, where('userRole', '==', payload.targetAudience));
        } else {
            usersQuery = query(usersRef);
        }

        const usersSnapshot = await getDocs(usersQuery);

        if (usersSnapshot.empty) {
            return { success: true, count: 0 };
        }

        const batch = writeBatch(db);
        let notificationCount = 0;

        usersSnapshot.forEach(userDoc => {
            const userId = userDoc.id;
            const notificationRef = doc(collection(db, 'notifications')); // Create a new doc with a unique ID
            
            batch.set(notificationRef, {
                userId: userId,
                type: 'announcement', // General type for admin-sent messages
                title: payload.title,
                message: payload.message,
                link: payload.link || '',
                status: 'unread',
                timestamp: new Date(),
            });
            notificationCount++;
        });

        await batch.commit();

        return { success: true, count: notificationCount };

    } catch (error: any) {
        console.error("Error sending bulk notifications:", error);
        return { success: false, error: 'Failed to send notifications. Check server logs.' };
    }
}

interface DirectNotificationPayload {
    userId: string;
    title: string;
    message: string;
    link?: string;
}

export async function sendDirectNotification(payload: DirectNotificationPayload): Promise<{ success: boolean; error?: string }> {
    try {
        const notificationRef = collection(db, 'notifications');
        await addDoc(notificationRef, {
            userId: payload.userId,
            type: 'announcement',
            title: payload.title,
            message: payload.message,
            link: payload.link || '',
            status: 'unread',
            timestamp: serverTimestamp(),
        });

        return { success: true };

    } catch (error: any) {
        console.error("Error sending direct notification:", error);
        return { success: false, error: 'Failed to send notification. Please check server logs.' };
    }
}

    