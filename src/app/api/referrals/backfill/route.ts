import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { backfillReferralCodes } from '@/lib/referrals/ensure-code';

/**
 * Backfills the referral code directory — `POST /api/referrals/backfill`.
 *
 * Admin-only. Populates `referralCodes/{CODE}` for every existing profile so
 * code lookups are a point read rather than a scan of `userProfiles`.
 *
 * Safe to re-run: `ensureReferralCode` is an idempotent `set`, so a second
 * pass costs writes and changes nothing. That matters because a new code
 * algorithm would otherwise require anyone to reason about which users were
 * indexed under which scheme.
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

  // Admin check against the profile, mirroring the other admin routes.
  try {
    const profile = await db.collection('userProfiles').doc(uid).get();
    const role = profile.data()?.userRole ?? profile.data()?.role;
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }
  } catch (err) {
    console.error('[referrals] backfill auth failed', err);
    return NextResponse.json({ error: 'Could not verify admin' }, { status: 500 });
  }

  try {
    const result = await backfillReferralCodes();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[referrals] backfill failed', err);
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 });
  }
}
