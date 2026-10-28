import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { pbIsAdmin } from '@/lib/pocketbase/admins';
import { pbGetProfile } from '@/lib/pocketbase/profiles';

/**
 * PUT /api/admin/users/{uid} — { status: 'active' | 'suspended' }
 *
 * Moderation action behind the Seller & Buyer Issues console: when a report
 * targets a user, the admin can suspend that account from the same dropdown
 * they resolve the report with. Guards:
 *
 *  • verified admin token, checked against `userProfiles/{uid}.userRole`;
 *  • an admin cannot suspend themselves (lockout protection);
 *  • an admin cannot suspend another admin (moderation is not a weapon).
 *
 * Admin SDK throughout, so the deployed client rules are irrelevant here.
 */

const VALID_STATUSES = ['active', 'suspended'];

async function requireAdmin(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const { uid } = await auth.verifyIdToken(authHeader.split('Bearer ')[1]);
    // VPS stores first (works when Firestore is blocked), Firestore second.
    if ((await pbIsAdmin(uid)) === true) return uid;
    if ((await pbGetProfile(uid))?.userRole === 'admin') return uid;
    const profile = await db.collection('userProfiles').doc(uid).get().catch(() => null);
    if (profile?.data()?.userRole === 'admin') return uid;
    return null;
  } catch {
    return null;
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  const adminUid = await requireAdmin(request);
  if (!adminUid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { uid } = await params;
  if (!uid) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });

  const { status } = (await request.json().catch(() => ({}))) as { status?: string };
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status provided' }, { status: 400 });
  }

  if (uid === adminUid) {
    return NextResponse.json({ error: 'You cannot suspend your own account.' }, { status: 400 });
  }

  try {
    const targetRef = db.collection('userProfiles').doc(uid);
    const snap = await targetRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (snap.data()?.userRole === 'admin') {
      return NextResponse.json({ error: 'Admin accounts cannot be suspended from here.' }, { status: 400 });
    }

    await targetRef.update({ status });
    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error(`Error updating user ${uid} status:`, error);
    return NextResponse.json({ error: 'Could not update the account' }, { status: 500 });
  }
}
