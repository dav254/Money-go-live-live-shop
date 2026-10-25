import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyRequestUser } from '@/lib/media/api-auth';
import { pbListProductsBySeller } from '@/lib/pocketbase/products';

export const runtime = 'nodejs';

/**
 * GET /api/products/mine — the caller's own listings, served from the VPS
 * store first and falling back to Firestore only when PocketBase is off or
 * the read failed.
 *
 * Why this exists: seller stock screens used to read `products` straight
 * from Firestore in the browser. When Firestore was unreachable, a seller's
 * entire shop appeared EMPTY — every listing gone — which reads as "my
 * products were deleted". The VPS keeps its own copy of every listing, so
 * the stock view can always answer.
 *
 * Ordering: newest first (VPS sort, or uploadDate desc after the in-memory
 * sort on the Firestore fallback — no composite index needed either way).
 */

const MAX_RESULTS = 300;

/** Firestore Timestamp / ISO string / number → epoch ms (0 when unknown). */
function toMs(value: unknown): number {
  if (value && typeof value === 'object') {
    const maybe = value as { toMillis?: () => number; _seconds?: number };
    if (typeof maybe.toMillis === 'function') return maybe.toMillis();
    if (typeof maybe._seconds === 'number') return maybe._seconds * 1000;
  }
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export async function GET(request: Request) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // VPS store first — same machine as the app, no Firestore involved.
  const mirrored = await pbListProductsBySeller(user.uid, MAX_RESULTS);

  if (mirrored) {
    return NextResponse.json({
      source: 'vps',
      products: mirrored.map((p) => ({ id: p.id, ...(p.data ?? {}) })),
    });
  }

  // Fallback: Firestore (admin SDK — no client-rules dependency).
  try {
    const snap = await db
      .collection('products')
      .where('sellerId', '==', user.uid)
      .limit(MAX_RESULTS)
      .get();
    const products = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }) as Record<string, unknown>)
      .sort((a, b) => toMs(b.uploadDate) - toMs(a.uploadDate));
    return NextResponse.json({ source: 'firestore', products });
  } catch (error) {
    console.error('[products/mine] Firestore fallback failed:', error);
    return NextResponse.json(
      { error: 'Both stores unreachable' },
      { status: 503 },
    );
  }
}
