import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { pbDeleteProduct, pbGetProduct, pbPatchProduct } from '@/lib/pocketbase/products';
import { pbIsAdmin } from '@/lib/pocketbase/admins';
import { pbGetProfile } from '@/lib/pocketbase/profiles';
import { isAdminByEnv } from '@/lib/server/admin-env';

/**
 * DELETE /api/admin/products/{id} — remove a reported listing.
 *
 * Backs the "Remove listing" action on the reported-products console. Media
 * cleanup is left to the existing cleanup cron, which deletes storage files no
 * media record references — so deleting the product document here cannot
 * orphan-serve or wrongly-delete images.
 */

async function requireAdmin(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = await auth.verifyIdToken(authHeader.split('Bearer ')[1]);
    const uid = decoded.uid;
    // Env allowlist first (no database), then VPS stores, then Firestore.
    if (isAdminByEnv(uid, decoded.email)) return uid;
    if ((await pbIsAdmin(uid)) === true) return uid;
    if ((await pbGetProfile(uid))?.userRole === 'admin') return uid;
    const profile = await db.collection('userProfiles').doc(uid).get().catch(() => null);
    if (profile?.data()?.userRole === 'admin') return uid;
    return null;
  } catch {
    return null;
  }
}

/**
 * PATCH /api/admin/products/{id} — toggle the admin moderation flags.
 *
 * Body (strict — nothing else is accepted): { featured?: boolean, unpublished?: boolean }.
 *
 * VPS-primary: the PocketBase mirror takes the patch and Firestore receives
 * the same update best-effort, so a blocked Firestore cannot keep a listing
 * featured or published against the admin's decision. When the listing was
 * never mirrored, Firestore is the only store and its result decides.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUid = await requireAdmin(request);
  if (!adminUid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (typeof body.featured === 'boolean') patch.featured = body.featured;
  if (typeof body.unpublished === 'boolean') patch.unpublished = body.unpublished;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  try {
    const ref = db.collection('products').doc(id);
    const patchedOnVps = await pbPatchProduct(id, patch);

    let firestoreOk = false;
    try {
      const snap = await ref.get();
      if (snap.exists) {
        await ref.update(patch);
        firestoreOk = true;
      }
    } catch (error) {
      if (!patchedOnVps) throw error; // Neither store took it — report failure.
      console.error('[admin/products] Firestore patch mirror failed (kept on VPS):', error);
    }

    if (!patchedOnVps && !firestoreOk) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, patched: patch, store: patchedOnVps ? 'vps' : 'firestore' });
  } catch (error) {
    console.error(`Error patching product ${id}:`, error);
    return NextResponse.json({ error: 'Could not update the listing' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUid = await requireAdmin(request);
  if (!adminUid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });

  try {
    const ref = db.collection('products').doc(id);

    /*
     * VPS-PRIMARY: the mirrored copy decides existence and takes the delete,
     * Firestore gets the same delete best-effort. The Firestore path stays as
     * the fallback for listings that were never mirrored. A blocked Firestore
     * can no longer keep a reported listing alive.
     */
    const mirrored = await pbGetProduct(id);
    if (mirrored) {
      await pbDeleteProduct(id);
      try {
        await ref.delete();
      } catch (error) {
        console.error(`[admin/products] Firestore mirror delete failed (removed on VPS):`, error);
      }
      return NextResponse.json({ success: true });
    }

    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    await ref.delete();
    // Tombstone the VPS copy so the listing disappears from the mirrored
    // admin list too — never leave a row the seller can still see.
    void pbDeleteProduct(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error deleting product ${id}:`, error);
    return NextResponse.json({ error: 'Could not remove the listing' }, { status: 500 });
  }
}
