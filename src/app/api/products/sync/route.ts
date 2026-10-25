import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyRequestUser } from '@/lib/media/api-auth';
import { pbMirrorProduct, pbDeleteProduct } from '@/lib/pocketbase/products';

export const runtime = 'nodejs';

/**
 * POST /api/products/sync { productId, action?: 'upsert' | 'delete' }
 *
 * Called (fire-and-forget) by the client after every listing create / edit /
 * delete. The payload is only the product id — the server reads the
 * authoritative Firestore document itself (never a client-supplied body), so
 * a tampered request cannot push a forged listing into the VPS store. The
 * caller must own the listing (seller of the doc) or be an admin.
 *
 * Mirror failures never fail the caller's real write: the response is always
 * 200 once the doc ownership check passes, with `mirrored: false` when the
 * VPS write did not happen.
 */
export async function POST(request: NextRequest) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    productId?: string;
    action?: string;
  };
  const productId = (body.productId ?? '').toString();
  const action = body.action === 'delete' ? 'delete' : 'upsert';
  if (!productId || productId.length > 128) {
    return NextResponse.json({ error: 'Invalid productId' }, { status: 400 });
  }

  const ref = db.collection('products').doc(productId);
  const snap = await ref.get().catch(() => null);
  if (!snap) return NextResponse.json({ mirrored: false, reason: 'read-failed' });

  // Delete: the doc may already be gone — tombstone the VPS row anyway.
  if (action === 'delete' || !snap.exists) {
    if (snap.exists) {
      const data = snap.data() as { sellerId?: string } | undefined;
      if (data?.sellerId !== user.uid && !(await isAdmin(user.uid))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    const mirrored = await pbDeleteProduct(productId);
    return NextResponse.json({ ok: true, mirrored });
  }

  const data = (snap.data() ?? {}) as Record<string, unknown>;
  if (data.sellerId !== user.uid && !(await isAdmin(user.uid))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const mirrored = await pbMirrorProduct(productId, scrubForMirror(data));
  return NextResponse.json({ ok: true, mirrored });
}

async function isAdmin(uid: string): Promise<boolean> {
  try {
    const profile = await db.collection('userProfiles').doc(uid).get();
    return profile.data()?.userRole === 'admin';
  } catch {
    return false;
  }
}

/**
 * Firestore Timestamps (and FieldValue leftovers) are not JSON — convert
 * timestamps to ISO strings recursively so the whole document survives the
 * PocketBase JSON round-trip intact.
 */
function scrubForMirror(value: unknown): Record<string, unknown> {
  const walk = (v: unknown): unknown => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
    if (Array.isArray(v)) return v.map(walk);
    const maybeDate = v as { toDate?: () => Date };
    if (typeof maybeDate.toDate === 'function') {
      try {
        return maybeDate.toDate().toISOString();
      } catch {
        return null;
      }
    }
    if (typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        const cleaned = walk(val);
        if (cleaned !== null || val === null) out[k] = cleaned;
      }
      return out;
    }
    return null; // functions, symbols, FieldValue singletons
  };
  return walk(value) as Record<string, unknown>;
}
