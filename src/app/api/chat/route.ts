import { NextRequest, NextResponse } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import {
  ensureConversation,
  listChats,
  MessagingUnavailableError,
} from '@/lib/chat/store';
import { isValidUid } from '@/lib/chat/validate';

export const runtime = 'nodejs';

/**
 * GET /api/chat — the signed-in user's conversations, newest first.
 *
 * `?scope=all` returns every conversation and is admin-only (the support
 * console). The uid always comes from the verified Bearer token: there is no
 * userId parameter to spoof, and the store filters by that uid.
 *
 * POST /api/chat — open (or reuse) the 1:1 conversation with `participantId`.
 * Idempotent, so every "Message seller" button can call it without racing.
 *
 * Clients poll GET on an interval / focus / visibility (the same live-update
 * method the notifications section uses) — no Firestore listener involved.
 */
export async function GET(req: NextRequest) {
  const ctx = await verifyUserContext(req);
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const url = new URL(req.url);
  const wantsAll = url.searchParams.get('scope') === 'all';
  if (wantsAll && !ctx.isAdmin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  try {
    const chats = await listChats(ctx.uid, { all: wantsAll });
    return NextResponse.json({ chats });
  } catch (err) {
    if (err instanceof MessagingUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('[chat] list failed:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Could not load your conversations.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await verifyUserContext(req);
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const length = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(length) && length > 16 * 1024) {
    return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
  }

  const body = (await req.json().catch(() => null)) as {
    participantId?: unknown;
    seedMessage?: unknown;
  } | null;
  const participantId = body?.participantId;
  if (!isValidUid(participantId)) {
    return NextResponse.json({ error: 'Invalid conversation.' }, { status: 400 });
  }
  if (participantId === ctx.uid) {
    return NextResponse.json({ error: 'You cannot start a chat with yourself.' }, { status: 400 });
  }
  const seedMessage = typeof body?.seedMessage === 'string' ? body.seedMessage : '';

  try {
    const chat = await ensureConversation(ctx.uid, participantId, seedMessage);
    return NextResponse.json({ chat });
  } catch (err) {
    if (err instanceof MessagingUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('[chat] open failed:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Could not open that conversation.' }, { status: 500 });
  }
}
