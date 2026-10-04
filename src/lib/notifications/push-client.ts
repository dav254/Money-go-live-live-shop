'use client';

/**
 * PUSH SUBSCRIPTIONS — the browser half.
 *
 * ## Why FCM and not a third-party push SDK
 *
 * `firebase-admin` already ships Cloud Messaging, the project already has a
 * Firebase project, and `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` is already
 * configured. Using it means no new vendor, no new credential, and one SDK
 * between the client and the server instead of two. The alternative — adding a
 * dedicated push provider — would mean a second account, a second SDK and a
 * second thing that can silently stop delivering.
 *
 * ## One subscription per device per user
 *
 * A subscription is keyed by its own endpoint under
 * `pushSubscriptions/{uid}/devices/{subscriptionId}`, so a user who signs in on
 * a phone and a tablet gets two independent records and can be revoked on one
 * without touching the other. A single document keyed only by uid would mean
 * signing in on a second device silently killed push on the first.
 *
 * ## Every failure is silent on purpose
 *
 * Permission denial, an unsupported browser, a private-mode storage failure —
 * none of them should break the screen the user was trying to read. Everything
 * here returns a discriminated result instead of throwing, and the caller
 * decides whether it is worth telling the user about.
 */

import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging';
import type { User } from 'firebase/auth';

/** Result of an opt-in attempt. Never throws. */
export type PushOptInResult =
  | { status: 'enabled'; token: string }
  | { status: 'denied' }
  | { status: 'dismissed'; reason: string }
  | { status: 'unsupported' }
  | { status: 'error'; reason: string };

export type PushSupport = 'granted' | 'denied' | 'default' | 'unsupported';

/** Whether this browser can take push at all. */
export async function pushSupport(): Promise<PushSupport> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
  try {
    if (!(await isSupported())) return 'unsupported';
  } catch {
    return 'unsupported';
  }
  if (!('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return Notification.permission as PushSupport;
}

/**
 * The VAPID public key.
 *
 * Read from the environment rather than hardcoded, because it is a per-project
 * value: a key baked into the bundle would be wrong the moment this app is
 * cloned into a second Firebase project, and would fail in a way that looks
 * like a browser bug rather than a config one.
 */
export function vapidPublicKey(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';
}

/**
 * Requests permission and registers this device.
 *
 * The permission prompt is only ever shown from a user gesture, so callers must
 * invoke this from a click handler — never from an effect on mount. A prompt
 * fired without a gesture is silently dropped by Chrome, which reads to the
 * user as "the button does nothing".
 */
export async function enablePush(user: User): Promise<PushOptInResult> {
  try {
    if (typeof window === 'undefined') return { status: 'unsupported' };

    const key = vapidPublicKey();
    if (!key) {
      return {
        status: 'error',
        reason: 'Push is not configured yet — NEXT_PUBLIC_FIREBASE_VAPID_KEY is missing.',
      };
    }

    const permission = await Notification.requestPermission();
    if (permission === 'denied') return { status: 'denied' };
    if (permission !== 'granted') return { status: 'dismissed', reason: 'Permission dismissed.' };

    // The worker must be registered and CONTROLLING before getToken, otherwise
    // FCM has nowhere to attach the subscription.
    const registration = await navigator.serviceWorker.ready;

    const token = await getToken(getMessaging(), {
      vapidKey: key,
      serviceWorkerRegistration: registration,
    });

    if (!token) return { status: 'error', reason: 'Firebase returned no messaging token.' };

    /*
     * Registered server-side, not written straight to Firestore.
     *
     * The rules would allow the client to write its own subtree, but a token
     * is a bearer credential: a user who pasted someone else's into this call
     * would start receiving that person's order and payment notifications.
     * The route verifies the ID token and takes the uid from it, never from
     * the body.
     */
    const idToken = await user.getIdToken();
    const res = await fetch('/api/notifications/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        token,
        deviceId: hashToken(token),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : '',
      }),
    });

    if (!res.ok) {
      return { status: 'error', reason: 'Could not register this device for notifications.' };
    }

    return { status: 'enabled', token };
  } catch (err) {
    return { status: 'error', reason: err instanceof Error ? err.message : 'Unknown error.' };
  }
}

/**
 * Revokes push on THIS device.
 *
 * Only the local FCM token can be deleted from the browser; the stored record
 * is removed by the server (`/api/notifications/push/revoke`), which deletes
 * every device for the user. That asymmetry is deliberate: a user who turns
 * notifications off means "stop sending to me", not "stop sending to the phone
 * I am currently holding", and leaving the other devices live would be the
 * surprising reading.
 */
export async function disablePush(user: User): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    if (await isSupported()) {
      await deleteToken(getMessaging());
    }

    const idToken = await user.getIdToken();
    await fetch('/api/notifications/push/revoke', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * A stable short id for a token, used as the device document id.
 *
 * A plain hash is enough here: it only has to be stable and collision-free
 * within one user's own devices, and it is never used as a secret.
 */
function hashToken(token: string): string {
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = (h << 5) - h + token.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}
