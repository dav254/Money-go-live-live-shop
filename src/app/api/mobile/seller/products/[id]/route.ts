import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyRequestUser } from '@/lib/media/api-auth';
import { pbDeleteProduct, pbGetProduct, pbMirrorProduct } from '@/lib/pocketbase/products';
import { readListing, type ListingInput } from '@/lib/mobile/listing-input';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH / DELETE /api/mobile/seller/products/[id] — a seller's own listing.
 *
 * ## Ownership is the whole point
 *
 * The id in the URL is attacker-controlled, so neither verb trusts it: the
 * document's existing `sellerId` must equal the VERIFIED uid before anything is
 * read back or changed. An admin override is deliberately absent — the admin
 * console has its own routes with their own audit trail.
 *
 * Deletion follows the platform's existing convention: a tombstone
 * (`status: 'deleted'`) in both stores, never a hard delete of a document that
 * order history may still reference.
 */

async function loadOwned(id: string, uid: string) {
  let document: Record<string, unknown> | null = null;
  try {
    const snap = await db.collection('products').doc(id).get();
    if (snap.exists) document = (snap.data() ?? {}) as Record<string, unknown>;
  } catch (error) {
    console.error('[mobile/seller/products] Firestore read failed:', error);
  }

  if (!document) {
    const mirrored = await pbGetProduct(id);
    document = (mirrored?.data as Record<string, unknown> | undefined) ?? null;
  }

  if (!document) return { error: 'Listing not found.', status: 404 as const };
  if (document.status === 'deleted') return { error: 'Listing not found.', status: 404 as const };
  if (String(document.sellerId ?? '') !== uid) {
    return { error: 'That listing belongs to another seller.', status: 403 as const };
  }
  return { document };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing listing id.' }, { status: 400 });

  const owned = await loadOwned(id, user.uid);
  if ('error' in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const body = (await request.json().catch(() => ({}))) as ListingInput;
  const parsed = readListing(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Ownership and creation metadata are never client-writable.
  const patch = parsed.value;
  delete (patch as Record<string, unknown>).sellerId;

  const nowIso = new Date().toISOString();
  try {
    await db.collection('products').doc(id).set(patch, { merge: true });
    const merged = {
      ...(owned.document as Record<string, unknown>),
      ...patch,
      uploadDate: nowIso,
      // Plain ISO for the VPS copy; the FieldValue sentinel stays in Firestore.
      updatedAt: nowIso,
    };
    await pbMirrorProduct(id, merged);
    return NextResponse.json({ ok: true, product: { id, ...merged } });
  } catch (error) {
    console.error('[mobile/seller/products] update failed:', error);
    return NextResponse.json(
      { error: 'Could not save your changes. Check your connection and try again.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing listing id.' }, { status: 400 });

  const owned = await loadOwned(id, user.uid);
  if ('error' in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  try {
    await db.collection('products').doc(id).set(
      { status: 'deleted', deletedAt: new Date().toISOString(), unpublished: true },
      { merge: true },
    );
    await pbDeleteProduct(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[mobile/seller/products] delete failed:', error);
    return NextResponse.json({ error: 'Could not delete that listing.' }, { status: 500 });
  }
}
