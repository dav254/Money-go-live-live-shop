import { NextRequest, NextResponse } from 'next/server';
import { verifyUserUid } from '@/lib/notifications/server-utils';
import { listNotifications, unreadCount } from '@/lib/notifications/store';

export const runtime = 'nodejs';

/**
 * GET /api/notifications — the signed-in user's own notifications.
 *
 * `?count=unread` returns just the badge number (cheap enough to poll from
 * every header). `?limit=50` bounds the inbox list. The uid always comes from
 * the verified Bearer token; the store filters every read by it, so one user
 * can never see another's notifications — there is no userId query parameter
 * to spoof in the first place.
 *
 * Live updates: clients poll this route (on an interval, on focus and on
 * visibility change) — a VPS-supported method with no extra infrastructure.
 */
export async function GET(req: NextRequest) {
  const uid = await verifyUserUid(req);
  if (!uid) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  try {
    const url = new URL(req.url);
    if (url.searchParams.get('count') === 'unread') {
      return NextResponse.json({ unread: await unreadCount(uid) });
    }
    const limitRaw = Number(url.searchParams.get('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 50;
    const result = await listNotifications(uid, limit);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[notifications] list failed:', err);
    return NextResponse.json({ error: 'Could not load notifications' }, { status: 500 });
  }
}