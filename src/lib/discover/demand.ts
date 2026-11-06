/**
 * DISCOVERY DEMAND — anonymous, aggregate, server-only.
 *
 * ## What is recorded
 *
 * Counts only: one counter document per (day, category, location, did-it-find-
 * anything). A counter is the entire payload — there is no query text, no IP,
 * no uid, no session id and no user agent stored, so the data cannot be traced
 * back to a person even by someone reading the collection.
 *
 * ## Why a counter collection rather than a log
 *
 * A log of every search would be a customer-activity record by another name.
 * Aggregating on write means the collection only ever answers "how many", which
 * is exactly what the admin report needs and nothing more.
 *
 * Writes are fire-and-forget: a demand counter must never be able to fail a
 * customer's search.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export const DEMAND_COLLECTION = 'discoverDemand';

export interface DemandInput {
  category?: string;
  location?: string;
  zeroResults: boolean;
}

export interface DemandDoc {
  day: string;
  category: string;
  location: string;
  zeroResults: boolean;
  count: number;
}

/** `YYYY-MM-DD` in UTC — stable across server timezones and DST. */
export function dayKey(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}

/** Firestore ids cannot contain `/`; these values come from user input. */
function safePart(value: string | undefined, fallback: string): string {
  const cleaned = (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned || fallback;
}

/** Deterministic id so every search on the same day/category/place merges. */
export function demandDocId(day: string, input: DemandInput): string {
  return [
    day,
    safePart(input.category, 'all'),
    safePart(input.location, 'anywhere'),
    input.zeroResults ? 'zero' : 'hit',
  ].join('__');
}

/**
 * Record one search. Never throws — a counter is not worth failing a request
 * for, and the caller must not have to guard it.
 */
export async function recordSearchDemand(
  db: Firestore,
  input: DemandInput,
  at: Date = new Date(),
): Promise<void> {
  try {
    const day = dayKey(at);
    await db
      .collection(DEMAND_COLLECTION)
      .doc(demandDocId(day, input))
      .set(
        {
          day,
          category: safePart(input.category, 'all'),
          location: safePart(input.location, 'anywhere'),
          zeroResults: input.zeroResults,
          count: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  } catch {
    // Silent by design: a failed counter must not surface to a customer.
  }
}

export interface DemandSummary {
  totalSearches: number;
  zeroResultSearches: number;
  byCategory: Array<{ key: string; count: number }>;
  byLocation: Array<{ key: string; count: number }>;
}

/** Pure aggregation over the counter documents (top 10 per dimension). */
export function summarizeDemand(docs: readonly DemandDoc[]): DemandSummary {
  let totalSearches = 0;
  let zeroResultSearches = 0;
  const categories = new Map<string, number>();
  const locations = new Map<string, number>();

  for (const doc of docs) {
    const count = Number.isFinite(doc.count) ? doc.count : 0;
    totalSearches += count;
    if (doc.zeroResults) zeroResultSearches += count;
    categories.set(doc.category, (categories.get(doc.category) ?? 0) + count);
    locations.set(doc.location, (locations.get(doc.location) ?? 0) + count);
  }

  const top = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

  return {
    totalSearches,
    zeroResultSearches,
    byCategory: top(categories),
    byLocation: top(locations),
  };
}
