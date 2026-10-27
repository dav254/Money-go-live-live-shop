import { NextRequest, NextResponse } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { hideOrRestore, markChatRead, MessagingUnavailableError } from '@/lib/chat/store';

export const runtime = 'nodejs';

/**
 * PATCH /api/chat/[chatId] — the three per-user conversation actions.
 *
 *   { action: 'read' }     clear MY unread badge and mark their messages read
 *   { action: 'hide' }     remove the conversation from MY inbox
 *   { action: 'restore' }  put it back (deep link / reopening it)
 *
 * The uid comes from the verified Bearer token and the store re-checks
 * membership, so a request can only ever change the caller's own view of a
 * conversation they are actually part of — and a hide made by one participant
 * can never be undone by another.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const user = await verifyUserContext(req);
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { chatId } = await params;
  if (!chatId || chatId.length > 128) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action;
  if (action !== 'read' && action !== 'hide' && action !== 'restore') {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }

  try {
    if (action === 'read') {
      const ok = await markChatRead(chatId, user.uid);
      if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ ok: true });
    }
    const chat = await hideOrRestore(chatId, user.uid, action);
    if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ chat });
  } catch (err) {
    if (err instanceof MessagingUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('[chat] update failed:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Could not update that conversation.' }, { status: 500 });
  }
}
