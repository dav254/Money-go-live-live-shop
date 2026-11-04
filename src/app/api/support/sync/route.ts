/**
 * POST /api/support/sync { id } — mirror one support ticket to the VPS store.
 *
 * Fired (best-effort) by the two screens that write `supportTickets`: the
 * reseller contact form right after creating a ticket, and the admin tickets
 * page after every status transition. Firestore stays the primary write
 * target; this route is only the mirror relay.
 *
 * Two properties make this safe to expose (same contract as /api/users/sync):
 *
 *   1. The caller must be verified FIRST, and may only mirror their own
 *      ticket — naming someone else's requires admin. The gate runs before
 *      the body is read.
 *   2. The payload carries only the document id: the server reads the
 *      authoritative Firestore document itself, so a tampered request cannot
 *      push forged content into the VPS store.
 *
 * Mirror failures never fail the caller's real write: the response is 200
 * once the request is well formed, with `mirrored: false` when the VPS write
 * did not happen.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyRequestUser } from '@/lib/media/api-auth';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import { pbMirrorSupportTicket } from '@/lib/pocketbase/logs';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Auth gates BEFORE the body is read (admin-authz sweep asserts this).
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const adminUid = await verifyAdminUid(request);

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  const id = (body.id ?? '').toString();
  if (!id || id.length > 128 || id.includes('/')) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const snap = await db
    .collection('supportTickets')
    .doc(id)
    .get()
    .catch(() => null);
  if (!snap || !snap.exists) {
    return NextResponse.json({ mirrored: false, reason: 'missing' });
  }

  const data = snap.data() ?? {};
  const ownerId = typeof data.userId === 'string' ? data.userId : '';
  if (ownerId !== user.uid && !adminUid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const mirrored = await pbMirrorSupportTicket(id, data as Record<string, unknown>);
  return NextResponse.json({ ok: true, mirrored });
}
