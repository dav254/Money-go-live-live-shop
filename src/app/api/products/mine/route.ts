import { NextResponse } from 'next/server';
import { verifyRequestUser } from '@/lib/media/api-auth';
import { loadSellerStock } from '@/lib/seller/stock';

export const runtime = 'nodejs';

/**
 * GET /api/products/mine — the caller's own listings.
 *
 * The answer is the union of the VPS mirror and Firestore (see
 * `loadSellerStock`). The mirror alone was not enough: listings created from
 * the website's browser live in Firestore and only reach the mirror through
 * `/api/products/sync`, so a seller who uploaded on vidnov.com could open the
 * Android stock screen and find an empty shop. Firestore alone was not enough
 * either: when it was unreachable the whole catalogue disappeared.
 *
 * `source` and `partial` are returned so a client can tell "no listings" apart
 * from "one store could not be read".
 */

const MAX_RESULTS = 300;

export async function GET(request: Request) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const stock = await loadSellerStock(user.uid, MAX_RESULTS);

  if (stock.partial && stock.products.length === 0) {
    return NextResponse.json({ error: 'Both stores unreachable' }, { status: 503 });
  }

  return NextResponse.json({
    source: stock.source,
    partial: stock.partial,
    products: stock.products,
  });
}
