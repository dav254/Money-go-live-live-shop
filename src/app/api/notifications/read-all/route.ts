import { NextRequest, NextResponse } from 'next/server';
import { verifyUserUid } from '@/lib/notifications/server-utils';
import { markAllRead } from '@/lib/notifications/store';

export const runtime = 'nodejs';

/**
 * POST /api/notifications/read-all — "mark all as read" for the caller only.
 * The store's ownership filter scopes the update to the verified uid.
 */
export async function POST(req: NextRequest) {
  const uid = await verifyUserUid(req);
  if (!uid) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  try {
    const updated = await markAllRead(uid);
    return NextResponse.json({ ok: true, updated, unread: 0 });
  } catch (err) {
    console.error('[notifications] mark-all failed:', err);
    return NextResponse.json({ error: 'Could not update notifications' }, { status: 500 });
  }
}