import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/firebase/server';
import { pbListProductsBySeller } from '@/lib/pocketbase/products';
import { projectListing, type PublicListing } from '@/lib/mobile/public-listing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LIMIT = 40;

/**
 * GET /api/mobile/catalog?sellerId=…&category=…&limit=… — public listing feed.
 *
 * The Android app needs three reads the website does not: a seller's shop
 * shelf, a single-category shelf, and the newest shelf for the home screen.
 * `/api/search` answers free-text queries but not "these exact listings, newest
 * first, no ranking", so this route provides that without a second database:
 * same `products` documents, VPS store first, Firestore second.
 *
 * Public: `products` is world-readable in the security rules, and this returns
 * the same public projection the listing page returns.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const sellerId = params.get('sellerId')?.trim() || '';
  const category = params.get('category')?.trim() || '';
  const rawLimit = Number(params.get('limit'));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_LIMIT) : 20;

  try {
    let listings: PublicListing[] = [];

    if (sellerId) {
      // A shop shelf: the VPS mirror is keyed by seller and newest-first.
      const mirrored = await pbListProductsBySeller(sellerId, limit);
      if (mirrored) {
        listings = mirrored
          .filter((p) => p.data)
          .map((p) => projectListing(p.id, p.data as Record<string, unknown>))
          .slice(0, limit);
      } else {
        const snap = await db
          .collection('products')
          .where('sellerId', '==', sellerId)
          .limit(limit * 2)
          .get()
          .catch(() => null);
        listings = (snap?.docs ?? [])
          .map((doc) => projectListing(doc.id, doc.data() as Record<string, unknown>))
          .filter((l) => (l as { status?: string }).status !== 'deleted');
      }
    } else {
      // A global shelf. Category filtering stays a single-field equality query
      // so it uses Firestore's automatic index (no composite index deployment).
      const collection = db.collection('products');
      const query = category
        ? collection.where('category', '==', category).limit(limit * 3)
        : collection.orderBy('uploadDate', 'desc').limit(limit * 3);
      const snap = await query.get().catch(() => null);
      listings = (snap?.docs ?? [])
        .map((doc) => projectListing(doc.id, doc.data() as Record<string, unknown>))
        .filter((l) => (l as { status?: string }).status !== 'deleted');
    }

    // Newest first, then bound. Listing documents written by older clients may
    // have no timestamp at all; those sort last rather than breaking the sort.
    listings.sort((a, b) => {
      const ta = a.uploadedAt ? Date.parse(a.uploadedAt) : 0;
      const tb = b.uploadedAt ? Date.parse(b.uploadedAt) : 0;
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });

    return NextResponse.json({
      listings: listings.slice(0, limit),
      sellerId: sellerId || null,
      category: category || null,
    });
  } catch {
    console.error('[mobile/catalog] read failed');
    return NextResponse.json({ error: 'Could not load listings.' }, { status: 500 });
  }
}
