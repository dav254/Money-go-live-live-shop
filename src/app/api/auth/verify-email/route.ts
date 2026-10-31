/**
 * POST /api/auth/verify-email — consumes a single-use verification link.
 *
 * Contract (mirrors `reset-password`):
 *   body { oobCode } → validates the HASHED token's existence, expiry and
 *   single-use marker, caps attempts, marks the Firebase account
 *   `emailVerified`, then sends the post-verification welcome email.
 *
 * • Never reveals whether an address has an account — one static message
 *   for invalid / expired / used-and-not-verified.
 * • A re-click of an already-consumed link reads as success when the account
 *   really is verified (back-navigation must not look like an error).
 * • No login/session changes of any kind.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { db } from '@/firebase/server';
import { hashToken, logSecurityEvent } from '@/lib/notifications/server';
import { sendTemplateEmail } from '@/lib/notifications/email-service';
import { EMAIL_VERIFICATION_TOKENS } from '@/lib/auth/email-verification';
import type { StoreDb } from '@/lib/notifications/email-store';

export const runtime = 'nodejs';

const MAX_ATTEMPTS = 5;

const GENERIC =
  'This verification link is invalid or has expired. Create a new link from the sign-up page.';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const raw = (body?.oobCode ?? '').toString().trim();
    if (!raw || raw.length > 200 || /[\s/]/.test(raw)) {
      return NextResponse.json({ ok: false, message: GENERIC }, { status: 400 });
    }

    const store = db as unknown as StoreDb;
    const snap = await store
      .collection(EMAIL_VERIFICATION_TOKENS)
      .where('tokenHash', '==', hashToken(raw))
      .limit(1)
      .get();

    const doc = snap.docs[0];
    if (!doc) {
      return NextResponse.json({ ok: false, message: GENERIC }, { status: 400 });
    }

    const data = doc.data();
    const uid = typeof data.uid === 'string' ? data.uid : '';
    const email = typeof data.email === 'string' ? data.email : '';
    if (!uid || !email) {
      return NextResponse.json({ ok: false, message: GENERIC }, { status: 400 });
    }

    const attempts = typeof data.attempts === 'number' ? data.attempts : 0;
    if (attempts >= MAX_ATTEMPTS) {
      return NextResponse.json({ ok: false, message: GENERIC }, { status: 400 });
    }

    // The account must still exist — a token for a deleted account is dead.
    let user: Awaited<ReturnType<ReturnType<typeof getAuth>['getUser']>>;
    try {
      user = await getAuth().getUser(uid);
    } catch {
      return NextResponse.json({ ok: false, message: GENERIC }, { status: 400 });
    }

    if (data.usedAt) {
      // Single-use, but a refresh must not read as failure when it worked.
      if (user.emailVerified) {
        return NextResponse.json({ ok: true, alreadyVerified: true });
      }
      return NextResponse.json({ ok: false, message: GENERIC }, { status: 400 });
    }

    const expiresAt = Date.parse(String(data.expiresAt ?? ''));
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
      return NextResponse.json({ ok: false, message: GENERIC }, { status: 400 });
    }

    await doc.ref.update({ attempts: attempts + 1 });

    try {
      await getAuth().updateUser(uid, { emailVerified: true });
    } catch {
      // Verification could not be applied — leave the token unconsumed so a
      // fresh link still works; report honestly rather than fake success.
      return NextResponse.json(
        { ok: false, message: 'Verification could not be completed right now. Please try again.' },
        { status: 500 },
      );
    }

    await doc.ref.update({ usedAt: new Date().toISOString() });

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    await logSecurityEvent({ userId: uid, type: 'EMAIL_VERIFIED', ip });

    // Post-verification welcome — best-effort, never fails the response.
    try {
      await sendTemplateEmail({
        templateKey: 'welcome',
        category: 'account',
        to: email,
        userId: uid,
        vars: { user_name: user.displayName ?? undefined },
      });
    } catch {
      /* non-fatal: the account IS verified at this point */
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: GENERIC }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
