import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { db } from '@/firebase/server';
import {
  generateToken, hashToken, genericAuthResponse, logSecurityEvent,
} from '@/lib/notifications/server';
import { sendPasswordResetEmail, appLink } from '@/lib/notifications';

export const runtime = 'nodejs';

const MAX_PER_HOUR_PER_IP = 5;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body?.email ?? '').toString().trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ ok: false, message: 'A valid email is required.' }, { status: 400 });
    }

    // ---- IP rate limiting (login-attempt protection) ----
    // Single equality query avoids a composite index; the time window is
    // filtered in memory (bounded by a small limit).
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const windowStart = Date.now() - 3_600_000;
    const recentSnap = await db
      .collection('passwordResetRequests')
      .where('ip', '==', ip)
      .limit(30)
      .get()
      .catch(() => null);
    if (recentSnap) {
      const inWindow = recentSnap.docs.filter(d => {
        const created = d.data().createdAt;
        const t = created?.toDate?.() ?? (created instanceof Date ? created : null);
        return t !== null && t.getTime() > windowStart;
      }).length;
      if (inWindow >= MAX_PER_HOUR_PER_IP) {
        // Same generic message — never reveal throttling details.
        return NextResponse.json(genericAuthResponse());
      }
    }
    await db.collection('passwordResetRequests').add({ ip, createdAt: new Date() });

    // ---- Look up the user (silently proceed when absent) ----
    let uid: string | null = null;
    let displayName = '';
    try {
      const user = await getAuth().getUserByEmail(email);
      uid = user.uid;
      displayName = user.displayName ?? '';
    } catch {
      uid = null;
    }

    if (uid) {
      const rawToken = generateToken();
      const tokenHash = hashToken(rawToken);

      // Invalidate previous outstanding tokens for this user.
      const old = await db
        .collection('passwordResetTokens')
        .where('uid', '==', uid)
        .where('usedAt', '==', null)
        .get();
      const batch = db.batch();
      old.forEach(doc => batch.delete(doc.ref));

      batch.set(db.collection('passwordResetTokens').doc(), {
        uid,
        email,
        tokenHash,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 60 minutes
        usedAt: null,
        attempts: 0,
      });
      await batch.commit();

      const resetLink = `${appLink('/reset-password')}?oobCode=${rawToken}&email=${encodeURIComponent(email)}`;
      await sendPasswordResetEmail(email, resetLink, displayName || undefined);

      await logSecurityEvent({ userId: uid, type: 'PASSWORD_RESET_REQUESTED', ip });
    } else {
      await logSecurityEvent({ type: 'PASSWORD_RESET_UNKNOWN_EMAIL', ip });
    }

    // Generic response — never reveals whether the account exists.
    return NextResponse.json(genericAuthResponse());
  } catch (error) {
    console.error('[forgot-password]', error);
    // Even on failure stay generic to avoid enumeration.
    return NextResponse.json(genericAuthResponse());
  }
}
