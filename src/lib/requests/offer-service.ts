import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { notify } from '@/lib/notifications/engine';
import { sendTemplateEmail } from '@/lib/notifications/email-service';
import { appLink } from '@/lib/notifications/config';
import { pbMirrorOrder } from '@/lib/pocketbase/orders';
import {
  pbBumpRequestCounter,
  pbMirrorOffer,
  pbPatchOffer,
  pbPatchRequest,
} from '@/lib/pocketbase/requests';
import { OFFERS_COLLECTION, REQUESTS_COLLECTION } from '@/lib/media/config';
import {
  type MarketplaceOffer,
  type MarketplaceRequest,
} from './types';

/**
 * OFFER SERVICE (spec §31, §37).
 *
 * Sellers answer a request with an offer (price + details + media).
 * Flow: createOfferDraft → (media uploads bind to offerId) → submitOffer →
 * the customer compares/messages/accepts. Acceptance closes the request,
 * creates the order, and notifies the winner. Payment/fulfillment ride the
 * existing order pipeline.
 */

/** Step 1: reserve the offer so media can upload into offers/offer_<id>/. */
export async function createOfferDraft(
  sellerId: string,
  requestId: string,
  seller?: { name?: string; businessName?: string },
): Promise<MarketplaceOffer> {
  const reqSnap = await db.collection(REQUESTS_COLLECTION).doc(requestId).get();
  if (!reqSnap.exists) throw new Error('Request not found.');
  const request = reqSnap.data() as MarketplaceRequest;
  if (request.status !== 'active') throw new Error('This request is no longer accepting offers.');
  if (request.customerId === sellerId) throw new Error('You cannot offer on your own request.');

  const mine = await getMyOffer(requestId, sellerId);
  if (mine) return mine; // idempotent — one offer per seller per request

  const now = FieldValue.serverTimestamp();
  const ref = db.collection(OFFERS_COLLECTION).doc();
  const offer: MarketplaceOffer = {
    id: ref.id,
    requestId,
    sellerId,
    sellerName: seller?.name,
    sellerBusinessName: seller?.businessName,
    price: 0,
    currency: request.currency,
    message: '',
    deliveryDays: null,
    mediaIds: [],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(offer);

  // VPS copy of the draft (best-effort): the serverTimestamp sentinels have no
  // JSON form, so the mirror gets real ISO stamps.
  const mirroredAt = new Date().toISOString();
  void pbMirrorOffer(ref.id, { ...offer, createdAt: mirroredAt, updatedAt: mirroredAt });
  return offer;
}

/** Step 2: submit (or update + resubmit) the offer with price/details/media. */
export async function submitOffer(
  offerId: string,
  sellerId: string,
  input: { price: number; message: string; deliveryDays?: number | null; mediaIds?: string[] },
): Promise<MarketplaceOffer> {
  const offerRef = db.collection(OFFERS_COLLECTION).doc(offerId);
  const snap = await offerRef.get();
  if (!snap.exists) throw new Error('Offer not found.');
  const offer = snap.data() as MarketplaceOffer;
  if (offer.sellerId !== sellerId) throw new Error('Not your offer.');

  const price = Number(input.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error('Enter a valid price.');
  const message = (input.message ?? '').trim();
  if (message.length < 10) throw new Error('Tell the customer more — description is too short.');

  const wasDraft = offer.status === 'draft';
  const submittedAt = new Date().toISOString();
  await offerRef.update({
    price,
    message,
    deliveryDays: input.deliveryDays ?? null,
    mediaIds: (input.mediaIds ?? offer.mediaIds ?? []).slice(0, 7),
    status: 'submitted',
    updatedAt: FieldValue.serverTimestamp(),
  });

  // VPS copy of the submitted offer (best-effort; `createdAt` was already
  // written when the draft was reserved, and PATCH merges leave it intact).
  void pbPatchOffer(offerId, {
    ...offer,
    price,
    message,
    deliveryDays: input.deliveryDays ?? null,
    mediaIds: (input.mediaIds ?? offer.mediaIds ?? []).slice(0, 7),
    status: 'submitted',
    updatedAt: submittedAt,
  });

  if (wasDraft) {
    await db
      .collection(REQUESTS_COLLECTION)
      .doc(offer.requestId)
      .update({ offersCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() })
      .catch(() => undefined);
    void pbBumpRequestCounter(offer.requestId, 'offersCount', 1);
    void notifyCustomerOfOffer(offerId);
  }

  return { ...offer, price, message, status: 'submitted' };
}

async function notifyCustomerOfOffer(offerId: string): Promise<void> {
  try {
    const offerSnap = await db.collection(OFFERS_COLLECTION).doc(offerId).get();
    if (!offerSnap.exists) return;
    const offer = offerSnap.data() as MarketplaceOffer;
    const reqSnap = await db.collection(REQUESTS_COLLECTION).doc(offer.requestId).get();
    if (!reqSnap.exists) return;
    const request = reqSnap.data() as MarketplaceRequest;
    const profileSnap = await db.collection('userProfiles').doc(request.customerId).get();
    const profile = profileSnap.data() as { email?: string; fullName?: string } | undefined;

    await notify({
      db: db as unknown as Firestore,
      userId: request.customerId,
      type: 'NEW_ORDER',
      title: 'New offer on your request',
      message: `${offer.sellerBusinessName || offer.sellerName || 'A business'} offered ${offer.currency} ${offer.price} on “${request.title}”.`,
      entityType: 'OFFER',
      entityId: offer.id,
      link: `/requests/${request.id}`,
    });
    if (profile?.email) {
      await sendTemplateEmail({
        templateKey: 'offer-received',
        vars: {
          user_name: profile.fullName || 'there',
          business_name: offer.sellerBusinessName || offer.sellerName || 'A business',
          request_title: request.title,
          amount: String(offer.price),
          currency: offer.currency,
          offer_link: appLink(`/requests/${request.id}`),
        },
        category: 'orders',
        to: profile.email,
        userId: request.customerId,
      });
    }
  } catch {
    // Non-blocking.
  }
}

export async function getMyOffer(requestId: string, sellerId: string): Promise<MarketplaceOffer | null> {
  const snap = await db
    .collection(OFFERS_COLLECTION)
    .where('requestId', '==', requestId)
    .get();
  let mine: MarketplaceOffer | null = null;
  snap.forEach((doc) => {
    const data = doc.data() as MarketplaceOffer;
    if (data.sellerId === sellerId) mine = { ...data, id: doc.id };
  });
  return mine;
}

export async function listOffersForRequest(requestId: string): Promise<MarketplaceOffer[]> {
  const snap = await db.collection(OFFERS_COLLECTION).where('requestId', '==', requestId).get();
  const offers: MarketplaceOffer[] = [];
  snap.forEach((doc) => {
    const data = doc.data() as MarketplaceOffer;
    if (data.status !== 'draft') offers.push({ ...data, id: doc.id });
  });
  offers.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  return offers;
}

export async function listOffersBySeller(sellerId: string): Promise<MarketplaceOffer[]> {
  const snap = await db.collection(OFFERS_COLLECTION).where('sellerId', '==', sellerId).get();
  const offers: MarketplaceOffer[] = [];
  snap.forEach((doc) => offers.push({ ...(doc.data() as MarketplaceOffer), id: doc.id }));
  offers.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  return offers;
}

function toMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  const ts = value as { toDate?: () => Date; seconds?: number };
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

/**
 * Accepts an offer: closes the request, marks the winner, creates the order,
 * and notifies the winning seller (in-app + email). The other offers are
 * politely declined.
 */
export async function acceptOffer(
  requestId: string,
  offerId: string,
  customerId: string,
): Promise<{ orderId: string }> {
  const reqRef = db.collection(REQUESTS_COLLECTION).doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) throw new Error('Request not found.');
  const request = reqSnap.data() as MarketplaceRequest;
  if (request.customerId !== customerId) throw new Error('Not your request.');
  if (request.status === 'closed') throw new Error('An offer was already accepted.');

  const offerRef = db.collection(OFFERS_COLLECTION).doc(offerId);
  const offerSnap = await offerRef.get();
  if (!offerSnap.exists) throw new Error('Offer not found.');
  const offer = offerSnap.data() as MarketplaceOffer;
  if (offer.requestId !== requestId) throw new Error('Offer does not belong to this request.');
  if (offer.status !== 'submitted') throw new Error('This offer cannot be accepted.');

  // Order rides the existing orders pipeline (earnings/commission triggers
  // listen on this collection).
  const orderRef = db.collection('orders').doc();
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(orderRef, {
    buyerId: customerId,
    sellerId: offer.sellerId,
    productName: request.title,
    productPrice: offer.price,
    // The whole app (buyer orders, seller dashboard, admin recent-orders table,
    // earnings) reads these canonical Order fields — an order missing them
    // crashes those screens instead of rendering.
    totalAmount: offer.price,
    subtotal: offer.price,
    shippingCost: 0,
    quantity: request.quantity ?? 1,
    currency: offer.currency,
    orderStatus: 'pending',
    fulfillmentType: 'request-marketplace',
    requestId,
    offerId,
    orderDate: now,
    createdAt: now,
    updatedAt: now,
  });
  batch.update(offerRef, { status: 'accepted', updatedAt: now });
  batch.update(reqRef, {
    status: 'closed',
    acceptedOfferId: offerId,
    acceptedOfferSellerId: offer.sellerId,
    orderId: orderRef.id,
    closedAt: now,
    updatedAt: now,
  });
  // Decline the other offers politely.
  const others = await db.collection(OFFERS_COLLECTION).where('requestId', '==', requestId).get();
  others.forEach((doc) => {
    if (doc.id !== offerId) batch.update(doc.ref, { status: 'declined', updatedAt: now });
  });  await batch.commit();

  /*
   * VPS copies of what the batch just committed (best-effort — the sale is
   * already real in Firestore). The winner, the declined losers and the
   * closed brief all move together, so the mirror never shows an open brief
   * with an accepted offer.
   */
  const mirroredAt = new Date().toISOString();
  void pbPatchOffer(offerId, { status: 'accepted', updatedAt: mirroredAt });
  others.forEach((doc) => {
    if (doc.id !== offerId) void pbPatchOffer(doc.id, { status: 'declined', updatedAt: mirroredAt });
  });
  void pbPatchRequest(requestId, {
    status: 'closed',
    acceptedOfferId: offerId,
    acceptedOfferSellerId: offer.sellerId,
    orderId: orderRef.id,
    closedAt: mirroredAt,
    updatedAt: mirroredAt,
  });
  void pbMirrorOrder(orderRef.id, {
    buyerId: customerId,
    sellerId: offer.sellerId,
    productName: request.title,
    productPrice: offer.price,
    totalAmount: offer.price,
    subtotal: offer.price,
    shippingCost: 0,
    quantity: request.quantity ?? 1,
    currency: offer.currency,
    orderStatus: 'pending',
    fulfillmentType: 'request-marketplace',
    requestId,
    offerId,
    orderDate: mirroredAt,
    createdAt: mirroredAt,
    updatedAt: mirroredAt,
  });

  void (async () => {
    try {
      const profileSnap = await db.collection('userProfiles'). doc(offer.sellerId).get();
      const profile = profileSnap.data() as { email?: string; fullName?: string } | undefined;
      await notify({
        db: db as unknown as Firestore,
        userId: offer.sellerId,
        type: 'NEW_ORDER',
        title: 'Your offer was accepted!',
        message: `${request.customerName || 'The customer'} accepted your ${offer.currency} ${offer.price} offer on “${request.title}”.`,
        entityType: 'ORDER',
        entityId: orderRef.id,
        link: '/dashboard/seller/orders',
      });
      if (profile?.email) {
        await sendTemplateEmail({
          templateKey: 'offer-accepted',
          vars: {
            user_name: profile.fullName || 'there',
            business_name: offer.sellerBusinessName || 'Your business',
            request_title: request.title,
            amount: String(offer.price),
            currency: offer.currency,
            order_link: appLink('/dashboard/seller/orders'),
          },
          category: 'orders',
          to: profile.email,
          userId: offer.sellerId,
        });
      }
    } catch {
      // Non-blocking.
    }
  })();

  return { orderId: orderRef.id };
}
