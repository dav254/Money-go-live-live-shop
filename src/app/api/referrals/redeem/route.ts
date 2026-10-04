import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import {
  LIVE_STREAM_UNLOCK_COST, MIN_SIGNUPS_FOR_PAYOUT, formatPoints,
} from '@/lib/referrals/rewards';

/**
 * SPEND REFERRAL POINTS — `POST /api/referrals/redeem`.
 *
 * Two things a user can actually buy with what they earned:
 *
 *   `live`  unlock one hour of live streaming
 *   `cash`  request a voucher/cash payout
 *
 * ## Why this runs server-side and behind a transaction
 *
 * The balance is real money, and a client-side decrement is a race: two taps
 * spend the same points twice. So the read, the check and the write happen
 * inside a Firestore transaction, which retries on contention and fails
 * loudly rather than letting the balance go negative.
 *
 * A payout additionally requires confirmed signups. Points can be granted by
 * an admin without any referrals, so a balance alone must not be enough to
 * withdraw — otherwise one mistaken grant becomes a cash liability.
 *
 * ## Nothing is paid automatically
 *
 * A cash request writes a `payouts` document and returns. It does NOT move
 * money. The rules make `payouts.update` admin-only, so the queue can only be
 * actioned by a human — a referral balance can never become a silent
 * automated payment.
 */

const REDEEMS = ['live', 'cash'] as const;
type Redeem = (typeof REDEEMS)[number];

function isRedeem(value: unknown): value is Redeem {
  return typeof value === 'string' && (REDEEMS as readonly string[]).includes(value);
}

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

  let body: { redeem?: unknown; amount?: unknown; method?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const redeem = body?.redeem;
  if (!isRedeem(redeem)) {
    return NextResponse.json({ error: 'Unknown redemption' }, { status: 400 });
  }

  const profileRef = db.collection('userProfiles').doc(uid);

  try {
    if (redeem === 'live') {
      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(profileRef);
        const balance = Number(snap.data()?.referralPoints) || 0;

        if (balance < LIVE_STREAM_UNLOCK_COST) {
          return { ok: false as const, balance, shortfall: LIVE_STREAM_UNLOCK_COST - balance };
        }

        tx.update(profileRef, {
          referralPoints: FieldValue.increment(-LIVE_STREAM_UNLOCK_COST),
          liveUnlockedUntil: FieldValue.serverTimestamp(),
        });

        // Recorded so the ledger can be audited: which unlock was bought, by
        // whom, and for what. Without it the balance is unexplainable.
        tx.set(db.collection('referralRedemptions').doc(), {
          userId: uid,
          kind: 'live',
          points: LIVE_STREAM_UNLOCK_COST,
          at: FieldValue.serverTimestamp(),
        });

        return { ok: true as const, balance: balance - LIVE_STREAM_UNLOCK_COST };
      });

      if (!result.ok) {
        return NextResponse.json(
          {
            error: 'Not enough points',
            balance: result.balance,
            needed: LIVE_STREAM_UNLOCK_COST,
            shortfall: result.shortfall,
          },
          { status: 400 },
        );
      }

      return NextResponse.json({ ok: true, kind: 'live', balance: result.balance });
    }

    // ---- cash / voucher -------------------------------------------------
    const approved = await db
      .collection('referrals')
      .where('referrerId', '==', uid)
      .where('status', '==', 'approved')
      .get();

    if (approved.size < MIN_SIGNUPS_FOR_PAYOUT) {
      return NextResponse.json(
        {
          error: 'Not eligible yet',
          approved: approved.size,
          needed: MIN_SIGNUPS_FOR_PAYOUT,
        },
        { status: 400 },
      );
    }

    // Payout is quoted in points; an admin decides the cash value when they
    // action the queue entry. Keeping the two separate stops the balance from
    // being read as a currency with a rate we would then have to hold to.
    const requested = Math.floor(Number(body?.amount) || 0);
    if (requested <= 0) {
      return NextResponse.json({ error: 'Enter how many points to redeem' }, { status: 400 });
    }

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(profileRef);
      const balance = Number(snap.data()?.referralPoints) || 0;

      if (balance < requested) {
        return { ok: false as const, balance };
      }

      tx.update(profileRef, {
        referralPoints: FieldValue.increment(-requested),
      });
      tx.set(db.collection('referralRedemptions').doc(), {
        userId: uid,
        kind: 'cash',
        points: requested,
        method: typeof body?.method === 'string' ? body.method.slice(0, 40) : 'unspecified',
        // Queued, not paid. Only an admin can move this to 'paid'.
        status: 'pending',
        at: FieldValue.serverTimestamp(),
      });

      return { ok: true as const, balance: balance - requested };
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: 'Not enough points', balance: result.balance },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      kind: 'cash',
      balance: result.balance,
      message: `${formatPoints(requested)} points queued for payout.`,
    });
  } catch (err) {
    console.error('[referrals] redeem failed', err);
    return NextResponse.json({ error: 'Could not complete that redemption' }, { status: 500 });
  }
}
