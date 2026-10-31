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
    // Every brief is open for 30 days from the moment it is posted; the
    // customer can renew it (see `renewRequest`) and the expiry sweep sends
    // the 48-hour notice exactly once.
    expiresAt: expiryFor(new Date()),
    renewCount: 0,
    expiryNoticeAt: null,
    fulfilment: input.fulfilment ?? undefined,
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

async function fanOutToMatches(requestId: string, options?: { onlyNew?: boolean }): Promise<void> {
  const snap = await db.collection(REQUESTS_COLLECTION).doc(requestId).get();
  if (!snap.exists) return;
  const request = snap.data() as MarketplaceRequest;
  const matches = await findMatchingSellers(request, 20);
  if (matches.length === 0) return;

  const alreadyMatched = new Set(request.matchedSellers ?? []);
  // Renewals only ever notify the sellers this brief has NOT reached yet —
  // re-alerting the same shops on every renewal is exactly the duplicate
  // notification this system must avoid.
  const fresh = options?.onlyNew ? matches.filter((m) => !alreadyMatched.has(m.sellerId)) : matches;
  if (fresh.length === 0) return;

  const matchedSellers = [...new Set([...(options?.onlyNew ? [...alreadyMatched] : []), ...matches.map((m) => m.sellerId)])];
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
    .getAll(...fresh.map((m) => db.collection('userProfiles').doc(m.sellerId)))
    .catch(() => null);
  const profileById = new Map<string, { email?: string; fullName?: string }>();
  profiles?.forEach((doc) => {
    const data = doc.data() as { email?: string; fullName?: string } | undefined;
    if (data) profileById.set(doc.id, data);
  });

  for (const match of fresh) {
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

/* ── Lifecycle: edit · renew · report · expiry sweep ─────────────────────── */

/** Every fresh brief is open this long; `renewRequest` resets the clock. */
export const REQUEST_TTL_DAYS = 30;
/** The customer is warned this far ahead — exactly once per renewal cycle. */
export const EXPIRY_NOTICE_WINDOW_MS = 48 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function expiryFor(now: Date): string {
  return new Date(now.getTime() + REQUEST_TTL_DAYS * DAY_MS).toISOString();
}

/**
 * Derived expiry: the stored status stays `active` (no new state to render
 * in every existing screen) and every consumer filters through this helper.
 */
export function isExpired(request: Pick<MarketplaceRequest, 'status' | 'expiresAt'>): boolean {
  if (request.status !== 'active' || !request.expiresAt) return false;
  const at = Date.parse(request.expiresAt);
  return Number.isFinite(at) && at <= Date.now();
}

function msOf(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  const ts = value as { toDate?: () => Date; seconds?: number };
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

function assertFulfilment(value: string | undefined): 'delivery' | 'collection' | 'either' | undefined {
  if (value === undefined || value === '') return undefined;
  if (value === 'delivery' || value === 'collection' || value === 'either') return value;
  throw new Error('Choose delivery, collection or either.');
}

/**
 * Owner-only edit of a brief's text fields. Attachments are deliberately NOT
 * editable here: media ids are claimed once at creation (see
 * `assertMediaClaimable`) and re-binding them is a re-upload, not a patch.
 * A brief that already produced an accepted offer can never be edited.
 */
export async function editRequest(
  requestId: string,
  customerId: string,
  input: Partial<CreateRequestInput>,
): Promise<MarketplaceRequest> {
  const ref = db.collection(REQUESTS_COLLECTION).doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Request not found.');
  const request = snap.data() as MarketplaceRequest;
  if (request.customerId !== customerId) throw new Error('Not your request.');
  if (request.status === 'deleted') throw new Error('Request not found.');
  if (request.acceptedOfferId) throw new Error('A deal is already agreed — this request can no longer be edited.');

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (title.length < 5) throw new Error('Title must be at least 5 characters.');
    patch.title = title;
  }
  if (input.description !== undefined) {
    const description = input.description.trim();
    if (description.length < 20) throw new Error('Description must be at least 20 characters.');
    patch.description = description;
  }
  if (input.category !== undefined) {
    if (!input.category) throw new Error('Choose a category.');
    patch.category = input.category;
  }
  if (input.location !== undefined) patch.location = input.location.trim() || null;
  if (input.deadline !== undefined) patch.deadline = input.deadline || null;
  if (input.fulfilment !== undefined) patch.fulfilment = assertFulfilment(input.fulfilment) ?? null;
  if (input.quantity !== undefined) {
    const q = Number(input.quantity);
    if (!Number.isFinite(q) || q < 1) throw new Error('Enter a valid quantity.');
    patch.quantity = Math.min(Math.floor(q), 1_000_000);
  }
  if (input.budgetMin !== undefined) patch.budgetMin = numberOrNull(input.budgetMin, 'budgetMin');
  if (input.budgetMax !== undefined) patch.budgetMax = numberOrNull(input.budgetMax, 'budgetMax');

  const nextMin = 'budgetMin' in patch ? (patch.budgetMin as number | null) : request.budgetMin ?? null;
  const nextMax = 'budgetMax' in patch ? (patch.budgetMax as number | null) : request.budgetMax ?? null;
  if (nextMin !== null && nextMax !== null && nextMin > nextMax) {
    throw new Error('Minimum budget cannot exceed the maximum.');
  }

  if (Object.keys(patch).length === 0) return request;
  patch.updatedAt = FieldValue.serverTimestamp();
  await ref.update(patch);

  const mirrored: Record<string, unknown> = { ...patch };
  delete mirrored.updatedAt;
  void pbPatchRequest(requestId, { ...mirrored, updatedAt: new Date().toISOString() });
  return { ...request, ...(patch as Partial<MarketplaceRequest>), updatedAt: Date.now() };
}

function numberOrNull(value: number | null | undefined, field: string): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Enter a valid ${field === 'budgetMin' ? 'minimum' : 'maximum'} budget.`);
  return Math.min(n, 1_000_000_000);
}

/**
 * Owner-only renewal: reopens an expired (or customer-closed, unfilled)
 * brief for another 30 days. It re-fans-out ONLY to sellers the brief has
 * never reached, so a renewal can never duplicate a notification.
 */
export async function renewRequest(requestId: string, customerId: string): Promise<MarketplaceRequest> {
  const ref = db.collection(REQUESTS_COLLECTION).doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Request not found.');
  const request = snap.data() as MarketplaceRequest;
  if (request.customerId !== customerId) throw new Error('Not your request.');
  if (request.status === 'deleted') throw new Error('Request not found.');
  if (request.acceptedOfferId) throw new Error('This request was fulfilled — post a new one instead.');

  const current = request.expiresAt ? Date.parse(request.expiresAt) : 0;
  if (request.status === 'active' && Number.isFinite(current) && current > Date.now()) {
    throw new Error(`Still open — you can renew it after ${new Date(current).toISOString().slice(0, 10)}.`);
  }

  const expiresAt = expiryFor(new Date());
  const patch = {
    status: 'active' as const,
    expiresAt,
    renewCount: (request.renewCount ?? 0) + 1,
    expiryNoticeAt: null,
    closedAt: null,
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.update(patch);
  void pbPatchRequest(requestId, {
    status: 'active',
    expiresAt,
    renewCount: patch.renewCount,
    expiryNoticeAt: null,
    updatedAt: new Date().toISOString(),
  });

  // Fresh audience only — see `fanOutToMatches(…, { onlyNew: true })`.
  void fanOutToMatches(requestId, { onlyNew: true });
  return { ...request, ...patch, id: requestId };
}

/**
 * Report a brief the customer did not post (spam/scam). One report per uid,
 * bounded reasons, never self-reportable — the admin queue reads `reports`.
 */
export async function reportRequest(requestId: string, reporterId: string, reason: string): Promise<void> {
  const text = (reason ?? '').trim().slice(0, 200);
  if (text.length < 5) throw new Error('Add a short reason for the report.');
  const ref = db.collection(REQUESTS_COLLECTION).doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Request not found.');
  const request = snap.data() as MarketplaceRequest;
  if (request.status === 'deleted') throw new Error('Request not found.');
  if (request.customerId === reporterId) throw new Error('You cannot report your own request.');

  const reports = Array.isArray(request.reports) ? request.reports : [];
  if (reports.some((r) => r.by === reporterId)) return; // idempotent — no duplicates
  if (reports.length >= 10) return; // bounded — the queue is capped, not a free-form store
  await ref.update({
    reports: [...reports, { by: reporterId, reason: text, at: new Date().toISOString() }],
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function notifyExpiry(request: MarketplaceRequest): Promise<void> {
  try {
    const profileSnap = await db.collection('userProfiles').doc(request.customerId).get();
    const profile = profileSnap.data() as { email?: string; fullName?: string } | undefined;
    const expiresOn = (request.expiresAt ?? '').slice(0, 10);
    await notify({
      db: db as unknown as Firestore,
      userId: request.customerId,
      type: 'SYSTEM',
      title: 'Your request is expiring soon',
      message: `“${request.title}” stops accepting offers on ${expiresOn}. Renew it to keep receiving offers.`,
      entityType: 'REQUEST',
      entityId: request.id,
      link: `/requests/${request.id}`,
    }).catch(() => undefined);
    if (profile?.email) {
      await sendTemplateEmail({
        templateKey: 'request-expiring',
        vars: {
          user_name: profile.fullName || 'there',
          request_title: request.title,
          expires_on: expiresOn,
          offers_count: String(request.offersCount ?? 0),
          request_link: appLink(`/requests/${request.id}`),
        },
        category: 'business',
        to: profile.email,
        userId: request.customerId,
      }).catch(() => undefined);
    }
  } catch {
    // Non-blocking: a missing profile must never fail the sweep.
  }
}

export interface ExpirySweepReport {
  scanned: number;
  noticesSent: number;
  backfilled: number;
}

/**
 * Bounded expiry pass (spec §7): backfills missing `expiresAt` values and
 * sends the 48-hour notice EXACTLY once per cycle (`expiryNoticeAt` guard).
 * Expired briefs are never rewritten — every consumer derives expiry through
 * `isExpired()`, so there is one source of truth and no status drift.
 * Best-effort by contract: a failed sweep returns partial counts, never throws.
 */
export async function runExpirySweep(nowMs: number = Date.now()): Promise<ExpirySweepReport> {
  const report: ExpirySweepReport = { scanned: 0, noticesSent: 0, backfilled: 0 };
  try {
    // Single-field query (no composite index required); the age filter runs
    // in-memory over a bounded window, matching every other scan here.
    const snap = await db.collection(REQUESTS_COLLECTION).where('status', '==', 'active').limit(200).get();
    report.scanned = snap.size;
    for (const doc of snap.docs) {
      const request = { ...(doc.data() as MarketplaceRequest), id: doc.id };
      if (request.acceptedOfferId) continue;

      if (!request.expiresAt) {
        const base = msOf(request.createdAt) || nowMs;
        const expiresAt = new Date(base + REQUEST_TTL_DAYS * DAY_MS).toISOString();
        await doc.ref.update({ expiresAt, updatedAt: FieldValue.serverTimestamp() }).catch(() => undefined);
        void pbPatchRequest(doc.id, { expiresAt });
        report.backfilled += 1;
        continue;
      }

      const at = Date.parse(request.expiresAt);
      if (!Number.isFinite(at)) continue;
      const remaining = at - nowMs;
      if (remaining <= 0) continue; // expired — derived at read time
      if (remaining <= EXPIRY_NOTICE_WINDOW_MS && !request.expiryNoticeAt) {
        await doc.ref.update({ expiryNoticeAt: new Date(nowMs).toISOString() }).catch(() => undefined);
        await notifyExpiry(request);
        report.noticesSent += 1;
      }
    }
  } catch {
    // Best-effort: the report already carries whatever was processed.
  }
  return report;
}
