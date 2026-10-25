import { NextRequest, NextResponse } from 'next/server';
import { verifyUserUid } from '@/lib/notifications/server-utils';
import { deletePushSubscriptions } from '@/lib/notifications/store';

export const runtime = 'nodejs';

/**
 * Revokes push for every device — `POST /api/notifications/push/revoke`.
 *
 * Every device goes, not just this one: the user's intent when they turn
 * notifications off is "stop sending to me", not "stop sending to the phone
 * in my hand". Preferences survive a revoke — the user only turned off
 * delivery, not their choices about which sections matter.
 *
 * The uid comes from the verified ID token, so one user can only revoke
 * their own subscriptions.
 */
export async function POST(req: NextRequest) {
  const uid = await verifyUserUid(req);
  if (!uid) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  try {
    const removed = await deletePushSubscriptions(uid);
    return NextResponse.json({ ok: true, removed });
  } catch (err) {
    console.error('[push] revoke failed:', err);
    return NextResponse.json({ error: 'Could not revoke' }, { status: 500 });
  }
}