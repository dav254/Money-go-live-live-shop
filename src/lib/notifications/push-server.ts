/**
 * PUSH DELIVERY — the server half.
 *
 * Sends a Web Push message to every device a user has subscribed, using
 * Firebase Cloud Messaging (already available inside `firebase-admin`, so no
 * new dependency and no new vendor account).
 *
 * ## Where this is called from
 *
 * From `notify()` in `engine.ts`, immediately after the in-app document is
 * written. In-app and push are the same event: if the bell in the app updates,
 * the phone buzzes, and if the push fails the in-app notification still
 * exists. Push is additive and never load-bearing.
 *
 * ## Every failure is swallowed
 *
 * A dead subscription, a revoked permission or a malformed token must never
 * fail the operation that triggered the notification — placing an order, taking
 * a payment, sending a chat message. `notify()` is called from feature code
 * that has real work to do. So every path here logs and returns a count, and
 * nothing throws.
 *
 * ## Pruning dead tokens
 *
 * FCM reports `messaging/registration-token-not-registered` when a token is
 * gone (uninstalled the PWA, cleared site data, revoked permission). Those
 * devices are deleted rather than retried forever, so the collection does not
 * grow without bound and stop being sendable.
 */

import { getMessaging } from 'firebase-admin/messaging';
import type { Firestore } from 'firebase-admin/firestore';
import { isPushEnabledFor } from './push-preferences';

export interface PushPayload {
  title: string;
  body: string;
  /** In-app path the notification opens, e.g. `/app/buyer/orders`. */
  link?: string;
  /** Notification type, used for per-category preferences. */
  category?: string;
}

/**
 * Pushes a notification that was already written by something other than
 * `notify()`.
 *
 * ## Why this exists
 *
 * The engine is not the only writer of `notifications`. Three server-side
 * paths predate it and write the collection directly:
 *
 *   - `lib/ai/notify.ts`                  AI lifecycle events
 *   - `app/actions/invoice-actions.ts`    invoice raised for a seller
 *   - `app/actions/notification-actions.ts` admin broadcast + direct message
 *
 * Routing them all through `notify()` would mean rewriting their document
 * shapes — they use `status`/`timestamp` where the engine writes
 * `isRead`/`createdAt`, and every existing reader depends on those field
 * names. Changing the shape to suit the push path would risk the in-app inbox
 * to fix a delivery channel.
 *
 * So this pushes a notification that is ALREADY on its way into the inbox,
 * without touching the document. The notification is not lost if push fails —
 * push is additive, never load-bearing.
 */
export async function pushExistingNotification(
  db: Firestore,
  userId: string,
  payload: PushPayload,
): Promise<PushResult> {
  try {
    // Same per-category opt-in the engine applies, so a user who muted live
    // streams is not surprised by a push from a path that skipped the engine.
    if (!(await isPushEnabledFor(db, userId, payload.category || 'system'))) {
      return { sent: 0, failed: 0, pruned: 0, skipped: 'no-subscriptions' };
    }
    return await sendPushToUser(db, userId, payload);
  } catch (err) {
    console.error('[push] existing-notification push failed:', err);
    return { sent: 0, failed: 0, pruned: 0 };
  }
}

export interface PushResult {
  sent: number;
  failed: number;
  pruned: number;
  skipped?: 'no-subscriptions' | 'not-configured' | 'no-token';
}

/**
 * Delivers `payload` to every device `userId` has subscribed.
 *
 * Uses `sendEachForMulticast` rather than `sendAll`: multicast survives one bad
 * token in the batch, where `sendAll` rejects the whole batch if any single
 * registration is stale.
 */
export async function sendPushToUser(
  db: Firestore,
  userId: string,
  payload: PushPayload,
): Promise<PushResult> {
  const empty: PushResult = { sent: 0, failed: 0, pruned: 0 };

  if (!userId) return empty;

  try {
    const snap = await db.collection('pushSubscriptions').doc(userId).get();
    const devices = (snap.data()?.devices ?? {}) as Record<string, { token?: string }>;

    const entries = Object.entries(devices)
      .filter(([, d]) => typeof d?.token === 'string' && d.token.length > 0);

    if (entries.length === 0) return { ...empty, skipped: 'no-subscriptions' };

    /*
     * Fail loudly, and early, when the VAPID key is missing.
     *
     * Without it FCM rejects every send with an opaque error, and because
     * every failure here is deliberately swallowed so it cannot break the
     * order or payment that triggered the notification, that rejection would
     * otherwise be invisible — the platform would look like it was quietly
     * failing to notify anyone. This is the single most common reason push
     * "does nothing", so it is worth naming explicitly rather than logging one
     * generic line per send.
     *
     * The key itself is PUBLIC (it ships to every browser by design); the
     * matching private key never leaves Firebase.
     */
    if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
      console.warn(
        '[push] NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set — skipping delivery. ' +
          'Generate a Web Push key pair in Firebase console → Project settings → ' +
          'Cloud Messaging → Web Push certificates, then add the public key to the env.',
      );
      return { ...empty, skipped: 'not-configured' };
    }

    const messaging = getMessaging();
    const prunedDocIds: string[] = [];

    /*
     * DATA-ONLY, deliberately.
     *
     * FCM's `notification` block makes the browser display a notification by
     * itself — on Android that renders from the FCM SDK even when the app is
     * closed, which is exactly the behaviour we want. But it also means the
     * service worker's `push` handler never runs, so this app would lose the
     * icon, the tag and the deep-link handler.
     *
     * Putting the text in `data` and rendering it in `sw.js` instead costs one
     * extra step — the phone must be able to start the service worker — and
     * buys full control over presentation and navigation. It is also the only
     * way `notificationclick` can sanitise the link before opening it.
     */
    const response = await messaging.sendEachForMulticast({
      tokens: entries.map(([, d]) => d.token as string),
      data: {
        title: payload.title,
        body: payload.body,
        link: payload.link || '/',
        category: payload.category || 'system',
      },
    });

    response.responses.forEach((r, i) => {
      if (r.success) return;
      const code = r.error?.code || '';
      if (
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-registration-token') ||
        code.includes('invalid-argument')
      ) {
        prunedDocIds.push(entries[i][0]);
      }
    });

    if (prunedDocIds.length > 0) {
      const batch = db.batch();
      prunedDocIds.forEach((id) => {
        batch.delete(db.collection('pushSubscriptions').doc(userId).collection('devices').doc(id));
      });
      await batch.commit().catch(() => undefined);
    }

    return {
      sent: response.successCount,
      failed: response.failureCount,
      pruned: prunedDocIds.length,
    };
  } catch (err) {
    // Never throw into the caller's feature code.
    console.error('[push] delivery failed:', err);
    return { ...empty, skipped: 'not-configured' };
  }
}
