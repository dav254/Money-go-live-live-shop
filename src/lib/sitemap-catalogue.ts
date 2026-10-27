/**
 * SITEMAP CATALOGUE — which listing ids the public sitemap is allowed to emit.
 *
 * ## Source order (requirement: the sitemap survives a Firestore outage)
 *   1. **PocketBase** (the VPS mirror) — preferred. The mirror rows carry the
 *      FULL document, so the app's own visibility rules can be applied
 *      without touching Firestore. A Firestore `RESOURCE_EXHAUSTED` quota
 *      error never reaches this path.
 *   2. **Firestore** — fallback when PocketBase is disabled, unreachable, or
 *      returning an EMPTY catalogue. Writes flow Firestore → mirror, so an
 *      empty mirror means "backfill never ran", not "no products exist";
 *      falling through keeps the sitemap honest without duplicating stores.
 *   3. **`null`** — no catalogue available. The route then serves the
 *      homepage-only core document. We never fabricate ids and never claim a
 *      catalogue is complete when it is not.
 *
 * ## Visibility — existing rules only, not new ones
 * `isVisiblyHidden` (shared with the distribution engine, unit-tested there)
 * answers "is this listing publicly listed": explicit opt-outs (`hidden`,
 * `archived`, `isActive:false`, `listed:false`, `visibility:'private'`) and
 * hidden/draft/archived/unpublished/removed statuses exclude. Mirror
 * tombstones (`status='deleted'`) are excluded server-side AND re-checked
 * here. A mirror row whose `data` payload is missing cannot be verified, so
 * it is never listed. Seller ids must be the app's `fsId` (the Firestore doc
 * id) — a mirror row id would produce a URL for a page that does not exist.
 *
 * Accounts the admins suspended are excluded best-effort via one small
 * `user_profiles` deny-set query; if that query fails, listing continues
 * WITHOUT the deny-set rather than blocking discovery. Suspension is an
 * account-access rule (login), so this is a conservative discovery choice —
 * the pages themselves stay reachable either way.
 *
 * ## Limits
 * Caps keep the document far under the sitemap protocol ceiling (50,000 URLs
 * / 50 MB per file); `buildSitemapEntries` additionally slices the final
 * list. Pagination walks PocketBase at its own page size (500) with a hard
 * page-count stop, so a mis-reported `totalItems` cannot loop forever.
 *
 * Server-only (talks to PocketBase). The PocketBase path imports nothing
 * from Firestore.
 */

import { pocketBaseEnabled, pbListRecordsPage } from './pocketbase/server';
import { PRODUCTS_COLLECTION } from './pocketbase/products';
import { SHOPS_COLLECTION } from './pocketbase/shops';
import { USER_PROFILES_COLLECTION } from './pocketbase/profiles';
import { isVisiblyHidden } from './vidnov-core/distribution/eligibility';

/** Caps per collection — the final list is also sliced to 5,000 entries. */
export const SITEMAP_MAX_PRODUCTS = 4000;
export const SITEMAP_MAX_SHOPS = 1000;

/** PocketBase's page ceiling: 500 × MAX_PAGES records read per collection. */
const PAGE_SIZE = 500;
const MAX_PAGES = 40;
/** A deny-set larger than this would be suspicious; stop collecting uids. */
const MAX_SUSPENDED = 2000;

export interface CatalogueIds {
  productIds: string[];
  shopIds: string[];
  /** ISO lastmod per id, when the record carries one. */
  updatedAtById: Record<string, string>;
  source: 'pocketbase' | 'firestore';
}

/** One page of records as the catalogue reader sees it (injectable in tests). */
export interface CataloguePage {
  items: Record<string, unknown>[];
  totalItems: number;
}

export type PageFetcher = (
  collection: string,
  params: { page: number; perPage: number; filter?: string; sort?: string; fields?: string },
) => Promise<CataloguePage>;

interface Candidate {
  id: string;
  ownerId?: string;
  lastModified?: string;
}

/* --------------------------------------------------------------------------- */
/* Visibility helpers (shared by the PocketBase and Firestore paths)           */
/* --------------------------------------------------------------------------- */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** ISO stamp from an ISO string or a Firestore Timestamp-shaped object. */
function isoStamp(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return /^\d{4}-\d{2}-\d{2}T/.test(value) ? value : undefined;
  }
  const maybe = asRecord(value);
  if (maybe && typeof maybe.toDate === 'function') {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * The single public-visibility answer for one full listing document —
 * Firestore doc or the mirror's merged view alike. Tombstones and any
 * explicit opt-out mean "not listable".
 */
export function isPublicListingDoc(doc: Record<string, unknown>): boolean {
  if (doc.status === 'deleted') return false;
  return !isVisiblyHidden(doc);
}

/**
 * A mirror row as the app-shaped document, or null when the row cannot be
 * verified as public (tombstone, opt-out flag, or missing `data` payload).
 * The column `status` is the mirror's own lifecycle (active/deleted); the
 * app-level status lives inside `data` when the seller set one.
 */
function productDoc(record: Record<string, unknown>): Record<string, unknown> | null {
  const data = asRecord(record.data);
  if (!data) return null;
  const doc = typeof data.status === 'string' ? data : { ...data, status: record.status };
  return isPublicListingDoc(doc) ? doc : null;
}

/* --------------------------------------------------------------------------- */
/* Pagination                                                                  */
/* --------------------------------------------------------------------------- */

async function collectPages(
  fetchPage: PageFetcher,
  collection: string,
  opts: {
    max: number;
    filter?: string;
    sort?: string;
    toCandidate: (record: Record<string, unknown>) => Candidate | null;
  },
): Promise<Candidate[]> {
  const out: Candidate[] = [];
  let page = 1;
  for (;;) {
    const { items, totalItems } = await fetchPage(collection, {
      page,
      perPage: PAGE_SIZE,
      filter: opts.filter,
      sort: opts.sort,
    });
    for (const record of items) {
      if (out.length >= opts.max) return out;
      const candidate = opts.toCandidate(record);
      if (!candidate) continue;
      const updated = str(record.updated);
      out.push(candidate.lastModified || !updated ? candidate : { ...candidate, lastModified: updated });
    }
    if (items.length === 0) break; // short/empty page: collection exhausted
    if (page * PAGE_SIZE >= totalItems) break;
    if (page >= MAX_PAGES) break; // hard stop against a lying totalItems
    page += 1;
  }
  return out;
}

/**
 * Uids of suspended accounts — the deny-set for listing owners. Returns null
 * when the read fails (collection missing, column missing, PB down), which
 * means "no deny-set", never "block the sitemap".
 */
export async function readSuspendedUids(fetchPage: PageFetcher): Promise<Set<string> | null> {
  try {
    const uids = new Set<string>();
    let page = 1;
    for (;;) {
      const { items, totalItems } = await fetchPage(USER_PROFILES_COLLECTION, {
        page,
        perPage: PAGE_SIZE,
        filter: "status = 'suspended'",
        fields: 'uid',
      });
      for (const record of items) {
        const uid = str(record.uid);
        if (uid) uids.add(uid);
        if (uids.size >= MAX_SUSPENDED) return uids;
      }
      if (items.length === 0 || page * PAGE_SIZE >= totalItems || page >= MAX_PAGES) break;
      page += 1;
    }
    return uids;
  } catch (error) {
    console.warn('[sitemap] suspended-owner deny-set unavailable:', errorMessage(error));
    return null;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/* --------------------------------------------------------------------------- */
/* PocketBase path                                                             */
/* --------------------------------------------------------------------------- */

/** The real PocketBase-backed page reader (server-only, used by the route). */
export const pbPageFetcher: PageFetcher = (collection, params) =>
  pbListRecordsPage(collection, params);

/**
 * The catalogue straight from PocketBase, or null when PocketBase is off or
 * the read failed. Never throws; never writes (no collection is created from
 * the read path).
 *
 * The env-var gate applies only to the REAL client: an injected `fetchPage`
 * (tests) bypasses configuration, and an unconfigured real client fails fast
 * inside `pbRequest` anyway — either way the caller gets null, never a throw.
 */
export async function readPocketBaseCatalogue(
  fetchPage?: PageFetcher,
): Promise<CatalogueIds | null> {
  if (!fetchPage) {
    if (!pocketBaseEnabled()) return null;
    fetchPage = pbPageFetcher;
  }
  try {
    const products = await collectPages(fetchPage, PRODUCTS_COLLECTION, {
      max: SITEMAP_MAX_PRODUCTS,
      filter: "status != 'deleted'",
      sort: '-createdAt',
      toCandidate: (record) => {
        const doc = productDoc(record);
        if (!doc) return null;
        // fsId is the Firestore doc id → the id `/products/{id}` resolves.
        // A mirror row id would 404, so a row without fsId is never listed.
        const id = str(record.fsId);
        if (!id) return null;
        return { id, ownerId: str(doc.sellerId) ?? str(record.sellerId), lastModified: isoStamp(doc.updatedAt) };
      },
    });

    const shops = await collectPages(fetchPage, SHOPS_COLLECTION, {
      max: SITEMAP_MAX_SHOPS,
      toCandidate: (record) => {
        const data = asRecord(record.data);
        if (!data || !isPublicListingDoc(data)) return null;
        // sellerShops/{uid}: fsId IS the owner uid (see pocketbase/shops).
        const ownerId = str(record.ownerId) ?? str(data.ownerId) ?? str(record.fsId);
        if (!ownerId) return null;
        return { id: ownerId, ownerId, lastModified: isoStamp(data.updatedAt) };
      },
    });

    const suspended = await readSuspendedUids(fetchPage);
    const allowed = (c: Candidate) => !suspended || !c.ownerId || !suspended.has(c.ownerId);

    const productIds: string[] = [];
    const shopIds: string[] = [];
    const updatedAtById: Record<string, string> = {};
    for (const candidate of products) {
      if (!allowed(candidate)) continue;
      productIds.push(candidate.id);
      if (candidate.lastModified) updatedAtById[candidate.id] = candidate.lastModified;
    }
    for (const candidate of shops) {
      if (!allowed(candidate)) continue;
      shopIds.push(candidate.id);
      if (candidate.lastModified) updatedAtById[candidate.id] = candidate.lastModified;
    }

    return { productIds, shopIds, updatedAtById, source: 'pocketbase' };
  } catch (error) {
    // Collection missing (404), auth failure, network down — the caller
    // falls back to Firestore. Log the reason, never the credentials.
    console.error('[sitemap] PocketBase catalogue read failed:', errorMessage(error));
    return null;
  }
}

/* --------------------------------------------------------------------------- */
/* Source orchestration                                                        */
/* --------------------------------------------------------------------------- */

export interface CatalogueSources {
  fromPocketBase?: () => Promise<CatalogueIds | null>;
  fromFirestore?: () => Promise<CatalogueIds | null>;
}

const hasEntries = (c: CatalogueIds) => c.productIds.length > 0 || c.shopIds.length > 0;

async function attempt(load?: () => Promise<CatalogueIds | null>): Promise<CatalogueIds | null> {
  if (!load) return null;
  try {
    return await load();
  } catch (error) {
    // Includes Firestore quota errors (RESOURCE_EXHAUSTED): a source that
    // throws is a source that produced nothing — keep going.
    console.error('[sitemap] catalogue source failed:', errorMessage(error));
    return null;
  }
}

/**
 * PocketBase first, Firestore second, `null` when neither can serve a
 * catalogue (→ homepage-only core document). An EMPTY successful source
 * falls through to the next one; if every source is empty, the truthful
 * empty catalogue is returned (homepage only — no invented listings).
 */
export async function resolveCatalogue(sources: CatalogueSources): Promise<CatalogueIds | null> {
  const pocketbase = await attempt(sources.fromPocketBase);
  if (pocketbase && hasEntries(pocketbase)) return pocketbase;
  if (pocketbase) {
    console.warn('[sitemap] PocketBase catalogue empty — falling back to Firestore');
  }
  const firestore = await attempt(sources.fromFirestore);
  if (firestore && hasEntries(firestore)) return firestore;
  return pocketbase ?? firestore ?? null;
}
