'use client';

/**
 * PUSH SUBSCRIPTIONS — the browser half, standards-based Web Push (VAPID).
 *
 * ## Why not FCM
 *
 * The notification section is VPS-controlled end to end. `getToken()` tied
 * every subscription and every send to Firebase Cloud Messaging; the flow
 * below uses only the open Web Push APIs every modern browser ships:
 * `Notification.requestPermission()` → `serviceWorker.ready` →
 * `pushManager.subscribe({ applicationServerKey })`. The server then posts
 * straight to the browser vendor's push service with our VAPID key (see
 * `push-server.ts`). No Firebase messaging code, no second vendor.
 *
 * ## Permission is only ever requested from a user gesture
 *
 * `enablePush` must be called from a click handler — never from an effect on
 * mount. A prompt fired without a gesture is silently dropped by Chrome,
 * which reads to the user as "the button does nothing". The settings screen's
 * enable toggle is that gesture.
 *
 * ## One subscription per device per user
 *
 * A subscription is keyed by its endpoint, so a user who signs in on a phone
 * and a tablet gets two independent records and can revoke one without
 * touching the other.
 *
 * ## Every failure is silent on purpose
 *
 * Permission denial, an unsupported browser, a private-mode storage failure —
 * none of them should break the screen the user was trying to read. Everything
 * here returns a discriminated result instead of throwing, and the caller
 * decides whether it is worth telling the user about.
 */

import type { User } from 'firebase/auth';

/** Result of an opt-in attempt. Never throws. */
export type PushOptInResult =
  | { status: 'enabled'; endpoint: string }
  | { status: 'denied' }
  | { status: 'dismissed'; reason: string }
  | { status: 'unsupported' }
  | { status: 'error'; reason: string };

export type PushSupport = 'granted' | 'denied' | 'default' | 'unsupported';

/** Whether this browser can take push at all. */
export async function pushSupport(): Promise<PushSupport> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
  if (!('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return Notification.permission as PushSupport;
}

/**
 * The VAPID public key the browser subscribes with.
 *
 * `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is the pair's own key; the Firebase-named
 * variable is read only as a migration fallback — the server signs with
 * `VAPID_PRIVATE_KEY`, so BOTH halves must belong to the same generated pair
 * or the push service rejects every send.
 */
export function vapidPublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
    ''
  );
}

/** base64url → Uint8Array, as `applicationServerKey` requires. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = typeof atob === 'function' ? atob(base64) : '';
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Requests permission and registers this device — call ONLY from a click
 * handler (see the file header).
 */
export async function enablePush(user: User): Promise<PushOptInResult> {
  try {
    if (typeof window === 'undefined') return { status: 'unsupported' };

    if (!(await pushSupportIsUsable())) return { status: 'unsupported' };

    const key = vapidPublicKey();
    if (!key) {
      return {
        status: 'error',
        reason:
          'Push is not configured yet — NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing on the server.',
      };
    }

    const permission = await Notification.requestPermission();
    if (permission === 'denied') return { status: 'denied' };
    if (permission !== 'granted') return { status: 'dismissed', reason: 'Permission dismissed.' };

    // The worker must be registered and CONTROLLING before subscribing,
    // otherwise the subscription has no worker to wake.
    const registration = await navigator.serviceWorker.ready;

    /*
     * Always recreate rather than reuse: a subscription left over from the
     * retired FCM flow was created with FIREBASE's VAPID key, and the push
     * service rejects any send signed by a different pair — reusing it would
     * look like "push does nothing" with no error anywhere. Dropping the old
     * one and subscribing with OUR key guarantees the pair matches; the old
     * server record is pruned after its first failed send (404/410).
     */
    const existing = await registration.pushManager.getSubscription();
    if (existing) await existing.unsubscribe().catch(() => undefined);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });

    /*
     * Registered server-side, never stored from the browser alone — see the
     * subscribe route: the subscription is a bearer credential, so the uid
     * comes from the verified ID token rather than the body.
     */
    const idToken = await user.getIdToken();
    const res = await fetch('/api/notifications/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : '',
      }),
    });

    if (!res.ok) {
      return { status: 'error', reason: 'Could not register this device for notifications.' };
    }

    return { status: 'enabled', endpoint: subscription.endpoint };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error.';
    // A SecurityError here almost always means the public key on the server
    // is not the pair's — or is base64 that is not url-safe. Name it.
    if (message.includes('SecurityError') || /applicationServerKey|VAPID/i.test(message)) {
      return {
        status: 'error',
        reason:
          'The VAPID keys do not match. NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be the same generated pair.',
      };
    }
    return { status: 'error', reason: message };
  }
}

/** Browser capability check that also treats an already-granted prompt as usable. */
async function pushSupportIsUsable(): Promise<boolean> {
  return (await pushSupport()) !== 'unsupported';
}

/**
 * Revokes push on THIS device.
 *
 * The local subscription is unsubscribed here; the server route then removes
 * EVERY stored subscription for the user ("stop sending to me", not "stop
 * sending to this phone"). Preferences survive a revoke.
 */
export async function disablePush(user: User): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const registration = await navigator.serviceWorker.getRegistration();
      const sub = await registration?.pushManager?.getSubscription();
      if (sub) await sub.unsubscribe();
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