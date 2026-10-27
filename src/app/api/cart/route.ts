import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyRequestUser } from '@/lib/media/api-auth';
import { pbListUserDocs } from '@/lib/pocketbase/user-data';
import { scrubForPocketBase } from '@/lib/pocketbase/server';

export const runtime = 'nodejs';

/**
 * GET /api/cart — the caller's own cart, served from the VPS store first and
 * falling back to Firestore only when PocketBase is off or the read failed.
 *
 * Why this exists: both cart screens read `userProfiles/{uid}/cart` straight
 * from Firestore in the browser, and checkout is built on that read. When
 * Firestore cannot answer, the buyer's cart rendered EMPTY — which looks like
 * "my cart was emptied", not "the database is down". The VPS keeps its own
 * copy of every cart line (mirrored on each add / quantity change / removal),
 * so the cart can always be shown.
 *
 * The list is always scoped to the verified caller's uid; there is no
 * parameter that could name another account.
 */

export async function GET(request: Request) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // VPS store first — same machine as the app, no Firestore involved.
  const mirrored = await pbListUserDocs('cart', user.uid);
  if (mirrored) {
    return NextResponse.json({
      source: 'vps',
      items: mirrored.map((row) => ({ id: row.id, ...(row.data ?? {}) })),
    });
  }

  // Fallback: Firestore (admin SDK — no client-rules dependency).
  try {
    const snap = await db
      .collection('userProfiles')
      .doc(user.uid)
      .collection('cart')
      .get();
    const items = snap.docs.map((doc) => ({
      id: doc.id,
      ...((scrubForPocketBase(doc.data()) ?? {}) as Record<string, unknown>),
    }));
    return NextResponse.json({ source: 'firestore', items });
  } catch (error) {
    console.error('[cart] Firestore fallback failed:', error);
    return NextResponse.json({ error: 'Both stores unreachable' }, { status: 503 });
  }
}
