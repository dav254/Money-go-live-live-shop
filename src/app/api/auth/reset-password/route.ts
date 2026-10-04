import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { db } from '@/firebase/server';
import { hashToken, logSecurityEvent } from '@/lib/notifications/server';
import { sendPasswordChangedEmail } from '@/lib/notifications';

export const runtime = 'nodejs';

const MAX_ATTEMPTS_PER_TOKEN = 5;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = (body?.token ?? '').toString();
    const newPassword = (body?.newPassword ?? '').toString();

    if (!token || newPassword.length < 8) {
      return NextResponse.json(
        { ok: false, message: 'Password must be at least 8 characters.' },
        { status: 400 },
      );
    }

    const tokenHash = hashToken(token);

    // ---- Find and validate the token ----
    const snap = await db
      .collection('passwordResetTokens')
      .where('tokenHash', '==', tokenHash)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ ok: false, message: 'This reset link is invalid or has already been used.' }, { status: 400 });
    }
    const docSnap = snap.docs[0];
    const data = docSnap.data() as {
      uid: string; email: string; expiresAt: Date; usedAt: Date | null; attempts: number;
    };

    // Brute-force protection on a single token.
    if ((data.attempts ?? 0) >= MAX_ATTEMPTS_PER_TOKEN) {
      await docSnap.ref.delete();
      return NextResponse.json({ ok: false, message: 'This reset link is invalid or has expired.' }, { status: 400 });
    }

    const rawExpiry = data.expiresAt as unknown;
    const expiresAt: Date =
      rawExpiry instanceof Date
        ? rawExpiry
        : typeof (rawExpiry as any)?.toDate === 'function'
          ? (rawExpiry as any).toDate()
          : new Date(rawExpiry as any);
    if (data.usedAt || expiresAt < new Date()) {
      return NextResponse.json({ ok: false, message: 'This reset link is invalid or has expired.' }, { status: 400 });
    }

    // ---- Update the Firebase Auth password via Admin SDK ----
    const auth = getAuth();
    try {
      await auth.updateUser(data.uid, { password: newPassword });
    } catch {
      return NextResponse.json({ ok: false, message: 'Could not update the password. Try again.' }, { status: 500 });
    }

    // ---- Single-use: burn the token ----
    await docSnap.ref.update({ usedAt: new Date() });

    // ---- Invalidate other sessions (revokes refresh tokens) ----
    try {
      await auth.revokeRefreshTokens(data.uid);
    } catch (error) {
      console.error('[reset-password] token revocation failed:', error);
    }

    // ---- Confirmation + security notification ----
    await sendPasswordChangedEmail(data.email, data.email.split('@')[0]);
    await logSecurityEvent({ userId: data.uid, type: 'PASSWORD_RESET_COMPLETED', ip: request.headers.get('x-forwarded-for') ?? '' });

    return NextResponse.json({ ok: true, message: 'Password updated. You can now sign in.' });
  } catch (error) {
    console.error('[reset-password]', error);
    return NextResponse.json({ ok: false, message: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
