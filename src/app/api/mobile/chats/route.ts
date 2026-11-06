import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/firebase/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { listChats, MessagingUnavailableError } from '@/lib/chat/store';
import { projectSeller, toIso, type PublicSeller } from '@/lib/mobile/public-listing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/mobile/chats — the signed-in account's conversations, with the other
 * person already resolved.
 *
 * `/api/chat` returns the raw conversation documents: participant ids, the last
 * message and unread counters. That is enough for a browser, which already has
 * every profile it needs cached. A phone does not, and making it issue one
 * profile read per row would be an N+1 over the network on the most-visited
 * screen in the app.
 *
 * So this route does the join once, server-side, and returns a four-field
 * public card next to each conversation. The uid still comes only from the
 * verified token; `listChats(uid)` filters by it, so one account cannot read
 * another's inbox.
 */
export async function GET(request: NextRequest) {
  const ctx = await verifyUserContext(request);
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  try {
    const chats = await listChats(ctx.uid);

    const others = Array.from(
      new Set(
        chats
          .flatMap((chat) => chat.participantIds ?? [])
          .filter((id): id is string => typeof id === 'string' && id !== ctx.uid),
      ),
    ).slice(0, 60);

    const people = new Map<string, PublicSeller>();
    await Promise.all(
      others.map(async (uid) => {
        const snap = await db.collection('userProfiles').doc(uid).get().catch(() => null);
        people.set(uid, projectSeller(uid, (snap?.data() ?? null) as Record<string, unknown> | null));
      }),
    );

    return NextResponse.json({
      chats: chats.map((chat) => {
        const otherId = (chat.participantIds ?? []).find((id) => id !== ctx.uid) ?? null;
        return {
          id: chat.id,
          lastMessage: chat.lastMessage ?? null,
          lastMessageAt: toIso(chat.lastMessageTimestamp),
          unread: Number(chat.unreadCounts?.[ctx.uid] ?? 0) || 0,
          other: otherId ? people.get(otherId) ?? { id: otherId } : null,
        };
      }),
    });
  } catch (error) {
    if (error instanceof MessagingUnavailableError) {
      // The messaging store is intentionally optional on this deployment; say
      // so plainly instead of showing an empty inbox that looks like no chats.
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('[mobile/chats] list failed');
    return NextResponse.json({ error: 'Could not load your conversations.' }, { status: 500 });
  }
}
