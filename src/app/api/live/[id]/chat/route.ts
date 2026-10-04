import { NextResponse, type NextRequest } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getLiveStream } from '@/lib/live/service';
import { LIVESTREAMS_COLLECTION, type LiveChatMessage } from '@/lib/live/types';

export const runtime = 'nodejs';

const CHAT_SUBCOLLECTION = 'messages';

/**
 * Live chat (spec §26) — a subcollection of the stream:
 * liveStreams/{id}/messages/{msg}
 *
 * GET            → recent messages (newest last, capped)
 * POST { message } → send (text or single-grapheme reaction)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const snap = await db
    .collection(LIVESTREAMS_COLLECTION)
    .doc(id)
    .collection(CHAT_SUBCOLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(60)
    .get()
    .catch(() => null);

  const messages: LiveChatMessage[] = [];
  if (snap) {
    snap.forEach((d) => messages.push(d.data() as LiveChatMessage));
  }
  messages.reverse(); // oldest first for rendering
  return NextResponse.json({ messages });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const stream = await getLiveStream(id);
  if (!stream) return NextResponse.json({ error: 'Stream not found.' }, { status: 404 });
  if (stream.status !== 'LIVE' && stream.status !== 'STARTING') {
    return NextResponse.json({ error: 'Chat is closed.' }, { status: 410 });
  }

  const body = (await request.json().catch(() => ({}))) as { message?: string };
  const raw = (body.message ?? '').trim().slice(0, 300);
  if (!raw) return NextResponse.json({ error: 'Empty message.' }, { status: 400 });

  const isReaction = /^[\p{Extended_Pictographic}]$/u.test(raw);
  const isSeller = stream.sellerId === user.uid;

  const ref = db
    .collection(LIVESTREAMS_COLLECTION)
    .doc(id)
    .collection(CHAT_SUBCOLLECTION)
    .doc();

  const msg: LiveChatMessage = {
    id: ref.id,
    liveStreamId: id,
    userId: user.uid,
    userName: user.name || user.businessName || 'Viewer',
    kind: isReaction ? 'reaction' : 'text',
    message: raw,
    isSeller,
    createdAt: new Date(),
  };

  await ref.set(msg);
  await db
    .collection(LIVESTREAMS_COLLECTION)
    .doc(id)
    .update({ chatMessagesCount: FieldValue.increment(1) })
    .catch(() => undefined);

  return NextResponse.json({ message: msg });
}
