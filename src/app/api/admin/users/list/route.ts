import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server';
import { pbListProfilesByRole } from '@/lib/pocketbase/profiles';

export const runtime = 'nodejs';

/**
 * GET /api/admin/users/list?role=buyer|seller|reseller
 *
 * Admin-only. Returns the Firestore uids for a role PLUS any profiles that
 * exist only in the local VPS (PocketBase) store — accounts whose Firestore
 * write failed at signup still have to be visible in the admin section.
 * The admin pages keep their live Firestore subscription and merge these
 * extras in (deduped by uid).
 */
export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const role = new URL(request.url).searchParams.get('role') ?? 'buyer';
  if (!['buyer', 'seller', 'reseller'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  let uids: string[] = [];
  try {
    const snap = await db
      .collection('userProfiles')
      .where('userRole', '==', role)
      .limit(1000)
      .get();
    uids = snap.docs.map((d) => d.id);
  } catch (error) {
    console.error('[admin/users/list] Firestore read failed:', error);
  }

  const pbProfiles = await pbListProfilesByRole(role);
  const extraProfiles = (pbProfiles ?? []).filter((p) => !uids.includes(p.uid));

  return NextResponse.json({ ok: true, uids, extraProfiles });
}
