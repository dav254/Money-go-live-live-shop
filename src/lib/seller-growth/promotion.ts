/**
 * SELLER PRODUCT GROWTH — the promotion rules, in one pure module.
 *
 * The Growth Centre has exactly two ways to promote a listing, and both of them
 * have rules that must not live in a page component:
 *
 *   FREE — distribution jobs against the Core Engine's destinations. Which
 *          destinations are offerable is decided by `canSubmit()`, which is
 *          derived from credential PRESENCE only. A free campaign can never
 *          claim indexing or reach; it can only record what actually happened.
 *
 *   PAID — a points-priced boost request, reviewed by an administrator. The
 *          price is arithmetic (`POINTS_PER_DAY × days`) and is charged only
 *          after the balance has been read in a transaction — never on the
 *          client's word, and never before the points exist.
 *
 * Everything here is pure so the page, the route and the tests all agree on one
 * answer. Nothing here reads env, Firestore or a network.
 */

import type { ChannelId } from '@/lib/vidnov-core/types';

/** What one boosted day costs, in the same points the ads screen already uses. */
export const POINTS_PER_DAY = 100;

/** Bounds on a boost — a request, not an open-ended spend. */
export const MIN_PAID_DAYS = 1;
export const MAX_PAID_DAYS = 30;

/** Caps on a free campaign, so one click cannot fan out into hundreds of jobs. */
export const MAX_PRODUCTS_PER_CAMPAIGN = 20;
export const MAX_CHANNELS_PER_CAMPAIGN = 8;

/** Caption limits: long enough for a real description, short enough to post. */
export const CAPTION_MAX = 280;

export type DestinationGroup = 'vidnov' | 'search' | 'commerce';

/**
 * Which of the three seller-facing groups a destination belongs to.
 *
 * This is presentation only — the engine does not care. It exists because the
 * page must show "Vidnov / Search engines / Commerce feeds" as three separate
 * choices, and a channel id alone does not say which.
 */
export const DESTINATION_GROUP: Partial<Record<ChannelId, DestinationGroup>> = {
  // Our own surfaces: no credentials, always available.
  sitemap: 'vidnov',
  // URL submission and webmaster consoles.
  indexnow: 'search',
  bing: 'search',
  search_console: 'search',
  // Product feeds that publish into a marketplace.
  google: 'commerce',
  meta: 'commerce',
  tiktok: 'commerce',
  // `ga` is a measurement connection and takes no per-listing jobs, so it has
  // no seller-facing group; the default below only covers that case.
};

export function destinationGroup(channel: ChannelId): DestinationGroup {
  return DESTINATION_GROUP[channel] ?? 'vidnov';
}

/** A duration the seller may actually ask for, or null when out of bounds. */
export function normaliseDurationDays(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  const days = Math.round(parsed);
  if (days < MIN_PAID_DAYS || days > MAX_PAID_DAYS) return null;
  return days;
}

/** `POINTS_PER_DAY × days` — always a whole number of points. */
export function promotionCostPoints(days: number): number {
  const safeDays = Math.min(MAX_PAID_DAYS, Math.max(MIN_PAID_DAYS, Math.round(days) || MIN_PAID_DAYS));
  return safeDays * POINTS_PER_DAY;
}

/** Balance check that tolerates a missing or non-numeric stored balance. */
export function canAfford(balance: unknown, cost: number): boolean {
  const value = typeof balance === 'number' ? balance : Number(balance);
  if (!Number.isFinite(value)) return false;
  return value >= cost;
}

/** Why a paid boost cannot be submitted right now, or null when it can. */
export function paidBlockReason(input: {
  balance: unknown;
  cost: number;
  eligible: boolean;
  hasImage: boolean;
}): string | null {
  if (!input.eligible) return 'This listing is not eligible for promotion yet.';
  if (!input.hasImage) return 'Add a photo before boosting — a boost without one cannot be shown.';
  if (!canAfford(input.balance, input.cost)) {
    return `You need ${input.cost.toLocaleString()} points for this boost.`;
  }
  return null;
}

/**
 * The caption a seller starts from.
 *
 * Deliberately plain: product name, price when there is one, and nothing that
 * promises reach. The seller edits it; the API stores what they sent, trimmed
 * and capped, never a template the server invented afterwards.
 */
export function defaultCaption(product: {
  name?: string | null;
  price?: number | null;
  currency?: string | null;
}): string {
  const name = (product.name ?? '').trim() || 'New on Vidnov';
  const price = typeof product.price === 'number' && Number.isFinite(product.price) ? product.price : null;
  const currency = (product.currency ?? '').trim().toUpperCase();
  const pricePart =
    price === null ? '' : ` — ${currency ? `${currency} ` : ''}${price.toLocaleString()}`;
  return `${name}${pricePart}`.slice(0, CAPTION_MAX);
}

/** Trims, collapses whitespace and caps a seller-supplied caption. */
export function normaliseCaption(value: unknown, fallback = ''): string {
  const text = typeof value === 'string' ? value : '';
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return (collapsed || fallback).slice(0, CAPTION_MAX);
}

/**
 * A campaign selection: unique, ordered, capped.
 *
 * Duplicates are dropped rather than rejected — a double tap in a list should
 * not fail a campaign. Order is preserved so the UI's summary matches what the
 * seller picked.
 */
export function normaliseSelection(ids: readonly unknown[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= cap) break;
  }
  return out;
}

/** What the API reports per (product × destination) pair. */
export type FreeJobSkipReason =
  | 'not_configured'
  | 'not_job_eligible'
  | 'not_owned'
  | 'not_eligible'
  | 'create_failed';

/**
 * The submit gate for one free destination.
 *
 * A destination that is not configured is SKIPPED with a reason, never queued:
 * the engine would only park it at `ready` and the seller would read that as
 * "sent". Sitemap is configured by construction, so the free path always has at
 * least one real destination.
 */
export function freeSubmitBlock(input: {
  jobEligible: boolean;
  configured: boolean;
  productEligible: boolean;
}): FreeJobSkipReason | null {
  if (!input.jobEligible) return 'not_job_eligible';
  if (!input.productEligible) return 'not_eligible';
  if (!input.configured) return 'not_configured';
  return null;
}

/** Human explanation for a skipped destination, safe to show a seller. */
export function skipReasonText(reason: FreeJobSkipReason): string {
  switch (reason) {
    case 'not_configured':
      return 'Not available yet on Vidnov — the platform has not finished connecting this destination.';
    case 'not_job_eligible':
      return 'This destination does not take individual listings.';
    case 'not_owned':
      return 'This listing is not on your account.';
    case 'not_eligible':
      return 'This listing is not public, has no photo, or is missing a price.';
    case 'create_failed':
      return 'The job could not be created. Try again.';
    default:
      return 'Skipped.';
  }
}
