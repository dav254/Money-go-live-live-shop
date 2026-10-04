import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { notify } from '@/lib/notifications/engine';
import { sendTemplateEmail } from '@/lib/notifications/email-service';
import { appLink } from '@/lib/notifications/config';
import { findMatchingSellers } from './matching';
import { REQUESTS_COLLECTION, MEDIA_COLLECTION } from '@/lib/media/config';
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

  await db
    .collection(REQUESTS_COLLECTION)
    .doc(requestId)
    .update({
      matchedSellers: matches.map((m) => m.sellerId),
      matchedAt: FieldValue.serverTimestamp(),
    })
    .catch(() => undefined);

  const link = appLink(`/requests/${requestId}`);
  for (const match of matches.slice(0, 20)) {
    const profileSnap = await db.collection('userProfiles').doc(match.sellerId).get().catch(() => null);
    const profileData = profileSnap?.data() as { email?: string; fullName?: string } | undefined;
    if (!profileData?.email) continue;

    await notify({
      db: db as unknown as Firestore,
      userId: match.sellerId,
      type: 'SYSTEM',
      title: 'New request matches your business',
      message: `“${request.title}” needs ${request.category}${request.location ? ` in ${request.location}` : ''}.`,
      entityType: 'REQUEST',
      entityId: requestId,
      link: `/requests/${requestId}`,
    }).catch(() => undefined);

    await sendTemplateEmail({
      templateKey: 'new-matched-request',
      vars: {
        user_name: profileData.fullName || 'there',
        business_name: match.businessName,
        request_title: request.title,
        request_category: request.category,
        request_location: request.location || '—',
        budget: budgetLabel(request),
        request_link: link,
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
