import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import {
  createOfferDraft,
  listOffersForRequest,
  listOffersBySeller,
} from '@/lib/requests/offer-service';
import { OFFERS_COLLECTION, REQUESTS_COLLECTION } from '@/lib/media/config';
import { listMediaForOwner, type MediaSummary } from '@/lib/media/service';
import type { MarketplaceOffer, MarketplaceRequest } from '@/lib/requests/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Offers API (spec §31, §37).
 *
 * GET  ?requestId=...         → all offers on one request (customer owner or admin)
 * GET  ?mine=1                → my offers (seller)
 * POST { requestId }          → create draft offer (reserves offers/offer_<id>/ media folder)
 * PATCH ?id=...&action=withdraw → withdraw my offer
 */
export async function GET(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  try {
    if (url.searchParams.get('mine') === '1') {
      const offers = await listOffersBySeller(user.uid);
      const offersWithMedia = await Promise.all(
        offers.map(async (offer) => ({
          ...offer,
          media: await listMediaForOwner({ offerId: offer.id }),
        })),
      );
      return NextResponse.json({ offers: offersWithMedia });
    }

    const requestId = url.searchParams.get('requestId');
    if (!requestId) return NextResponse.json({ error: 'Missing requestId.' }, { status: 400 });

    const reqSnap = await db.collection(REQUESTS_COLLECTION).doc(requestId).get();
    if (!reqSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const request = reqSnap.data() as MarketplaceRequest;

    if (request.customerId !== user.uid && user.role !== 'admin') {
      return NextResponse.json({ error: 'Only the request owner can list offers.' }, { status: 403 });
    }

    const offers = await listOffersForRequest(requestId);
    // Attachments per offer, resolved in one batch for the compare view.
    const offersWithMedia = await Promise.all(
      offers.map(async (offer) => ({
        ...offer,
        media: await listMediaForOwner({ offerId: offer.id }),
      })),
    );
    return NextResponse.json({ offers: offersWithMedia });
  } catch (error) {
    console.error('[offers/GET]', error);
    return NextResponse.json({ error: 'Failed to load offers.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await request.json()) as { requestId?: string };
    if (!body.requestId) return NextResponse.json({ error: 'Missing requestId.' }, { status: 400 });
    // Signature: createOfferDraft(sellerId, requestId, seller?) — the seller
    // first, then the request (swapping these caused "Request not found").
    const offer = await createOfferDraft(user.uid, body.requestId, {
      name: user.name,
      businessName: user.businessName,
    });
    return NextResponse.json({ offer });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not start the offer.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const action = url.searchParams.get('action');
  if (!id || action !== 'withdraw') {
    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  }

  try {
    const ref = db.collection(OFFERS_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const offer = snap.data() as MarketplaceOffer;
    if (offer.sellerId !== user.uid) return NextResponse.json({ error: 'Not your offer.' }, { status: 403 });
    if (offer.status === 'accepted') {
      return NextResponse.json({ error: 'Accepted offers cannot be withdrawn.' }, { status: 400 });
    }
    const wasLive = offer.status === 'submitted';
    await ref.update({ status: 'withdrawn', updatedAt: FieldValue.serverTimestamp() });
    if (wasLive) {
      await db
        .collection(REQUESTS_COLLECTION)
        .doc(offer.requestId)
        .update({ offersCount: FieldValue.increment(-1) })
        .catch(() => undefined);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[offers/PATCH]', error);
    return NextResponse.json({ error: 'Failed to withdraw offer.' }, { status: 500 });
  }
}
