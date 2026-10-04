import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { reconcileListingBonus } from '@/lib/listings/bonus';

/**
 * VIEW & LIKE BONUSES — paying the seller who got seen.
 *
 * ## What this does
 *
 * A listing that passes 100 views and 5 likes earns 50 points; 500/25 earns
 * 150; up to 50,000/1,000 earns 3,000. Until this existed the ladder was
 * arithmetic nobody was paid for.
 *
 * ## Why it is server-side and transactional
 *
 * Points are money-adjacent, so two rules are non-negotiable:
 *
 *   1. The views and likes are read from the listing document, never from the
 *      request body. A client that could POST `{"views": 999999}` would mint
 *      points out of nothing.
 *   2. The read and the write happen in one transaction. Without it, two
 *      concurrent checks both see "not yet paid" and both pay — and a seller
 *      refreshing their dashboard on two devices would be paid twice for the
 *      same milestone.
 *
 * ## Why it pays the DELTA, not the total
 *
 * The listing stores `bonusPointsPaid`. A listing that jumps straight past
 * three tiers gets the sum of all three, once. A later call re-derives the
 * same total, sees it is already paid, and writes nothing. So this route is
 * safe to call as often as you like — from the seller's dashboard, from a
 * cron, from both.
 */

export const dynamic = 'force-dynamic';

async function caller(request: Request): Promise<{ uid: string; isAdmin: boolean } | null> {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid || '';
    if (!uid) return null;
    // Admin claims arrive on the ID token; a seller cannot mint one.
    const admin = decoded.admin === true || decoded.admin === 'true';
    return { uid, isAdmin: admin };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const me = await caller(request);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { listingId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const listingId = String(body?.listingId || '');
  if (!listingId) return NextResponse.json({ error: 'listingId is required' }, { status: 400 });

  try {
    // The transaction lives in `lib/listings/bonus` so the route and the
    // verification script run the SAME code — a test of a copy of the logic
    // proves nothing about the code that actually pays.
    const result = await reconcileListingBonus(listingId, me.uid, { isAdmin: me.isAdmin });

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[bonus] claim failed', error);
    return NextResponse.json({ error: 'Could not apply the bonus' }, { status: 500 });
  }
}
