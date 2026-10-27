import { NextRequest, NextResponse } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import {
  appendMessage,
  isChatParticipant,
  listMessages,
  MessagingUnavailableError,
} from '@/lib/chat/store';
import { MAX_REQUEST_BYTES, validateMessageInput } from '@/lib/chat/validate';

export const runtime = 'nodejs';

/**
 * GET  /api/chat/[chatId]/messages — the thread, oldest → newest.
 * POST /api/chat/[chatId]/messages — send one message.
 *
 * Everything about a message is decided on this server: the sender comes from
 * the verified ID token, the payload is validated (type, size, and that any
 * attachment is a file THIS server stored in this very conversation's folder),
 * and the inbox preview is derived here rather than trusted from the client.
 *
 * The client's `clientMsgId` becomes the record id, so a retried send
 * collides with itself and returns the message that already landed instead of
 * posting it twice.
 */
async function authorize(req: NextRequest, chatId: string) {
  const user = await verifyUserContext(req);
  if (!user) return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) };
  if (!chatId || chatId.length > 128) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  return { user };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const { chatId } = await params;
  const auth = await authorize(req, chatId);
  if ('error' in auth) return auth.error;
  const { user } = auth;

  try {
    // Membership is checked BEFORE anything is read: a non-participant must
    // learn nothing, not even that the id exists.
    if (!user.isAdmin && !(await isChatParticipant(chatId, user.uid))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const url = new URL(req.url);
    const raw = Number(url.searchParams.get('limit'));
    const limit = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 200;
    const messages = await listMessages(chatId, limit);
    return NextResponse.json({ messages });
  } catch (err) {
    if (err instanceof MessagingUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('[chat] message list failed:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Could not load messages.' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const { chatId } = await params;
  const auth = await authorize(req, chatId);
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const length = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(length) && length > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Message too large.' }, { status: 413 });
  }

  const body = await req.json().catch(() => null);
  const validated = validateMessageInput(body, { chatId, senderId: user.uid });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const { message, duplicate } = await appendMessage(
      chatId,
      user.uid,
      validated.value,
      validated.preview,
    );
    return NextResponse.json({ message, duplicate }, { status: duplicate ? 200 : 201 });
  } catch (err) {
    if (err instanceof MessagingUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const text = err instanceof Error ? err.message : '';
    if (text.includes('not part of this conversation')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (text.includes('Conversation not found')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('[chat] send failed:', text || 'unknown');
    return NextResponse.json({ error: 'Message not sent.' }, { status: 500 });
  }
}
