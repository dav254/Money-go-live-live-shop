import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';

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
    const { uid } = await auth.verifyIdToken(authHeader.split('Bearer ')[1]);
    const profile = await db.collection('userProfiles').doc(uid).get();
    if (profile.data()?.userRole !== 'admin') return null;
    return uid;
  } catch {
    return null;
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
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error deleting product ${id}:`, error);
    return NextResponse.json({ error: 'Could not remove the listing' }, { status: 500 });
  }
}
