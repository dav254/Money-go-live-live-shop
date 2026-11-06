import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { pbGetProduct } from '@/lib/pocketbase/products';
import { projectListing, projectSeller } from '@/lib/mobile/public-listing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/mobile/listing/[id] — one public listing, shaped for the Android app.
 *
 * Public on purpose, exactly like the website's product page: `products` is
 * world-readable in the security rules, and strangers have to be able to look
 * at a listing before they sign up. The response is a strict projection (see
 * `@/lib/mobile/public-listing`) so nothing seller-only or moderation-related
 * leaves the server.
 *
 * Read order matches every other Vidnov surface: the local VPS store answers
 * first (so a Firestore outage cannot empty the catalog), Firestore is the
 * fallback and the source the mirror is copied from.
 *
 * `seller` is a four-field display card. The shop page resolves the richer
 * business record through `/api/public/business/[sellerId]`, which already owns
 * the rating/verification/privacy rules — this route does not duplicate them.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing listing id.' }, { status: 400 });

  try {
    let document: Record<string, unknown> | null = null;

    const mirrored = await pbGetProduct(id);
    if (mirrored?.data) {
      document = mirrored.data as Record<string, unknown>;
    } else {
      const snap = await db.collection('products').doc(id).get().catch(() => null);
      if (snap?.exists) document = (snap.data() ?? {}) as Record<string, unknown>;
    }

    if (!document) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });

    // The VPS mirror tombstones deletions with `status: 'deleted'`; a Firestore
    // document can carry the same tombstone. Either way the listing is gone.
    if (document.status === 'deleted') {
      return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });
    }

    const listing = projectListing(id, document);

    let seller = null;
    if (listing.sellerId) {
      const sellerSnap = await db
        .collection('userProfiles')
        .doc(listing.sellerId)
        .get()
        .catch(() => null);
      seller = projectSeller(
        listing.sellerId,
        (sellerSnap?.data() ?? null) as Record<string, unknown> | null,
      );
    }

    return NextResponse.json({ listing, seller });
  } catch {
    // Never log the document — only the fact that the read failed.
    console.error('[mobile/listing] read failed');
    return NextResponse.json({ error: 'Could not load that listing.' }, { status: 500 });
  }
}
