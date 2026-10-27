import { NextRequest, NextResponse } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { deleteMessage, MessagingUnavailableError } from '@/lib/chat/store';

export const runtime = 'nodejs';

/**
 * DELETE /api/chat/[chatId]/messages/[messageId] — remove one message.
 *
 * Only its own sender may delete it (the store re-reads the record and checks
 * `senderId === uid`), and the message must belong to the conversation in the
 * path. A probe against somebody else's id answers 404 like a missing one.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string; messageId: string }> },
) {
  const user = await verifyUserContext(req);
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { chatId, messageId } = await params;
  if (!chatId || chatId.length > 128 || !messageId || messageId.length > 128) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const ok = await deleteMessage(chatId, messageId, user.uid);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof MessagingUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('[chat] delete failed:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Could not delete that message.' }, { status: 500 });
  }
}
