import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server';
import { pbListAllProducts } from '@/lib/pocketbase/products';

export const runtime = 'nodejs';

/**
 * GET /api/admin/products/list — the admin product console's list, merged from the
 * VPS store. Firestore stays the live subscription on the page; this route
 * supplies the rows Firestore could not (mirror-only listings) plus a full
 * list when Firestore is unreachable, so the admin can always see the
 * entire catalog.
 */

const MAX_RESULTS = 500;

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let fsIds: string[] = [];
  try {
    const snap = await db.collection('products').limit(1000).get();
    fsIds = snap.docs.map((d) => d.id);
  } catch (error) {
    console.error('[admin/products] Firestore read failed:', error);
  }

  const pbProducts = await pbListAllProducts(MAX_RESULTS);
  const extraProducts = (pbProducts ?? []).filter((p) => !fsIds.includes(p.id));

  return NextResponse.json({
    ok: true,
    fsCount: fsIds.length,
    extraProducts: extraProducts.map((p) => ({ id: p.id, ...(p.data ?? {}) })),
  });
}
