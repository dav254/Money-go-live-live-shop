/**
 * GET /api/search — bounded server-side search over existing Firestore data.
 *
 * Public data only (products and seller profiles are already publicly
 * readable), so no auth is required — but every input is validated and every
 * read is capped (searchParamsSchema: q ≤200 chars, limit ≤50, internal
 * candidate window of 300 docs).
 *
 * Responses never include internal fields: products are mapped to an explicit
 * projection and sellers to four display fields.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { searchProducts, searchSellers } from '@/lib/vidnov-core/catalog/search';
import { searchParamsSchema } from '@/lib/vidnov-core/validation';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const parsed = searchParamsSchema.safeParse({
      q: params.get('q') ?? '',
      category: params.get('category') ?? undefined,
      location: params.get('location') ?? undefined,
      inStockOnly: params.get('inStockOnly') ?? undefined,
      limit: params.get('limit') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid search parameters.' }, { status: 400 });
    }

    const inStockOnly = parsed.data.inStockOnly === '1' || parsed.data.inStockOnly === 'true';
    const [products, sellers] = await Promise.all([
      searchProducts(db, { ...parsed.data, inStockOnly }),
      searchSellers(db, parsed.data.q, 12),
    ]);

    return NextResponse.json({
      products: products.items,
      sellers,
      scanned: products.scanned,
      windowCapped: products.windowCapped,
    });
  } catch {
    // No error objects in logs — internal details stay server-side only.
    console.error('[core/search] search failed');
    return NextResponse.json({ error: 'Search is temporarily unavailable.' }, { status: 500 });
  }
}
