import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '@/firebase/server';
import {
  BONUS_OPTIONS,
  COUNTED_ORDER_STATUSES,
  isKnownBonus,
  tierForCompletedTransactions,
  tierProgress,
  type AccountTier,
} from '@/lib/tiers';
import { isAdminUid } from '@/lib/server/admin-guard';
import { pbListAllOrders } from '@/lib/pocketbase/orders';

/**
 * ADMIN VIEW OF TIERS — and the bonus queue.
 *
 * ## The admin does NOT set tiers
 *
 * That is the whole design. If an admin could type `gold` onto an account, the
 * badge would stop being evidence and become a favour, and buyers would be
 * right to distrust it. This route computes each account's tier from its own
 * delivered orders and shows the admin the result.
 *
 * What the admin CAN do is add a bonus on top — a credit, a promotion, a
 * discount — recorded separately with a reason. That is an act, not a rank, and
 * it shows in the account's history rather than on the badge.
 *
 * ## Every write is attributed
 *
 * `grantedBy` and `reason` are required. A bonus nobody can trace is a bonus
 * nobody can appeal.
 */

export const dynamic = 'force-dynamic';

async function readAdmin(request: Request): Promise<string | null> {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    const uid = (await getAuth().verifyIdToken(token)).uid || null;
    return (await isAdminUid(uid)) ? uid : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const admin = await readAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    /*
     * Order counts per party, VPS store first — the tier sweep is an admin
     * job that used to need a full Firestore collection scan.
     */
    const counts = new Map<string, { sold: number; bought: number }>();
    const tally = (o: { sellerId?: string; buyerId?: string; orderStatus?: string }) => {
      if (!COUNTED_ORDER_STATUSES.includes(o.orderStatus as (typeof COUNTED_ORDER_STATUSES)[number])) return;
      const seller = counts.get(o.sellerId ?? '') ?? { sold: 0, bought: 0 };
      seller.sold += 1;
      counts.set(o.sellerId ?? '', seller);
      const buyer = counts.get(o.buyerId ?? '') ?? { sold: 0, bought: 0 };
      buyer.bought += 1;
      counts.set(o.buyerId ?? '', buyer);
    };

    const mirroredOrders = await pbListAllOrders(2000);
    if (mirroredOrders) {
      for (const o of mirroredOrders) tally(o.data as { sellerId?: string; buyerId?: string; orderStatus?: string });
    } else {
      const orders = await db.collection('orders').get();
      for (const d of orders.docs) tally(d.data() as { sellerId?: string; buyerId?: string; orderStatus?: string });
    }

    const profiles = await db.collection('userProfiles').get();
    const rows = profiles.docs.map((d) => {
      const p = d.data() as any;
      const c = counts.get(d.id) ?? { sold: 0, bought: 0 };
      const completed = c.sold + c.bought;
      const stored = (p.accountTier ?? 'none') as AccountTier;
      const earned = tierForCompletedTransactions(completed);
      const bonuses = Array.isArray(p.accountBonuses) ? p.accountBonuses : [];
      return {
        uid: d.id,
        name: p.fullName || p.username || 'Unknown',
        email: p.email || '',
        sold: c.sold,
        bought: c.bought,
        completed,
        storedTier: stored,
        earnedTier: earned,
        /** True when the document's badge disagrees with the arithmetic. */
        outOfDate: stored !== earned && earned !== 'none',
        progress: tierProgress(completed),
        bonusCount: bonuses.length,
        /** Most recent first, capped — enough to answer "what did we give them?" */
        bonuses: bonuses.slice(-5).reverse(),
      };
    });

    rows.sort((a, b) => b.completed - a.completed);

    const byTier: Record<string, number> = {};
    for (const r of rows) byTier[r.earnedTier] = (byTier[r.earnedTier] ?? 0) + 1;

    return NextResponse.json({
      total: rows.length,
      byTier,
      belowGold: rows.filter((r) => r.earnedTier !== 'gold' && r.earnedTier !== 'premium').length,
      outOfDate: rows.filter((r) => r.outOfDate).length,
      rows,
    });
  } catch (error) {
    console.error('[admin/tiers] list failed', error);
    return NextResponse.json({ error: 'Could not load tiers' }, { status: 500 });
  }
}

/**
 * Grant a bonus on top of an earned tier.
 *
 * Note what this cannot do: set the tier. There is no `tier` in the body, and
 * adding one would be the single change that turns this feature from evidence
 * into decoration.
 */
export async function POST(request: Request) {
  const admin = await readAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { uid?: string; bonus?: string; amount?: number; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const uid = String(body?.uid || '');
  const bonus = String(body?.bonus || '').trim();
  const reason = String(body?.reason || '').trim();
  const amount = Number(body?.amount ?? 0);

  if (!uid) return NextResponse.json({ error: 'uid is required' }, { status: 400 });
  if (!bonus) return NextResponse.json({ error: 'Choose a bonus' }, { status: 400 });
  // Closed list, not free text: a bonus called "vip" tells the seller nothing.
  if (!isKnownBonus(bonus)) return NextResponse.json({ error: 'Unknown bonus type' }, { status: 400 });
  // A bonus with no reason is one nobody can appeal.
  if (!reason) return NextResponse.json({ error: 'Give a reason — the seller will see this' }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 422 });
  }

  const option = BONUS_OPTIONS.find((b) => b.key === bonus)!;

  try {
    await db.collection('userProfiles').doc(uid).set(
      {
        accountBonuses: FieldValue.arrayUnion({
          bonus,
          bonusLabel: option.label,
          kind: option.kind,
          amount,
          reason,
          grantedBy: admin,
          grantedAt: new Date().toISOString(),
        }),
      },
      { merge: true },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/tiers] grant failed', error);
    return NextResponse.json({ error: 'Could not record the bonus' }, { status: 500 });
  }
}
