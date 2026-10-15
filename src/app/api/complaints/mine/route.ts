import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';

/**
 * GET /api/complaints/mine — the signed-in user's own reports, newest first.
 *
 * The deployed Firestore rules deny client `list` on `complaints` for everyone
 * (that is what broke the admin console), so buyers cannot subscribe to their
 * own reports either. This route exists so the buyer Customer Care screen can
 * show "what I filed and where it stands" without touching the rules:
 *
 *  • auth comes from the verified ID token — the caller's uid is never taken
 *    from a query parameter, so there is no way to read somebody else's rows;
 *  • equality-only query, no composite index required.
 */

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid: string;
  try {
    uid = (await auth.verifyIdToken(authHeader.split('Bearer ')[1])).uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const snap = await db
      .collection('complaints')
      .where('complainantId', '==', uid)
      .limit(50)
      .get();

    const mine = snap.docs
      .map((d) => {
        const data = d.data();
        const createdAt = data.createdAt?.toDate?.();
        return {
          ...data,
          id: d.id,
          createdAt: createdAt ? createdAt.toISOString() : null,
        };
      })
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

    return NextResponse.json(mine);
  } catch (error) {
    console.error('Error listing my complaints:', error);
    return NextResponse.json({ error: 'Could not load your reports' }, { status: 500 });
  }
}
