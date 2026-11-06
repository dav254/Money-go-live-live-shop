import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyRequestUser } from '@/lib/media/api-auth';
import { pbGetProfile, pbUpsertProfile } from '@/lib/pocketbase/profiles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/mobile/seller/role — "I want to sell", "I want to buy", "both".
 *
 * The account is NEVER split or downgraded. A buyer who starts selling keeps
 * every order, message and saved item, and a seller who chooses to shop is
 * still a seller — the choice only records how the person wants the app to
 * open. `accountType` carries that intent; `userRole` is escalated to `seller`
 * when they choose to sell and is never lowered here.
 *
 * `admin` and `reseller` are never settable from a client: a role in the VPS
 * store is what the admin gates trust, so accepting it from a phone would be a
 * privilege-escalation hole.
 */

const ACCOUNT_TYPES = new Set(['buyer', 'seller', 'both']);

export async function POST(request: Request) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { accountType?: string };
  const accountType = String(body.accountType ?? '');
  if (!ACCOUNT_TYPES.has(accountType)) {
    return NextResponse.json({ error: 'Choose whether you want to buy, sell, or both.' }, { status: 400 });
  }

  const wantsToSell = accountType === 'seller' || accountType === 'both';
  const now = new Date().toISOString();

  // Read the current role first: an existing seller/reseller/admin must not be
  // demoted by a mode change, and the VPS copy is authoritative when Firestore
  // has no answer.
  let currentRole = '';
  try {
    const snap = await db.collection('userProfiles').doc(user.uid).get();
    const data = (snap.data() ?? {}) as Record<string, unknown>;
    currentRole = String(data.userRole ?? data.role ?? '');
  } catch (error) {
    console.error('[mobile/seller/role] Firestore read failed:', error);
  }
  if (!currentRole) {
    const mirrored = await pbGetProfile(user.uid);
    currentRole = mirrored?.userRole ?? '';
  }

  const elevated = ['seller', 'reseller', 'admin'].includes(currentRole);
  const role = wantsToSell || elevated ? currentRole || 'seller' : 'buyer';

  let saved = false;
  try {
    await db
      .collection('userProfiles')
      .doc(user.uid)
      .set(
        {
          accountType,
          userRole: role,
          role,
          sellerEnabledAt: wantsToSell ? now : undefined,
          updatedAt: now,
        },
        { merge: true },
      );
    saved = true;
  } catch (error) {
    console.error('[mobile/seller/role] Firestore write failed:', error);
  }

  const mirrored = await pbUpsertProfile(user.uid, {
    userRole: role,
    status: 'active',
  });

  if (!saved && !mirrored) {
    return NextResponse.json(
      { error: 'Could not update your account. Check your connection and try again.' },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, accountType, role, canSell: role !== 'buyer' });
}
