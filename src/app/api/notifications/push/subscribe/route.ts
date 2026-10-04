import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Registers a device for push — `POST /api/notifications/push/subscribe`.
 *
 * ## Why the client cannot just write this itself
 *
 * Firestore rules would let any signed-in user write into their own
 * `pushSubscriptions` subtree, so the client could register a token belonging
 * to somebody else's device and then receive that person's notifications. That
 * is a real leak, not a theoretical one — it needs nothing more than a copied
 * token string.
 *
 * So the subscription is registered here instead, behind the ID token: the
 * server derives the uid from the verified token and never from the body.
 */
export async function POST(req: NextRequest) {
  const header = req.headers.get('authorization') || '';
  if (!header) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let uid: string;
  try {
    const decoded = await auth.verifyIdToken(header.replace(/^Bearer\s+/i, ''));
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  let body: { token?: string; deviceId?: string; userAgent?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const token = typeof body?.token === 'string' ? body.token.trim() : '';
  if (!token || token.length > 5000) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  try {
    const ref = db
      .collection('pushSubscriptions')
      .doc(uid)
      .collection('devices')
      .doc(body?.deviceId || hashToken(token));

    await ref.set(
      {
        token,
        platform: 'web',
        userAgent: (body?.userAgent || '').slice(0, 200),
        // `lastSeenAt` is what tells a genuinely active device apart from one
        // that has been silently dead for weeks, so pruning can prefer the
        // former when a batch fails.
        lastSeenAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[push] subscribe failed', err);
    return NextResponse.json({ error: 'Could not register device' }, { status: 500 });
  }
}

/** Stable short id, used as the device document id when the client omits one. */
function hashToken(token: string): string {
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = (h << 5) - h + token.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}
