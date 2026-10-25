import { NextRequest, NextResponse } from 'next/server';
import { verifyUserUid } from '@/lib/notifications/server-utils';
import { deleteNotification, markRead } from '@/lib/notifications/store';

export const runtime = 'nodejs';

/**
 * PATCH /api/notifications/[id] — mark one notification read.
 * DELETE /api/notifications/[id] — dismiss it for good.
 *
 * The store re-reads the record and checks `userId === uid` before mutating,
 * so an id belonging to somebody else is reported exactly like a missing one
 * (404) — probing ids reveals nothing.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const uid = await verifyUserUid(req);
  if (!uid) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { id } = await params;
  if (!id || id.length > 128) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Body is optional: `{ isRead: true }` (default) marks read, `{ isRead:
  // false }` restores unread — the dashboard inbox offers both directions.
  const body = (await req.json().catch(() => null)) as { isRead?: unknown } | null;
  const isRead = typeof body?.isRead === 'boolean' ? body.isRead : true;

  try {
    const ok = await markRead(uid, id, isRead);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[notifications] mark-read failed:', err);
    return NextResponse.json({ error: 'Could not update notification' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const uid = await verifyUserUid(req);
  if (!uid) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { id } = await params;
  if (!id || id.length > 128) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const ok = await deleteNotification(uid, id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[notifications] delete failed:', err);
    return NextResponse.json({ error: 'Could not delete notification' }, { status: 500 });
  }
}