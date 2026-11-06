import { NextResponse, type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { auth, db } from '@/firebase/server';
import { pbGetProduct } from '@/lib/pocketbase/products';
import { projectListing, type PublicListing } from '@/lib/mobile/public-listing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Wishlist ids are capped the same way the website's saved-items query is. */
const MAX_SAVED = 100;

async function uidFrom(request: NextRequest): Promise<string | null> {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  try {
    return (await auth.verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}

/**
 * GET /api/mobile/saved — the signed-in buyer's saved listings.
 *
 * The wishlist is already a real part of the product: `userProfiles/{uid}
 * .wishlist` holds product ids and the website's saved-items page renders the
 * matching documents. The Android app reads that same field through the server
 * instead of querying Firestore from the device (the `documentId() in [...]`
 * query needs the client SDK and its index).
 *
 * POST /api/mobile/saved { listingId, saved } — toggle one listing. Server-side
 * so the write cannot be issued for another account, and so array semantics are
 * atomic (`arrayUnion` / `arrayRemove`) rather than read-modify-write from a
 * phone that may be on a flaky connection.
 */
export async function GET(request: NextRequest) {
  const uid = await uidFrom(request);
  if (!uid) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  try {
    const snap = await db.collection('userProfiles').doc(uid).get().catch(() => null);
    const raw = (snap?.data() as { wishlist?: unknown } | undefined)?.wishlist;
    const ids = Array.isArray(raw)
      ? raw.filter((v): v is string => typeof v === 'string').slice(0, MAX_SAVED)
      : [];

    if (ids.length === 0) return NextResponse.json({ items: [] });

    const items: PublicListing[] = [];
    for (const id of ids) {
      const mirrored = await pbGetProduct(id);
      if (mirrored?.data) {
        items.push(projectListing(id, mirrored.data as Record<string, unknown>));
        continue;
      }
      const productSnap = await db.collection('products').doc(id).get().catch(() => null);
      if (productSnap?.exists) {
        items.push(projectListing(id, (productSnap.data() ?? {}) as Record<string, unknown>));
      }
    }

    return NextResponse.json({ items });
  } catch {
    console.error('[mobile/saved] read failed');
    return NextResponse.json({ error: 'Could not load your saved items.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const uid = await uidFrom(request);
  if (!uid) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { listingId?: unknown; saved?: unknown }
    | null;
  const listingId = typeof body?.listingId === 'string' ? body.listingId.trim() : '';
  const saved = body?.saved !== false;

  if (!listingId) return NextResponse.json({ error: 'Missing listingId.' }, { status: 400 });

  try {
    await db
      .collection('userProfiles')
      .doc(uid)
      .set(
        { wishlist: saved ? FieldValue.arrayUnion(listingId) : FieldValue.arrayRemove(listingId) },
        { merge: true },
      );
    return NextResponse.json({ ok: true, saved });
  } catch {
    console.error('[mobile/saved] write failed');
    return NextResponse.json({ error: 'Could not update your saved items.' }, { status: 500 });
  }
}
