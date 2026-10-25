'use server';

import { db } from '@/firebase/server';
import { pushExistingNotification } from '@/lib/notifications/push-server';
import { createNotification } from '@/lib/notifications/store';

/**
 * ADMIN NOTIFICATION ACTIONS.
 *
 * ## The bug this fixes
 *
 * This file took `db` from `@/firebase/server` — the **Admin** SDK instance —
 * and then called the **client** SDK helpers on it: `collection(db, ...)`,
 * `query(...)`, `where(...)`, `getDocs(...)`, `writeBatch(db)`, `addDoc(...)`.
 *
 * Those are not Admin SDK functions; the Admin SDK exposes the same operations
 * as methods on the instance (`db.collection(...)`, `db.where(...)`). Every
 * one of those imports was a type error, and `getDocs` in particular resolves
 * to nothing at runtime — so `sendBulkNotifications` and
 * `sendDirectNotification` could not have worked. The compiler had been
 * reporting this since before the notification engine existed; it was simply
 * never in a typecheck that covered the file.
 *
 * Both functions below are the Admin SDK equivalents, producing the same
 * documents in the same shapes — so no reader of `notifications` sees any
 * difference.
 */

interface NotificationPayload {
    targetAudience: 'all' | 'buyers' | 'sellers' | 'resellers';
    title: string;
    message: string;
    link?: string;
}

/**
 * Sends one notification to every user in the selected audience.
 *
 * Reads in pages rather than loading every profile at once: a `get()` with no
 * limit pulls the entire collection into memory, and on a marketplace-sized
 * `userProfiles` that is a real outage rather than a slow request.
 */
export async function sendBulkNotifications(
    payload: NotificationPayload,
): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
        // Typed as Query, not CollectionReference: `where()` returns a Query,
        // so a single `let` typed from the initial value could never accept it.
        const base = db.collection('userProfiles');
        const q =
            payload.targetAudience === 'all'
                ? base
                : base.where('userRole', '==', payload.targetAudience);

        const PAGE = 500;
        let notificationCount = 0;
        let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;

        for (;;) {
            let page = q.limit(PAGE);
            if (last) page = page.startAfter(last);

            const snap = await page.get();
            if (snap.empty) break;

            // VPS-controlled storage: each profile gets its own record through
            // the notification store (PocketBase, Firestore fallback). The
            // per-recipient dedupe query is skipped for a broadcast — it runs
            // once per user here, and an announcement re-sent by a retried
            // admin action is far less costly than 500 extra round trips.
            await Promise.all(
                snap.docs.map((userDoc) =>
                    createNotification({
                        userId: userDoc.id,
                        type: 'announcement',
                        title: payload.title,
                        message: payload.message,
                        link: payload.link || '',
                        category: 'system',
                        dedupeWindowMs: 0,
                    }),
                ),
            );
            notificationCount += snap.size;

            last = snap.docs[snap.docs.length - 1];
            if (snap.size < PAGE) break;
        }

        /*
         * Push every recipient.
         *
         * A broadcast that only lands in the in-app inbox is not a broadcast —
         * the whole point is reaching people who are not looking at the app.
         * Fire-and-forget per user so one unreachable device cannot stop the
         * rest of the audience, and deliberately not awaited: on a large
         * audience this is thousands of FCM calls and the admin who pressed
         * the button should not be held on the request.
         */
        const audienceQ =
            payload.targetAudience === 'all'
                ? db.collection('userProfiles').select()
                : db.collection('userProfiles').where('userRole', '==', payload.targetAudience).select();

        await audienceQ.get().then((snap) => {
            snap.forEach((userDoc) => {
                void pushExistingNotification(userDoc.id, {
                    title: payload.title,
                    body: payload.message,
                    link: payload.link || '',
                    category: 'system',
                });
            });
        });

        return { success: true, count: notificationCount };
    } catch (error) {
        console.error('Error sending bulk notifications:', error);
        return { success: false, error: 'Failed to send notifications. Check server logs.' };
    }
}

interface DirectNotificationPayload {
    userId: string;
    title: string;
    message: string;
    link?: string;
}

/** Sends one notification to one user, typically from an admin action. */
export async function sendDirectNotification(
    payload: DirectNotificationPayload,
): Promise<{ success: boolean; error?: string }> {
    try {
        await createNotification({
            userId: payload.userId,
            type: 'announcement',
            title: payload.title,
            message: payload.message,
            link: payload.link || '',
            category: 'system',
        });

        // An admin writing to one user is usually a support answer or a
        // moderation outcome — both worth a phone buzz.
        void pushExistingNotification(payload.userId, {
            title: payload.title,
            body: payload.message,
            link: payload.link || '',
            category: 'system',
        });

        return { success: true };
    } catch (error) {
        console.error('Error sending direct notification:', error);
        return { success: false, error: 'Failed to send notification. Check server logs.' };
    }
}
