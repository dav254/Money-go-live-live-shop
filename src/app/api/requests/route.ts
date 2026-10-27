import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyUserContext, type UserContext } from '@/lib/notifications/server-utils';
import { createRequest, closeRequest, deleteRequest } from '@/lib/requests/request-service';
import { getMyOffer, submitOffer, acceptOffer } from '@/lib/requests/offer-service';
import { findMatchingSellers } from '@/lib/requests/matching';
import { REQUESTS_COLLECTION } from '@/lib/media/config';
import { pbBumpRequestCounter } from '@/lib/pocketbase/requests';
import { listMediaForOwner, type MediaSummary } from '@/lib/media/service';
import type { MarketplaceRequest } from '@/lib/requests/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Requests API (spec §24–37).
 *
 * GET    /api/requests?scope=mine     → requests I posted (any role)
 * GET    /api/requests?scope=open     → requests open to any seller (no accepted offer yet)
 * GET    /api/requests?scope=won      → requests where my offer was accepted (seller only)
 * GET    /api/requests?id=            → one request + authorized media
 *        (`role=seller` is kept as an alias of `scope=open` for older clients)
 * POST   /api/requests                → create request
 * PATCH  ?action=close|delete&id=     → close/delete own request
 * PATCH  ?action=match&id=            → matched sellers for a request (debug/insight)
 */
export async function GET(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  try {
    if (id) {
      const snap = await db.collection(REQUESTS_COLLECTION).doc(id).get();
      if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const request = snap.data() as MarketplaceRequest;
      if (request.status === 'deleted') return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const isOwner = request.customerId === user.uid;
      if (!isOwner && !user.isAdmin) {
        // Business accounts (sellers/admins) may view any brief that is still
        // OPEN with its media — any seller can reply with an offer (§32). Once
        // the customer accepts an offer the brief is closed, but the seller who
        // WON keeps full access so they can fulfil it and talk to the buyer.
        // Buyers who are not the owner only see the public brief.
        const sellerView = user.role === 'seller' || user.role === 'admin';
        const isWinner = request.acceptedOfferSellerId === user.uid;
        if (!sellerView || (!isWinner && request.status !== 'active')) {
          return NextResponse.json({ request: { ...request, mediaIds: [] }, mediaAuthorized: false, media: [] });
        }
        const media = await listMediaForOwner({ requestId: id });
        return NextResponse.json({ request, mediaAuthorized: true, media });
      }
      const media = await listMediaForOwner({ requestId: id });
      return NextResponse.json({ request, mediaAuthorized: true, media });
    }

    // Explicit scopes keep "my requests" meaning the same thing for buyers and
    // sellers. Previously the role decided implicitly, so a seller's "My
    // Requests" tab silently returned the open inbox instead.
    const scopeParam = url.searchParams.get('scope');
    const roleParam = url.searchParams.get('role');
    const scope = scopeParam ?? (roleParam === 'seller' ? 'open' : 'mine');

    if (scope === 'open') {
      // OPEN FOR BUSINESS: an offer can still be placed, so the brief must not
      // have an accepted offer yet. Once the customer accepts, every other
      // seller loses it from this list immediately.
      const snap = await db.collection(REQUESTS_COLLECTION).where('status', '==', 'active').limit(100).get();
      const visible: MarketplaceRequest[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as MarketplaceRequest;
        if (data.acceptedOfferId) return;
        if (data.status === 'deleted') return;
        visible.push({ ...data, id: doc.id });
      });
      // Fire-and-forget view count is skipped: list views are not detail views.
      return NextResponse.json({ requests: visible });
    }

    if (scope === 'won') {
      // Requests where THIS seller's offer was accepted — they stay visible
      // (and actionable) after the brief closes.
      const snap = await db
        .collection(REQUESTS_COLLECTION)
        .where('acceptedOfferSellerId', '==', user.uid)
        .limit(100)
        .get();
      const won: MarketplaceRequest[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as MarketplaceRequest;
        if (data.status === 'deleted') return;
        won.push({ ...data, id: doc.id });
      });
      return NextResponse.json({ requests: won });
    }

    // scope=mine → requests this account posted, whatever its role.
    const snap = await db
      .collection(REQUESTS_COLLECTION)
      .where('customerId', '==', user.uid)
      .limit(100)
      .get();
    const mine: MarketplaceRequest[] = [];
    snap.forEach((doc) => {
      const data = doc.data() as MarketplaceRequest;
      if (data.status !== 'deleted') mine.push({ ...data, id: doc.id });
    });
    return NextResponse.json({ requests: mine });
  } catch (error) {
    console.error('[requests/GET]', error);
    return NextResponse.json({ error: 'Failed to load requests.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await request.json()) as {
      title?: string;
      description?: string;
      category?: string;
      quantity?: number;
      budgetMin?: number | null;
      budgetMax?: number | null;
      location?: string;
      deadline?: string | null;
      mediaIds?: string[];
    };

    const created = await createRequest(
      user.uid,
      {
        title: body.title ?? '',
        description: body.description ?? '',
        category: body.category ?? '',
        quantity: body.quantity,
        budgetMin: body.budgetMin ?? null,
        budgetMax: body.budgetMax ?? null,
        location: body.location,
        deadline: body.deadline ?? null,
        mediaIds: body.mediaIds ?? [],
      },
      { name: user.name, email: user.email },
    );
    return NextResponse.json({ request: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create request.';
    console.error('[requests/POST]', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const id = url.searchParams.get('id');
  if (!id || !action) return NextResponse.json({ error: 'Missing id or action.' }, { status: 400 });

  try {
    if (action === 'close') {
      await closeRequest(id, user.uid);
      return NextResponse.json({ ok: true });
    }
    if (action === 'delete') {
      await deleteRequest(id, user.uid);
      return NextResponse.json({ ok: true });
    }
    if (action === 'match') {
      const snap = await db.collection(REQUESTS_COLLECTION).doc(id).get();
      if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const matches = await findMatchingSellers(snap.data() as MarketplaceRequest, 50);
      return NextResponse.json({ matches });
    }
    if (action === 'accept') {
      const body = (await request.json().catch(() => ({}))) as { offerId?: string };
      if (!body.offerId) return NextResponse.json({ error: 'Missing offerId.' }, { status: 400 });
      const { orderId } = await acceptOffer(id, body.offerId, user.uid);
      return NextResponse.json({ ok: true, orderId });
    }
    if (action === 'offer') {
      // `id` here is the OFFER id — submit/update the seller's offer.
      const body = (await request.json().catch(() => ({}))) as {
        price?: number;
        message?: string;
        deliveryDays?: number | null;
        mediaIds?: string[];
      };
      const offer = await submitOffer(id, user.uid, {
        price: Number(body.price),
        message: body.message ?? '',
        deliveryDays: body.deliveryDays ?? null,
        mediaIds: body.mediaIds,
      });
      return NextResponse.json({ offer });
    }
    if (action === 'my-offer') {
      const offer = await getMyOffer(id, user.uid);
      return NextResponse.json({ offer });
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Action failed.';
    console.error('[requests/PATCH]', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Increments request views when a seller opens the detail view. */
export async function PUT(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
  await db
    .collection(REQUESTS_COLLECTION)
    .doc(id)
    .update({ views: FieldValue.increment(1) })
    .catch(() => undefined);
  // The mirror's views counter follows the same rule: a bump only, never a
  // client-supplied number.
  void pbBumpRequestCounter(id, 'views', 1);
  return NextResponse.json({ ok: true });
}
