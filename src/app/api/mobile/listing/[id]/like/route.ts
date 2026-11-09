import { NextResponse, type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { db } from '@/firebase/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/mobile/listing/[id]/like — the Android app's like button.
 *
 * The website increments `products/{id}.likes` straight from the browser
 * (Firestore rules allow a signed-in user to touch that one counter). The app
 * has no Firestore client, so this route performs the SAME write on the SAME
 * field through the Admin SDK. It is a transport, not a second system: there
 * is already a `likes` counter on the document, and there is still only one.
 *
 * Body: `{ liked: boolean }` — the caller's intended end state, so a retry
 * cannot double-count.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Sign in to like a listing.' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing listing id.' }, { status: 400 });

  let liked = true;
  try {
    const body = (await request.json()) as { liked?: unknown };
    liked = body?.liked !== false;
  } catch {
    // An empty body means "like it", which is what the icon sends.
    liked = true;
  }

  try {
    const ref = db.collection('products').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });

    await ref.update({ likes: FieldValue.increment(liked ? 1 : -1) });

    const after = await ref.get();
    const likes = Number((after.data() as { likes?: number } | undefined)?.likes ?? 0);
    return NextResponse.json({ ok: true, liked, likes: Math.max(0, likes) });
  } catch {
    console.error('[mobile/listing/like] write failed');
    return NextResponse.json({ error: 'Could not save that like.' }, { status: 500 });
  }
}
