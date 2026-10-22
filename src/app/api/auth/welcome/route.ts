import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyUserUid } from '@/lib/notifications/server';
import { notify } from '@/lib/notifications';
import { broadcastAdminAlert } from '@/lib/whatsapp/bridge';

export const runtime = 'nodejs';

/** POST — fired after successful account creation (welcome flow). */
export async function POST(request: NextRequest) {
  const uid = await verifyUserUid(request);
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = (body?.name ?? '').toString();
  const role = (body?.role ?? 'buyer').toString();

  const profileSnap = await db.collection('userProfiles').doc(uid).get();
  const email = profileSnap.data()?.email as string | undefined;

  await notify({
    userId: uid,
    type: 'WELCOME',
    title: 'Welcome to Vidnov',
    message: role === 'seller'
      ? 'Your business account is ready. Add your first listing to start selling.'
      : 'Your account is ready. Discover local businesses and start exploring.',
    link: role === 'seller' ? '/dashboard/seller' : '/buyer/dashboard',
    email: email
      ? { to: email, templateKey: 'welcome', category: 'account', userName: name || undefined }
      : undefined,
    db,
  });

  // Admin alert on the VPS WhatsApp bridge (Baileys) — a silent no-op until
  // a phone is paired. Fire-and-forget: a WhatsApp hiccup must never fail
  // the welcome flow.
  void broadcastAdminAlert(
    role === 'seller' ? '🆕 New seller registered' : '🆕 New user registered',
    `${name || 'Someone'} just created a ${role} account${email ? ` (${email})` : ''}.`,
  ).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
