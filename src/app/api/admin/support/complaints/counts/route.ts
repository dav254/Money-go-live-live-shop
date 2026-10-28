import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { pbIsAdmin } from '@/lib/pocketbase/admins';
import { pbGetProfile } from '@/lib/pocketbase/profiles';
import { isAdminByEnv } from '@/lib/server/admin-env';

/**
 * GET /api/admin/support/complaints/counts
 *
 * Badge numbers for the admin sidebar. The sidebar used to hold three live
 * client listeners on `complaints`; the deployed rules deny client `list`
 * there, so every admin page was paying for permission-error toasts just to
 * render a badge. One Admin-SDK count query fixes it — badges do not need to
 * be real-time.
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

  try {
    // Equality-only query: no composite index required.
    const snap = await db
      .collection('complaints')
      .where('status', '==', 'open')
      .limit(1000)
      .get();

    let open = 0;
    let openProducts = 0;
    let openUsers = 0;
    snap.docs.forEach((d) => {
      open += 1;
      const targetType = d.data()?.targetType;
      if (targetType === 'product') openProducts += 1;
      else if (targetType === 'user') openUsers += 1;
    });

    return NextResponse.json({ open, openProducts, openUsers });
  } catch (error) {
    console.error('Error counting complaints:', error);
    return NextResponse.json({ error: 'Could not count complaints' }, { status: 500 });
  }
}
