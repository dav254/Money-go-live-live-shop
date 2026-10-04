import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';

/**
 * Revokes push for every device — `POST /api/notifications/push/revoke`.
 *
 * ## Why all devices, not just this one
 *
 * The browser can only delete the local FCM token. If the server kept the
 * record, the platform would keep queuing messages for a subscription the user
 * has explicitly switched off, and delivery would fail repeatedly against a
 * token nobody can revoke from the device any more.
 *
 * The user's intent when they turn notifications off is "stop sending to me",
 * not "stop sending to the phone in my hand" — so every device goes.
 *
 * Deletes the subcollection rather than the parent document so a concurrent
 * subscribe cannot be wiped by a revoke that started a moment earlier.
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

  try {
    // `listDocuments()` resolves to DocumentReference[] directly — not a
    // QuerySnapshot — so the refs are already what `batch.delete` wants.
    const devices = await db
      .collection('pushSubscriptions')
      .doc(uid)
      .collection('devices')
      .listDocuments();

    if (devices.length > 0) {
      const batch = db.batch();
      devices.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    // The preferences survive a revoke — the user only turned off delivery,
    // not their choices about which sections matter. Re-enabling later should
    // not silently reset them.
    return NextResponse.json({ ok: true, removed: devices.length });
  } catch (err) {
    console.error('[push] revoke failed', err);
    return NextResponse.json({ error: 'Could not revoke' }, { status: 500 });
  }
}
