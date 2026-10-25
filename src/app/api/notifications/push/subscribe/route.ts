import { NextRequest, NextResponse } from 'next/server';
import { verifyUserUid } from '@/lib/notifications/server-utils';
import {
  savePushSubscription,
  type PushSubscriptionJson,
} from '@/lib/notifications/store';

export const runtime = 'nodejs';

/**
 * Registers a device for Web Push — `POST /api/notifications/push/subscribe`.
 *
 * ## Why the client cannot just write this itself
 *
 * A push subscription is a bearer credential: whoever holds the endpoint plus
 * its keys receives the messages. If the browser could register any
 * subscription it liked, a user could paste somebody else's subscription and
 * start receiving that person's order and payment alerts. So the route
 * verifies the ID token, takes the uid from it, and never from the body.
 *
 * ## Body shape
 *
 * `{ subscription: { endpoint, keys: { p256dh, auth } }, userAgent }` —
 * exactly what `pushManager.subscribe()` returns (`.toJSON()`). A legacy
 * `{ token }` body (the retired FCM flow) is acknowledged but not stored:
 * FCM tokens are not addressable by standards-based Web Push, and failing
 * hard mid-deploy would only confuse an already-stale bundle.
 */
export async function POST(req: NextRequest) {
  const uid = await verifyUserUid(req);
  if (!uid) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: {
    subscription?: PushSubscriptionJson;
    token?: string;
    userAgent?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const sub = body?.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    if (typeof body?.token === 'string' && body.token.length > 0) {
      // Legacy FCM registration — see the doc comment above.
      return NextResponse.json({ ok: true, requiresReRegistration: true });
    }
    return NextResponse.json({ error: 'Missing subscription' }, { status: 400 });
  }

  try {
    await savePushSubscription(uid, sub, (body.userAgent || '').slice(0, 200));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[push] subscribe failed:', err);
    return NextResponse.json({ error: 'Could not register device' }, { status: 500 });
  }
}