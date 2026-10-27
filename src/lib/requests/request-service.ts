import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { notify } from '@/lib/notifications/engine';
import { sendTemplateEmail } from '@/lib/notifications/email-service';
import { appLink } from '@/lib/notifications/config';
import { findMatchingSellers } from './matching';
import { REQUESTS_COLLECTION, MEDIA_COLLECTION } from '@/lib/media/config';
import { pbMirrorRequest, pbPatchRequest } from '@/lib/pocketbase/requests';
import { getStorageAdapter } from '@/lib/media/storage-adapter';
import {
  type MarketplaceRequest,
  type CreateRequestInput,
} from './types';

/**
 * REQUEST SERVICE (spec §37).
 *
 * Owns request lifecycle: create → active → matched businesses notified →
 * offers arrive → customer accepts → closed. Media privacy and cleanup are
 * delegated to the media service.
 */

function requestNumber(): string {
  return `REQ-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

export function budgetLabel(request: Pick<MarketplaceRequest, 'currency' | 'budgetMin' | 'budgetMax'>): string {
  const cur = request.currency || 'KES';
  if (request.budgetMin && request.budgetMax) return `${cur} ${request.budgetMin} – ${request.budgetMax}`;
  if (request.budgetMax) return `up to ${cur} ${request.budgetMax}`;
  return 'Flexible';
}

/**
 * An attachment may only be bound once, by its uploader, while it is still
 * unclaimed and its file still exists. Anything else means the client is
 * replaying an id from an earlier request (whose files may already be gone).
 */
async function assertMediaClaimable(mediaIds: string[], customerId: string): Promise<void> {
  const adapter = getStorageAdapter();
  const ids = mediaIds.slice(0, 10);
  const snap = ids.length ? await db.getAll(...ids.map((id) => db.collection(MEDIA_COLLECTION).doc(id))) : [];
  if (snap.length !== ids.length) {
    throw new Error('One of your attachments could not be found. Please re-upload and try again.');
  }
  for (const doc of snap) {
    const media = doc.data() as {
      ownerId?: string;
      requestId?: string | null;
      offerId?: string | null;
      status?: string;
      storagePath?: string;
    };
    if (media.ownerId && media.ownerId !== customerId) {
      throw new Error('One of your attachments belongs to another account. Please re-upload.');
    }
    if (media.requestId || media.offerId) {
      throw new Error('One of your attachments is already attached to another request. Please re-upload.');
    }
    if (media.status !== 'READY' || !media.storagePath) {
      throw new Error('One of your attachments did not finish uploading. Please try again.');
    }
    const present = await adapter.stat(adapter.resolve(media.storagePath)).catch(() => null);
    if (!present) {
      throw new Error('One of your attachments is no longer available. Please re-upload it.');
    }
  }
}

export async function createRequest(
  customerId: string,
  input: CreateRequestInput,
  customer?: { name?: string; email?: string },
): Promise<MarketplaceRequest> {
  const title = (input.title ?? '').trim();
  const description = (input.description ?? '').trim();
  if (title.length < 5) throw new Error('Title must be at least 5 characters.');
  if (description.length < 20) throw new Error('Description must be at least 20 characters.');
  if (!input.category) throw new Error('Choose a category.');

  const now = FieldValue.serverTimestamp();

  // Validate every attachment BEFORE creating the request. An upload is
  // unclaimed until it is bound here, so we must refuse ids that are already
  // owned by another request/offer (that is how a request ended up pointing at
  // a file that was later cleaned up with the earlier request) or whose file is
  // no longer on disk.
  if (input.mediaIds && input.mediaIds.length > 0) {
    await assertMediaClaimable(input.mediaIds, customerId);
  }

  const ref = db.collection(REQUESTS_COLLECTION).doc();
  const request: MarketplaceRequest = {
    id: ref.id,
    requestNumber: requestNumber(),
    customerId,
    customerName: customer?.name,
    title,
    description,
    mediaIds: (input.mediaIds ?? []).slice(0, 7), // 5 images + 2 videos max
    category: input.category,
    quantity: input.quantity,
    budgetMin: input.budgetMin ?? null,
    budgetMax: input.budgetMax ?? null,
    currency: input.currency ?? 'KES',
    location: input.location?.trim() || undefined,
    deadline: input.deadline || null,
    status: 'active',
    offersCount: 0,
    acceptedOfferId: null,
    orderId: null,
    views: 0,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(request);

  // VPS copy of the brief (best-effort, never blocks the create): the
  // serverTimestamp sentinels have no JSON form, so the mirror is given real
  // ISO stamps instead of `now`.
  const mirroredAt = new Date().toISOString();
  void pbMirrorRequest(ref.id, {
    ...request,
    createdAt: mirroredAt,
    updatedAt: mirroredAt,
  });

  // Claim uploaded media records for this request (uploaded pre-request with
  // a placeholder ownership; now bound + marked private + SYNCED, spec §33).
  if (request.mediaIds.length > 0) {
    const batch = db.batch();
    for (const mediaId of request.mediaIds) {
      batch.update(db.collection('media').doc(mediaId), {
        requestId: ref.id,
        isPrivate: true,
        storageState: 'SYNCED',
      });
    }
    await batch.commit().catch(() => undefined);
  }

  // Fan out to matched businesses (fire-and-forget; capped for a small VPS).
  void fanOutToMatches(ref.id);

  return { ...request, id: ref.id };
}

async function fanOutToMatches(requestId: string): Promise<void> {
  const snap = await db.collection(REQUESTS_COLLECTION).doc(requestId).get();
  if (!snap.exists) return;
  const request = snap.data() as MarketplaceRequest;
  const matches = await findMatchingSellers(request, 20);
  if (matches.length === 0) return;

  const matchedSellers = matches.map((m) => m.sellerId);
  await db
    .collection(REQUESTS_COLLECTION)
    .doc(requestId)
    .update({
      matchedSellers,
      matchedAt: FieldValue.serverTimestamp(),
    })
    .catch(() => undefined);
  void pbPatchRequest(requestId, { matchedSellers, matchedAt: new Date().toISOString() });

  // Where the seller lands when they tap the notification: their own Requests
  // queue in the app with this brief already expanded (the screen reads
  // `?open=`). The email keeps pointing at the public brief page, because an
  // email reader may not be signed in to the app.
  const deepLink = `/app/seller/requests?open=${requestId}`;
  const emailLink = appLink(`/requests/${requestId}`);

  // One batched read for every matched seller's profile instead of a serialised
  // read per seller — on a 20-seller fan-out that was 20 round-trips before the
  // first notification left the building.
  const profiles = await db
    .getAll(...matches.map((m) => db.collection('userProfiles').doc(m.sellerId)))
    .catch(() => null);
  const profileById = new Map<string, { email?: string; fullName?: string }>();
  profiles?.forEach((doc) => {
    const data = doc.data() as { email?: string; fullName?: string } | undefined;
    if (data) profileById.set(doc.id, data);
  });

  for (const match of matches) {
    const profileData = profileById.get(match.sellerId);
    const categoryMatch = match.reasons.includes('category');

    // The in-app notification IS the fan-out, and it fires whether or not the
    // seller ever gave an email address. A missing email used to `continue`
    // past this call, so a whole class of sellers was silently unreachable.
    await notify({
      db: db as unknown as Firestore,
      userId: match.sellerId,
      type: 'SYSTEM',
      title: categoryMatch
        ? 'A buyer has a request in your category'
        : 'New request matches your business',
      message: categoryMatch
        ? `“${request.title}” needs ${request.category}${request.location ? ` in ${request.location}` : ''} — the same category as your shop, and it needs an answer. ${budgetLabel(request)}.`
        : `“${request.title}” needs ${request.category}${request.location ? ` in ${request.location}` : ''}. ${budgetLabel(request)}.`,
      entityType: 'REQUEST',
      entityId: requestId,
      link: deepLink,
    }).catch(() => undefined);

    if (!profileData?.email) continue;

    await sendTemplateEmail({
      templateKey: 'new-matched-request',
      vars: {
        user_name: profileData.fullName || 'there',
        business_name: match.businessName,
        request_title: request.title,
        request_category: request.category,
        request_location: request.location || '—',
        budget: budgetLabel(request),
        request_link: emailLink,
      },
      category: 'business',
      to: profileData.email,
      userId: match.sellerId,
    }).catch(() => undefined);
  }
}

export async function closeRequest(requestId: string, customerId: string): Promise<void> {
  const ref = db.collection(REQUESTS_COLLECTION).doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Request not found.');
  const request = snap.data() as MarketplaceRequest;
  if (request.customerId !== customerId) throw new Error('Not your request.');
  await ref.update({ status: 'closed', closedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  const closedAt = new Date().toISOString();
  void pbPatchRequest(requestId, { status: 'closed', closedAt, updatedAt: closedAt });
}

/**
 * Soft-deletes a request. Its media is soft-deleted too; the retention
 * sweeper hard-deletes files after VIDNOV_DELETED_MEDIA_RETENTION_DAYS.
 */
export async function deleteRequest(requestId: string, customerId: string): Promise<void> {
  const ref = db.collection(REQUESTS_COLLECTION).doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Request not found.');
  const request = snap.data() as MarketplaceRequest;
  if (request.customerId !== customerId) throw new Error('Not your request.');
  await ref.update({ status: 'deleted', closedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  const deletedAt = new Date().toISOString();
  void pbPatchRequest(requestId, { status: 'deleted', closedAt: deletedAt, updatedAt: deletedAt });
  await softDeleteRequestMedia(requestId);
}

async function softDeleteRequestMedia(requestId: string): Promise<void> {
  const snap = await db.collection('media').where('requestId', '==', requestId).get();
  const batch = db.batch();
  snap.forEach((doc) => {
    batch.update(doc.ref, { status: 'DELETED', deletedAt: FieldValue.serverTimestamp() });
  });
  await batch.commit();
}
