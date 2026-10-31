import { NextRequest, NextResponse } from 'next/server';
import { verifyUserUid } from '@/lib/notifications/server';
import { notify } from '@/lib/notifications';
import { db } from '@/firebase/server';
import { ensureUserProfile } from '@/lib/auth/profile-ensure';
import { issueEmailVerification } from '@/lib/auth/email-verification';
import { broadcastAdminAlert } from '@/lib/whatsapp/bridge';
import type { StoreDb } from '@/lib/notifications/email-store';

export const runtime = 'nodejs';

/**
 * POST — fired right after account creation (welcome flow).
 *
 * This is also the SERVER-SIDE PROFILE GUARANTEE: the client sends the
 * profile it believes it created, and this route makes sure it actually
 * exists — written with the admin SDK (Firestore) and mirrored to the local
 * VPS store — before any client-side write failure can strand the account
 * with no profile ("We couldn't load your account").
 */
export async function POST(request: NextRequest) {
  const uid = await verifyUserUid(request);
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = (body?.name ?? '').toString();
  const role = (body?.role ?? 'buyer').toString();
  const email = (body?.email ?? '').toString() || undefined;
  const username = (body?.username ?? '').toString() || undefined;
  const phone = (body?.phone ?? '').toString() || undefined;
  const profilePictureUrl = (body?.profilePictureUrl ?? '').toString() || undefined;

  const profile = await ensureUserProfile({ uid, role, name, email, username, phone, profilePictureUrl });
  const address = email ?? profile?.email;

  // ---- Signup verification (single-use, 24h, hashed at rest) ----
  // Best-effort: if the token store cannot be written we fall back to the
  // plain welcome email so a signup is never silent. Verification is
  // non-blocking — login and sessions are untouched.
  let verificationLink: string | undefined;
  if (address) {
    try {
      verificationLink =
        (await issueEmailVerification(db as unknown as StoreDb, uid, address)) ?? undefined;
    } catch {
      verificationLink = undefined;
    }
  }

  await notify({
    userId: uid,
    type: 'WELCOME',
    title: 'Welcome to Vidnov',
    message: role === 'seller'
      ? 'Your business account is ready. Add your first listing to start selling.'
      : 'Your account is ready. Discover local businesses and start exploring.',
    link: role === 'seller' ? '/dashboard/seller' : '/buyer/dashboard',
    email: address
      ? {
          to: address,
          // With a token: the verification email. Without one: the plain
          // welcome (graceful degradation — never an empty “confirm” link).
          templateKey: verificationLink ? 'verify-email' : 'welcome',
          category: 'account',
          userName: name || undefined,
          ...(verificationLink ? { vars: { verification_link: verificationLink } } : {}),
        }
      : undefined,
    db,
  });

  // Admin alert on the VPS WhatsApp bridge (Baileys) — a silent no-op until
  // a phone is paired. Fire-and-forget: a WhatsApp hiccup must never fail
  // the welcome flow.
  void broadcastAdminAlert(
    role === 'seller' ? '🆕 New seller registered' : '🆕 New user registered',
    `${name || 'Someone'} just created a ${role} account${address ? ` (${address})` : ''}.`,
  ).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
