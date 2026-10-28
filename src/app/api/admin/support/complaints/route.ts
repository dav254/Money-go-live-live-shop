import { NextRequest, NextResponse } from 'next/server';
import type { Query } from 'firebase-admin/firestore';
import { db, auth } from '@/firebase/server';
import { pbIsAdmin } from '@/lib/pocketbase/admins';
import { pbGetProfile } from '@/lib/pocketbase/profiles';
import { isAdminByEnv } from '@/lib/server/admin-env';

/**
 * GET /api/admin/support/complaints[?targetType=user&status=open]
 *
 * Complaints have always been WRITTEN through the Admin SDK (see
 * `app/actions/complaint-actions.ts`), so the moderation console never
 * actually depended on the client rules — until it tried to LIST, where the
 * rules deployed to the live project denied it and every complaints page
 * showed a permission error. Reading through the Admin SDK here makes the
 * console independent of deployed rules entirely, which is also the right
 * shape for a moderation surface: the action is privileged by definition,
 * and the privilege check lives in one server place.
 *
 * Filters are equality-only and the sort happens in JS on purpose: a
 * `where` + `orderBy` combination would require a composite index that the
 * project does not necessarily have, which would fail at runtime with
 * `failed precondition`.
 */

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid: string;
  let email: string | null = null;
  try {
    const decoded = await auth.verifyIdToken(authHeader.split('Bearer ')[1]);
    uid = decoded.uid;
    email = decoded.email ?? null;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Env allowlist first (no database), then VPS stores, then Firestore.
  const isAdmin =
    isAdminByEnv(uid, email) ||
    (await pbIsAdmin(uid)) === true ||
    (await pbGetProfile(uid))?.userRole === 'admin' ||
    (await db
      .collection('userProfiles')
      .doc(uid)
      .get()
      .then((p) => p.data()?.userRole === 'admin')
      .catch(() => false));
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const targetType = searchParams.get('targetType');
  const status = searchParams.get('status');

  try {
    let ref: Query = db.collection('complaints').limit(200);
    if (targetType) ref = ref.where('targetType', '==', targetType);
    if (status) ref = ref.where('status', '==', status);

    const snap = await ref.get();

    const complaints = snap.docs
      .map((d) => {
        const data = d.data();
        const createdAt = data.createdAt?.toDate?.();
        const resolvedAt = data.resolvedAt?.toDate?.();
        return {
          ...data,
          id: d.id,
          createdAt: createdAt ? createdAt.toISOString() : null,
          resolvedAt: resolvedAt ? resolvedAt.toISOString() : null,
        };
      })
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

    return NextResponse.json(complaints);
  } catch (error) {
    console.error('Error listing complaints:', error);
    return NextResponse.json({ error: 'Could not load complaints' }, { status: 500 });
  }
}
