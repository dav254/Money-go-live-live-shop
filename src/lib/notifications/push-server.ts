/**
 * PUSH DELIVERY — the server half, standards-based Web Push over VAPID.
 *
 * ## Why not Firebase Cloud Messaging
 *
 * The notification section is VPS-controlled end to end. FCM would put the
 * delivery channel back behind Firebase (a second vendor, a second credential
 * set, and a `messaging` dependency the app is otherwise done with), so
 * delivery uses the open Web Push protocol: `web-push` signs each request
 * with our VAPID key pair and posts straight to the browser vendor's push
 * service (FCM's web endpoint, Mozilla, Apple…). No third-party notification
 * backend is introduced — the same phone that used to buzz still buzzes.
 *
 * ## Configuration
 *
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY   client key (base64url) — also used by the
 *                                  browser at `pushManager.subscribe`
 *   VAPID_PRIVATE_KEY              server-only twin of the public key
 *   VAPID_SUBJECT                  optional; defaults to `mailto:` support
 *
 * Generate a pair with `npx web-push generate-vapid-keys`. The public key MUST
 * be the one the browser subscribed with — the push service records it and
 * rejects sends signed by any other pair. Until both halves are set every send
 * skips with `not-configured` (logged once), because a half-configured VAPID
 * pair fails opaquely at the vendor and would look like "push does nothing".
 *
 * ## Every failure is swallowed
 * A dead subscription, a revoked permission or a vendor outage must never fail
 * the order, payment or chat message that triggered the notification. Nothing
 * here throws into feature code; each path logs and returns a count.
 *
 * ## Pruning
 * 404/410 from the push service means the subscription is gone (app
 * uninstalled, site data cleared). Those records are deleted rather than
 * retried forever, so the store does not grow without bound.
 */

import webpush from 'web-push';
import { getVidnovConfig } from './config';
import {
  isPushEnabledFor,
  listPushSubscriptions,
  prunePushSubscription,
  type PushSubscriptionJson,
} from './store';

export interface PushPayload {
  title: string;
  body: string;
  /** In-app path the notification opens, e.g. `/app/buyer/orders`. */
  link?: string;
  /** Notification type, used for per-category preferences. */
  category?: string;
}

export interface PushResult {
  sent: number;
  failed: number;
  pruned: number;
  skipped?: 'no-subscriptions' | 'not-configured' | 'no-token';
}

interface VapidDetails {
  publicKey: string;
  privateKey: string;
  subject: string;
}

let warnedMissingKeys = false;

/** Resolves the VAPID pair, or null when it is not (fully) configured. */
function vapidDetails(): VapidDetails | null {
  const privateKey = (process.env.VAPID_PRIVATE_KEY ?? '').trim();
  const publicKey = (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ??
    ''
  )
    .trim();
  if (!privateKey || !publicKey) {
    if (!warnedMissingKeys) {
      warnedMissingKeys = true;
      console.warn(
        '[push] VAPID is not fully configured — skipping delivery. Generate a pair with ' +
          '`npx web-push generate-vapid-keys`, then set NEXT_PUBLIC_VAPID_PUBLIC_KEY and ' +
          'VAPID_PRIVATE_KEY. The public key must be the one the browser subscribed with.',
      );
    }
    return null;
  }
  const { mailAddresses } = getVidnovConfig();
  const subject = (process.env.VAPID_SUBJECT ?? '').trim() || `mailto:${mailAddresses.support}`;
  return { publicKey, privateKey, subject };
}

/**
 * Pushes a notification that was already written by something other than
 * `notify()` (admin broadcasts, direct messages, invoices, AI lifecycle
 * events). Push is additive and never load-bearing — the in-app record
 * already exists by the time this runs.
 */
export async function pushExistingNotification(
  userId: string,
  payload: PushPayload,
): Promise<PushResult> {
  try {
    // Same per-category opt-in the engine applies, so a user who muted live
    // streams is not surprised by a push from a path that skipped the engine.
    if (!(await isPushEnabledFor(userId, payload.category || 'system'))) {
      return { sent: 0, failed: 0, pruned: 0, skipped: 'no-subscriptions' };
    }
    return await sendPushToUser(userId, payload);
  } catch (err) {
    console.error('[push] existing-notification push failed:', err);
    return { sent: 0, failed: 0, pruned: 0 };
  }
}

/** True when the payload is a usable Web Push subscription. */
function isSendable(sub: PushSubscriptionJson): sub is PushSubscriptionJson & {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} {
  return !!sub?.endpoint && !!sub.keys?.p256dh && !!sub.keys?.auth;
}

/**
 * Delivers `payload` to every device `userId` has subscribed, in parallel.
 * One broken device cannot hold up — or fail — the rest of the batch.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<PushResult> {
  const empty: PushResult = { sent: 0, failed: 0, pruned: 0 };
  if (!userId) return empty;

  const vapid = vapidDetails();
  if (!vapid) return { ...empty, skipped: 'not-configured' };

  try {
    const subs = (await listPushSubscriptions(userId)).filter(isSendable);
    if (subs.length === 0) return { ...empty, skipped: 'no-subscriptions' };

    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

    /*
     * DATA-ONLY, deliberately — same reasoning as the FCM era: the payload is
     * JSON and `public/sw.js` owns the presentation (icon, tag, deep link).
     * The sw's `push` handler already renders arbitrary JSON payloads, so the
     * transport change is invisible to it.
     */
    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      link: payload.link || '/',
      category: payload.category || 'system',
    });

    let sent = 0;
    let failed = 0;
    let pruned = 0;

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            sub as unknown as webpush.PushSubscription,
            body,
          );
          sent += 1;
        } catch (err) {
          failed += 1;
          if (
            err instanceof webpush.WebPushError &&
            (err.statusCode === 404 || err.statusCode === 410)
          ) {
            await prunePushSubscription(userId, sub.endpoint).catch(() => undefined);
            pruned += 1;
          } else {
            console.error('[push] delivery failed:', err);
          }
        }
      }),
    );

    return { sent, failed, pruned };
  } catch (err) {
    // Never throw into the caller's feature code.
    console.error('[push] delivery failed:', err);
    return { ...empty, skipped: 'not-configured' };
  }
}