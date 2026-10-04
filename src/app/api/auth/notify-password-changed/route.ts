import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { db } from '@/firebase/server';
import { verifyUserUid } from '@/lib/notifications/server';
import { sendPasswordChangedEmail, notify } from '@/lib/notifications';

export const runtime = 'nodejs';

/** POST — fired by Settings → Security after a successful password change. */
export async function POST(request: NextRequest) {
  const uid = await verifyUserUid(request);
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });

  const profileSnap = await db.collection('userProfiles').doc(uid).get();
  const email = profileSnap.data()?.email as string | undefined;
  const name = (profileSnap.data()?.fullName as string | undefined) ?? undefined;

  if (email) {
    await sendPasswordChangedEmail(email, name);
  }

  await notify({
    userId: uid,
    type: 'PASSWORD_CHANGED',
    title: 'Password changed',
    message: 'Your Vidnov password was just changed. If this wasn’t you, reset it immediately.',
    link: '/dashboard/security',
    db,
  });

  // Revoke refresh tokens so other sessions are signed out.
  try {
    await getAuth().revokeRefreshTokens(uid);
  } catch (error) {
    console.error('[notify-password-changed] revocation failed:', error);
  }

  return NextResponse.json({ ok: true });
}
