import { NextResponse, type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { db } from '@/firebase/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * /api/mobile/listing/[id]/comments — the thread under a listing.
 *
 * Same subcollection the website writes (`products/{id}/comments`) and the same
 * document shape (`text`, `userId`, `userName`, `userAvatar`, `timestamp`).
 * The comments subcollection is world-readable in the security rules, so the
 * GET needs no token; posting needs one, and the author fields come from the
 * verified token rather than the request body, so nobody can post as someone
 * else.
 */

type CommentRow = {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  createdAt: string | null;
};

function iso(value: unknown): string | null {
  if (!value) return null;
  const candidate = value as { toDate?: () => Date; toMillis?: () => number; seconds?: number };
  if (typeof candidate.toMillis === 'function') {
    const ms = candidate.toMillis();
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  if (typeof candidate.seconds === 'number') return new Date(candidate.seconds * 1000).toISOString();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }
  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing listing id.' }, { status: 400 });

  try {
    const snap = await db
      .collection('products')
      .doc(id)
      .collection('comments')
      .limit(60)
      .get();

    const comments: CommentRow[] = snap.docs
      .map((doc) => {
        const data = (doc.data() ?? {}) as Record<string, unknown>;
        return {
          id: doc.id,
          text: String(data.text ?? '').trim(),
          userId: String(data.userId ?? ''),
          userName: String(data.userName ?? 'Vidnov customer'),
          userAvatar: typeof data.userAvatar === 'string' ? data.userAvatar : null,
          createdAt: iso(data.timestamp ?? data.createdAt),
        };
      })
      .filter((row) => row.text.length > 0)
      // Newest last so the sheet can render oldest-first, like a thread.
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));

    return NextResponse.json({ comments, count: comments.length });
  } catch {
    console.error('[mobile/listing/comments] read failed');
    return NextResponse.json({ error: 'Could not load the comments.' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Sign in to comment.' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing listing id.' }, { status: 400 });

  let text = '';
  try {
    const body = (await request.json()) as { text?: unknown };
    text = String(body?.text ?? '').trim();
  } catch {
    text = '';
  }
  if (!text) return NextResponse.json({ error: 'Write something first.' }, { status: 400 });
  if (text.length > 500) text = text.slice(0, 500);

  try {
    const listing = await db.collection('products').doc(id).get();
    if (!listing.exists) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });

    const profile = await db
      .collection('userProfiles')
      .doc(user.uid)
      .get()
      .catch(() => null);
    const data = (profile?.data() ?? {}) as Record<string, unknown>;

    const ref = await db.collection('products').doc(id).collection('comments').add({
      text,
      userId: user.uid,
      userName: String(data.fullName ?? data.shopName ?? user.name ?? 'Vidnov customer'),
      userEmail: String(data.email ?? user.email ?? ''),
      userAvatar: typeof data.profilePictureUrl === 'string' ? data.profilePictureUrl : '',
      timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      ok: true,
      comment: {
        id: ref.id,
        text,
        userId: user.uid,
        userName: String(data.fullName ?? data.shopName ?? user.name ?? 'Vidnov customer'),
        userAvatar: typeof data.profilePictureUrl === 'string' ? data.profilePictureUrl : null,
        createdAt: new Date().toISOString(),
      } satisfies CommentRow,
    });
  } catch {
    console.error('[mobile/listing/comments] write failed');
    return NextResponse.json({ error: 'Could not post that comment.' }, { status: 500 });
  }
}
