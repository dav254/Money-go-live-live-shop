import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { normaliseReferralCode, referralCodeFor } from '@/lib/referrals/referral-code';
import { ensureReferralCode, resolveReferralCode } from '@/lib/referrals/ensure-code';

/**
 * REFERRAL CAPTURE — `POST /api/referrals/claim`.
 *
 * Called once, by the signup page, immediately after an account is created.
 * It writes the `referrals` document that the whole rewards system reads.
 *
 * ## Why this is a server route and not a client write
 *
 * A client can create a `referrals` document (the rules allow a signed-in user
 * to create their own row), so this is not about permission — it is about
 * *trust*. Anything a browser sends is a suggestion: a user could call the
 * claim endpoint repeatedly, or hand-edit the body. Two things stop that here:
 *
 *  1. the code is resolved to a referrer by looking it up server-side against
 *     every profile, so the client cannot simply declare "I was referred by
 *     this uid";
 *  2. the document id is derived from the pair (referrer + referee), so a
 *     replayed claim overwrites the same row instead of minting new ones.
 *
 * The signup it creates is `pending`, which earns nothing. Points are only
 * credited when an admin approves it, so the worst a hostile caller can do is
 * create rows an admin can see and reject.
 */

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  let uid: string;
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const decoded = await auth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  let body: { code?: string; name?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const code = normaliseReferralCode(String(body?.code || ''));
  if (!code) return NextResponse.json({ recorded: false, reason: 'no-code' });

  /*
   * Self-referral, checked against BOTH codes the user can legitimately hold:
   * the legacy six-character token and their own name slug. Comparing
   * case-sensitively across the two forms is the trap here — `normaliseReferral
   * Code` lowercases, `referralCodeFor` does not — so a naive equality test
   * silently stops matching and lets someone credit themselves.
   */
  const inviteeProfile = await db
    .collection('userProfiles')
    .doc(uid)
    .get()
    .then((snap) => snap.data() as { referralSlug?: string } | undefined)
    .catch(() => undefined);

  const ownCodes = new Set(
    [referralCodeFor(uid), inviteeProfile?.referralSlug || '']
      .map((c) => normaliseReferralCode(c))
      .filter(Boolean),
  );
  if (ownCodes.has(code)) {
    return NextResponse.json({ recorded: false, reason: 'self-referral' });
  }

  try {
    // Resolve the code to a real referrer. This is the part a client cannot be
    // trusted with: the uid is never taken from the request body.
    //
    // A point read against `referralCodes/{code}` rather than a scan of every
    // profile. The earlier version read the whole `userProfiles` collection on
    // every signup carrying a `?ref=`, which is O(users) and slows signup
    // exactly as the marketplace grows. `ensureReferralCode` keeps the
    // directory populated; `resolveReferralCode` is the lookup.
    const referrerId = await resolveReferralCode(code);

    if (!referrerId) {
      return NextResponse.json({ recorded: false, reason: 'unknown-code' });
    }
    if (referrerId === uid) {
      return NextResponse.json({ recorded: false, reason: 'self-referral' });
    }

    const refereeSnap = await db.collection('userProfiles').doc(uid).get();
    const referee = (refereeSnap.data() || {}) as { fullName?: string; email?: string };

    // Deterministic id: the same pair always resolves to the same document, so
    // a replayed claim is idempotent instead of duplicating a referral.
    const docId = `${referrerId}_${uid}`;
    const ref = db.collection('referrals').doc(docId);
    const existing = await ref.get();

    if (existing.exists) {
      return NextResponse.json({ recorded: true, alreadyClaimed: true });
    }

    await ref.set({
      id: docId,
      referrerId,
      refereeId: uid,
      code,
      status: 'pending',
      refereeName: referee.fullName || body?.name || '',
      refereeEmail: referee.email || body?.email || '',
      createdAt: FieldValue.serverTimestamp(),
    });

    // Record the link on the invitee's profile so the admin surface and any
    // future "who referred me" question have one place to look. Indexing the
    // invitee's own code here means a brand-new user can immediately refer
    // someone else without waiting for a backfill.
    await db.collection('userProfiles').doc(uid).set(
      { referredBy: referrerId, referralCode: code },
      { merge: true },
    );
    // Mint the invitee's own name slug now, so they can refer someone else
    // immediately without waiting for a backfill.
    await ensureReferralCode(uid, body?.name || '');

    return NextResponse.json({ recorded: true });
  } catch (err) {
    console.error('[referrals] claim failed', err);
    return NextResponse.json({ error: 'Could not record referral' }, { status: 500 });
  }
}
