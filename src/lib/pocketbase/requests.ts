/**
 * The request marketplace on PocketBase — buyer briefs (`requests`) and the
 * seller offers on them (`offers`), mirrored to the VPS.
 *
 * Why this section: the brief → offer → accept → order flow is one of the few
 * parts of the product where a Firestore outage does not merely hide data —
 * it silently erases a seller's ability to answer a paying customer's brief.
 * The order the flow produces was already mirrored (`pocketbase/orders`); the
 * brief and the offers that led to it were not, so a VPS-side picture of a
 * sale arrived with no history behind it.
 *
 * Same migration rules as every other section here:
 *   • Firestore stays the source of truth — these helpers are a mirror.
 *   • Helpers return false when PocketBase is not configured and NEVER throw:
 *     a failed mirror must not fail a customer's request or a seller's offer.
 *   • Records are keyed by `fsId` (the Firestore doc id), so the mirror is
 *     re-runnable and always reconcilable with the real document.
 */

import {
  ensureCollection,
  pbCreateRecord,
  pbListRecords,
  pocketBaseEnabled,
  pbRequest,
  scrubForPocketBase,
  type PbField,
  type PbRecord,
} from './server';

export const REQUESTS_COLLECTION = 'requests';
export const OFFERS_COLLECTION = 'offers';

const REQUEST_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true }, // Firestore doc id — re-runnable mirror
  { name: 'requestNumber', type: 'text' },
  { name: 'customerId', type: 'text' },
  { name: 'customerName', type: 'text' },
  { name: 'title', type: 'text' },
  { name: 'description', type: 'text' },
  { name: 'mediaIds', type: 'json' },
  { name: 'category', type: 'text' },
  { name: 'quantity', type: 'number' },
  { name: 'budgetMin', type: 'number' },
  { name: 'budgetMax', type: 'number' },
  { name: 'currency', type: 'text' },
  { name: 'location', type: 'text' },
  // Free-text from the brief form — kept as text, never parsed as a date.
  { name: 'deadline', type: 'text' },
  { name: 'status', type: 'text' },
  { name: 'offersCount', type: 'number' },
  { name: 'acceptedOfferId', type: 'text' },
  { name: 'orderId', type: 'text' },
  { name: 'views', type: 'number' },
  { name: 'matchedSellers', type: 'json' },
  { name: 'matchedAt', type: 'date' },
  { name: 'closedAt', type: 'date' },
  { name: 'createdAt', type: 'date' },
  { name: 'updatedAt', type: 'date' },
];

const OFFER_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true },
  { name: 'requestId', type: 'text' },
  { name: 'sellerId', type: 'text' },
  { name: 'sellerName', type: 'text' },
  { name: 'sellerBusinessName', type: 'text' },
  { name: 'price', type: 'number' },
  { name: 'currency', type: 'text' },
  { name: 'message', type: 'text' },
  { name: 'deliveryDays', type: 'number' },
  { name: 'mediaIds', type: 'json' },
  { name: 'status', type: 'text' },
  { name: 'createdAt', type: 'date' },
  { name: 'updatedAt', type: 'date' },
];

const esc = (value: string) => value.replace(/'/g, "\\'");

async function findByFsId(collection: string, fsId: string): Promise<PbRecord | null> {
  const rows = await pbListRecords(collection, {
    filter: `fsId = '${esc(fsId)}'`,
    perPage: 1,
  });
  return rows[0] ?? null;
}

/**
 * Create-or-merge one mirror row. `scrubForPocketBase` converts Firestore
 * Timestamps and plain Dates to ISO strings and drops FieldValue sentinels
 * (`serverTimestamp()` has no JSON form — it must never reach the wire).
 */
async function upsert(
  collection: string,
  fields: PbField[],
  fsId: string,
  data: object,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    await ensureCollection(collection, fields);
    const clean = scrubForPocketBase(data) as Record<string, unknown>;
    const existing = await findByFsId(collection, fsId);
    const body = JSON.stringify({ fsId, ...clean });
    if (existing) {
      // PocketBase PATCH merges — a partial payload (a counter bump, a status
      // change) leaves every other column intact.
      const res = await pbRequest(
        `/api/collections/${collection}/records/${existing.id}`,
        { method: 'PATCH', body },
      );
      return res.ok;
    }
    await pbCreateRecord(collection, { fsId, ...clean });
    return true;
  } catch (error) {
    console.error(`[pocketbase] ${collection} mirror failed:`, error);
    return false;
  }
}

/* --------------------------------------------------------------------------- */
/* Requests (buyer briefs)                                                     */
/* --------------------------------------------------------------------------- */

/** Mirrors a full request document — called on create and on every lifecycle change. */
export async function pbMirrorRequest(fsId: string, data: object): Promise<boolean> {
  return upsert(REQUESTS_COLLECTION, REQUEST_FIELDS, fsId, data);
}

/**
 * Merges a partial update (status flip, offersCount, view bump) into the
 * mirror. Creates a stub row keyed by `fsId` when the mirror is missing, so a
 * counter written while PocketBase was down still converges instead of being
 * lost forever.
 */
export async function pbPatchRequest(fsId: string, patch: object): Promise<boolean> {
  return upsert(REQUESTS_COLLECTION, REQUEST_FIELDS, fsId, patch);
}

/* --------------------------------------------------------------------------- */
/* Offers (seller replies)                                                     */
/* --------------------------------------------------------------------------- */

export async function pbMirrorOffer(fsId: string, data: object): Promise<boolean> {
  return upsert(OFFERS_COLLECTION, OFFER_FIELDS, fsId, data);
}

export async function pbPatchOffer(fsId: string, patch: object): Promise<boolean> {
  return upsert(OFFERS_COLLECTION, OFFER_FIELDS, fsId, patch);
}

/* --------------------------------------------------------------------------- */
/* Counters                                                                     */
/* --------------------------------------------------------------------------- */

/** The request fields Firestore writes as `FieldValue.increment`. */
export type RequestCounter = 'offersCount' | 'views';

/**
 * Read-modify-write bump for a mirror counter, mirroring Firestore's
 * `FieldValue.increment(delta)`: read the current mirror value, add, write.
 * Both happen on the VPS, so the whole sequence is local and atomic enough
 * for a display counter — the Firestore document remains the real number.
 */
export async function pbBumpRequestCounter(
  fsId: string,
  field: RequestCounter,
  delta: number,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    await ensureCollection(REQUESTS_COLLECTION, REQUEST_FIELDS);
    const existing = await findByFsId(REQUESTS_COLLECTION, fsId);
    const current =
      existing && typeof existing[field] === 'number' && Number.isFinite(existing[field])
        ? existing[field]
        : 0;
    const next = Math.max(0, current + delta);
    if (existing) {
      const res = await pbRequest(
        `/api/collections/${REQUESTS_COLLECTION}/records/${existing.id}`,
        { method: 'PATCH', body: JSON.stringify({ [field]: next }) },
      );
      return res.ok;
    }
    await pbCreateRecord(REQUESTS_COLLECTION, { fsId, [field]: next });
    return true;
  } catch (error) {
    console.error(`[pocketbase] request counter ${field} failed:`, error);
    return false;
  }
}
