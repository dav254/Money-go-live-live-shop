import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequestUser } from '@/lib/media/api-auth';
import { pbMirrorProduct } from '@/lib/pocketbase/products';
import { readListing, type ListingInput } from '@/lib/mobile/listing-input';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/mobile/seller/products — publish a listing from the Android app.
 *
 * The website writes `products` from the browser; the phone cannot, because it
 * has no Firestore client and must not carry one. This route is the phone's
 * single create path:
 *
 *   • `sellerId` is taken from the VERIFIED token, never from the body — so a
 *     caller cannot publish a listing onto another seller's shop;
 *   • every field is validated and clamped in `@/lib/mobile/listing-input`, so
 *     a malformed payload can never land a half-valid document;
 *   • the document matches the website's product shape (`imageUrl`,
 *     `imageUrls`, `thumbnailUrls`, `uploadDate`, counters), so the same
 *     listing renders identically in discovery, the shop and the app;
 *   • the VPS mirror is written immediately, so the new listing is visible
 *     even while Firestore is catching up.
 */
export async function POST(request: Request) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as ListingInput;
  const parsed = readListing(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const nowIso = new Date().toISOString();
  const document = {
    ...parsed.value,
    sellerId: user.uid,
    uploadDate: FieldValue.serverTimestamp(),
    likes: 0,
    viewCount: 0,
    inCartCount: 0,
    salesCount: 0,
  };

  try {
    const created = await db.collection('products').add(document);

    // The VPS copy is keyed by the same id. Mirror with plain scalars so the
    // store can be queried immediately (serverTimestamp is not JSON).
    const mirroredData = {
      ...(parsed.value as Record<string, unknown>),
      sellerId: user.uid,
      // Never mirror a FieldValue sentinel — PocketBase needs plain ISO text.
      updatedAt: nowIso,
      uploadDate: nowIso,
      createdAt: nowIso,
      likes: 0,
      viewCount: 0,
      inCartCount: 0,
      salesCount: 0,
    };
    await pbMirrorProduct(created.id, mirroredData);

    return NextResponse.json({
      ok: true,
      product: { id: created.id, ...mirroredData, uploadDate: nowIso },
    });
  } catch (error) {
    console.error('[mobile/seller/products] create failed:', error);
    return NextResponse.json(
      { error: 'Could not publish the listing. Check your connection and try again.' },
      { status: 500 },
    );
  }
}
