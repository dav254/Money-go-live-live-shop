import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import type { UserProfile } from '@/lib/types';
import { pbIsAdmin } from '@/lib/pocketbase/admins';
import { pbGetProfile } from '@/lib/pocketbase/profiles';

/**
 * PUT /api/admin/users/{uid}/role — change a user's role.
 *
 * The client-side roles screen writes through the security rules, but the two
 * guarantees that matter for ADMIN ACCESS cannot live in rules at all: you
 * must not be able to demote your own account (one careless click and the
 * platform has an owner who locked themselves out), and you must not be able
 * to leave the platform with zero admins. Both need to READ other documents
 * and COUNT, which rules cannot do — so both checks run here, inside one
 * transaction, using the Admin SDK.
 *
 * Caller must be an authenticated admin; the target's uid comes from the
 * path, never from the body.
 */

const VALID_ROLES = ['buyer', 'seller', 'reseller', 'admin'] as const;
type Role = (typeof VALID_ROLES)[number];

/** Carries an HTTP status out of the transaction so the catch can map it. */
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  const { uid } = await params;
  if (!uid) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
  }

  let callerUid: string;
  try {
    callerUid = (await auth.verifyIdToken(authHeader.split('Bearer ')[1])).uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
  }

  // VPS stores first (works when Firestore is blocked), Firestore second.
  const isAdmin =
    (await pbIsAdmin(callerUid)) === true ||
    (await pbGetProfile(callerUid))?.userRole === 'admin' ||
    (await db
      .collection('userProfiles')
      .doc(callerUid)
      .get()
      .then((p) => p.data()?.userRole === 'admin')
      .catch(() => false));
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden: User is not an admin' }, { status: 403 });
  }

  const { role } = (await request.json().catch(() => ({}))) as { role?: string };
  if (!role || !(VALID_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: 'Invalid role provided' }, { status: 400 });
  }
  const targetRole = role as Role;

  // The caller can never change their own role here — this is what makes
  // "promote a helper" safe to do without also being "demote yourself".
  if (uid === callerUid) {
    return NextResponse.json(
      { error: 'You cannot change your own role. Ask another admin to do it.' },
      { status: 400 },
    );
  }

  try {
    const targetRef = db.collection('userProfiles').doc(uid);

    await db.runTransaction(async (tx) => {
      const targetSnap = await tx.get(targetRef);
      if (!targetSnap.exists) {
        throw new HttpError(404, 'User not found');
      }
      const target = targetSnap.data() as UserProfile;
      const currentRole = (target.userRole || target.role) as Role | undefined;
      if (currentRole === targetRole) return; // already in place — nothing to do

      // Demoting an admin must never empty the admins' seat.
      if (currentRole === 'admin' && targetRole !== 'admin') {
        const adminsSnap = await tx.get(
          db.collection('userProfiles').where('userRole', '==', 'admin'),
        );
        const remaining = adminsSnap.docs.filter((d) => d.id !== uid).length;
        if (remaining === 0) {
          throw new HttpError(
            400,
            'This is the last admin account. Promote another admin before demoting this one.',
          );
        }
      }

      const update: Record<string, unknown> = { userRole: targetRole };
      // Older profiles carry a legacy `role` field that parts of the app still
      // read (`userRole || role`); keep the two in step when it exists.
      if (target.role) update.role = targetRole;
      tx.update(targetRef, update);
    });

    return NextResponse.json({ success: true, role: targetRole });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) {
      console.error(`Error changing role for ${uid}:`, error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
