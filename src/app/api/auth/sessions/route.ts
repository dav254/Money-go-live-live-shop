import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '@/firebase/server';
import { verifyUserUid, deviceLabelFromRequest, logSecurityEvent } from '@/lib/notifications/server';
import { sendNewLoginAlert } from '@/lib/notifications';

export const runtime = 'nodejs';

interface SessionDoc {
  device: string;
  ip: string;
  current: boolean;
  lastActive: Date;
  createdAt: Date;
}

/** GET — list active sessions for the signed-in user. */
export async function GET(request: NextRequest) {
  const uid = await verifyUserUid(request);
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });

  const snap = await db
    .collection('userSessions')
    .where('uid', '==', uid)
    .orderBy('lastActive', 'desc')
    .limit(20)
    .get();

  const sessions = snap.docs.map(d => {
    const s = d.data() as SessionDoc & { lastActive?: { toDate?: () => Date }; createdAt?: { toDate?: () => Date } };
    return {
      id: d.id,
      device: s.device,
      ip: s.ip,
      current: s.current ?? false,
      lastActive: s.lastActive?.toDate?.()?.toISOString?.() ?? null,
      createdAt: s.createdAt?.toDate?.()?.toISOString?.() ?? null,
    };
  });
  return NextResponse.json({ ok: true, sessions });
}

/** POST — heartbeat/register the current device; alerts on new devices. */
export async function POST(request: NextRequest) {
  const uid = await verifyUserUid(request);
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });

  const device = deviceLabelFromRequest(request);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // Mark everything stale, then upsert current device.
  const existing = await db.collection('userSessions').where('uid', '==', uid).get();

  const currentDoc = existing.docs.find(d => (d.data() as SessionDoc).device === device && (d.data() as SessionDoc).current);

  const batch = db.batch();
  existing.docs.forEach(d => batch.update(d.ref, { current: false }));

  if (currentDoc) {
    batch.update(currentDoc.ref, { current: true, lastActive: FieldValue.serverTimestamp() });
  } else {
    batch.set(db.collection('userSessions').doc(), {
      uid, device, ip, current: true,
      lastActive: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  // New-device detection → security email (mandatory category).
  if (!currentDoc) {
    const profile = await db.collection('userProfiles').doc(uid).get();
    const email = profile.data()?.email as string | undefined;
    if (email) {
      await sendNewLoginAlert(email, {
        device,
        location: ip,
        userName: profile.data()?.fullName as string | undefined,
      });
    }
    await logSecurityEvent({ userId: uid, type: 'NEW_DEVICE_LOGIN', detail: { device, ip } });
  }

  return NextResponse.json({ ok: true });
}

/** DELETE ?sessionId=… | ?allOthers=1 — log out one or all other devices. */
export async function DELETE(request: NextRequest) {
  const uid = await verifyUserUid(request);
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');
  const allOthers = url.searchParams.get('allOthers') === '1';

  if (allOthers) {
    const snap = await db.collection('userSessions').where('uid', '==', uid).get();
    const batch = db.batch();
    snap.docs.forEach(d => {
      if (!(d.data() as SessionDoc).current) batch.delete(d.ref);
    });
    await batch.commit();
    await logSecurityEvent({ userId: uid, type: 'LOGOUT_ALL_OTHER_DEVICES' });
    return NextResponse.json({ ok: true });
  }

  if (sessionId) {
    const ref = db.collection('userSessions').doc(sessionId);
    const docSnap = await ref.get();
    if (docSnap.exists && (docSnap.data() as SessionDoc & { uid?: string }).uid === uid) {
      await ref.delete();
      return NextResponse.json({ ok: true });
    }
  }
  return NextResponse.json({ ok: false, message: 'Session not found.' }, { status: 404 });
}
