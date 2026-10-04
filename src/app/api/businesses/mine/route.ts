import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { db } from '@/firebase/server';
import { memberRole, type Business } from '@/lib/business/types';

/**
 * THE BUSINESSES THIS LOGIN RUNS.
 *
 * ## Why this needs a server route at all
 *
 * `members` is an inline array of objects, which is what makes a permission
 * check a single document read — but Firestore cannot query *inside* an array
 * of objects. There is no `members.uid array-contains` clause. So the client
 * genuinely cannot ask "my businesses" on its own, and pretending otherwise
 * with a client-side filter would mean downloading every business in the
 * platform to find the one or two the caller owns.
 *
 * A membership collection would fix the query and cost a read on every
 * authorisation, so the honest tradeoff is: scan the small `businesses`
 * collection on the server, where it is one query nobody else pays for.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    uid = decoded.uid || '';
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const snap = await db.collection('businesses').get();
    const mine = snap.docs
      .map((d) => ({ ...(d.data() as Partial<Business>), id: d.id }))
      .filter((b) => (b.ownerId === uid) || (Array.isArray(b.members) && b.members.some((m) => m?.uid === uid)))
      .map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        kind: b.kind,
        type: b.type,
        verificationStatus: b.verificationStatus ?? null,
        role: b.ownerId === uid ? 'owner' : memberRole(b.members, uid),
        primaryLocation: b.primaryLocation ?? null,
      }));

    return NextResponse.json({ businesses: mine });
  } catch (error) {
    console.error('[business] mine failed', error);
    return NextResponse.json({ error: 'Could not load your businesses' }, { status: 500 });
  }
}
