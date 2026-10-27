/**
 * GROWTH FUNNEL — exposure → visit → enquiry → offer → order, read from
 * REAL data only (Stage 2 E/F).
 *
 * What existed before this module: per-destination counters (views, share
 * clicks, attributed orders) and nothing that connected them to what the
 * marketplace actually did with the traffic. A seller asks one question —
 * "did the exposure turn into business?" — and the honest answer needs the
 * whole chain in one place.
 *
 * Sources (all existing; nothing new is measured here):
 *   • `contentEvents`  — the growth spine's qualified views / share clicks,
 *                        and server-verified `order_confirmed` outcomes
 *                        (reused via `destinationAnalytics`).
 *   • `requests`       — buyer briefs = the enquiry step of the funnel.
 *   • `offers`         — seller replies = demand being answered.
 *   • `orders`         — revenue, split into buckets that must never blur:
 *                        GMV (all live orders), confirmed revenue (delivered
 *                        only), pending payment (in flight), disputed.
 *
 * Honesty rules, enforced by shape:
 *   • every number is `number | null` — `null` means UNKNOWN. A failed read
 *     is never rendered as a fabricated zero.
 *   • money buckets are derived from the same bounded order scan, so they
 *     always agree with each other; `truncated: true` says the scan hit its
 *     cap and the totals are floors, not complete.
 *   • clicks and views never enter a money bucket. Exposure feeds the top of
 *     the funnel and nothing else.
 *   • all reads are SINGLE-predicate bounded queries (Firestore auto
 *     single-field indexes; no composite-index dependency) plus one capped
 *     in-memory aggregate — no unbounded scans.
 *
 * Firestore injected (same convention as the rest of the hub): routes pass
 * the admin `db`, tests pass a fake.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { destinationAnalytics } from './analytics';

/** Hard cap on the order scan. Beyond this the totals are floors. */
export const FUNNEL_ORDER_SCAN_CAP = 500;
/** Cap on request/offer window reads (enquiry volume in a window). */
export const FUNNEL_ENQUIRY_SCAN_CAP = 500;

export interface GrowthFunnelWindow {
  days: number;
  from: string; // ISO
  to: string; // ISO
}

export interface ExposureSection {
  /** Qualified, deduplicated, non-self listing views from tracked links. */
  qualifiedViews: number | null;
  shareClicks: number | null;
}

export interface EnquirySection {
  /** Buyer briefs created inside the window. */
  requestsCreated: number | null;
  /** Seller offers submitted inside the window. */
  offersSubmitted: number | null;
  /** True when a window read hit its cap — counts are floors. */
  truncated: boolean;
}

export interface OrderBuckets {
  total: number | null;
  /** Sum of live order values (excludes cancelled/refunded). LABELLED GMV. */
  gmv: number | null;
  /** Delivered orders only. */
  confirmed: number | null;
  /** Revenue of delivered orders only — the only bucket that is "earned". */
  confirmedRevenue: number | null;
  /** In flight: pending → shipped, not yet delivered. */
  pendingPayment: number | null;
  /** Orders under dispute — kept visible, never folded into revenue. */
  disputed: number | null;
  /** True when the scan hit the cap — totals are floors. */
  truncated: boolean;
}

export interface GrowthFunnel {
  window: GrowthFunnelWindow;
  exposure: ExposureSection;
  enquiries: EnquirySection;
  orders: OrderBuckets;
  /** Server-verified conversions attributed to a destination channel. */
  attribution: {
    attributedOrders: number | null;
    byChannel: Array<{ destination: string; qualifiedViews: number | null; attributedOrders: number | null }>;
  };
  notes: string[];
}

/** Statuses that mean "money still in flight" (not earned, not lost). */
const PENDING_STATUSES = new Set(['pending', 'paid', 'processing', 'packed', 'shipped', 'delivery']);
/** Statuses that must never count toward GMV or revenue. */
const EXCLUDED_STATUSES = new Set(['cancelled', 'refunded']);

/** Equality-only count; null = unknown, never a fabricated 0. */
async function countWhere(
  db: Firestore,
  collection: string,
  field: string,
  value: string | boolean,
  extra: Array<[field: string, value: string | boolean]> = [],
): Promise<number | null> {
  try {
    let query = db.collection(collection).where(field, '==', value);
    for (const [f, v] of extra) query = query.where(f, '==', v);
    const snap = await query.count().get();
    return snap.data().count;
  } catch {
    return null;
  }
}

/**
 * Single-predicate bounded window read. Returns null when the query itself
 * fails; `{ rows, truncated }` otherwise. `timestampField` is the field the
 * range runs on (auto-indexed alone — never combined with another predicate).
 */
async function windowRows(
  db: Firestore,
  collection: string,
  timestampField: string,
  from: Date,
  cap: number,
): Promise<{ rows: Array<Record<string, unknown>>; truncated: boolean } | null> {
  try {
    const snap = await db
      .collection(collection)
      .where(timestampField, '>=', from)
      .limit(cap)
      .get();
    const rows = snap.docs.map((d) => (d.data() ?? {}) as Record<string, unknown>);
    return { rows, truncated: rows.length >= cap };
  } catch {
    return null;
  }
}

function amountOf(data: Record<string, unknown>): number {
  const raw = data.totalAmount ?? data.productPrice ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Folds one bounded order scan into the money buckets. Pure. */
export function foldOrders(
  rows: Array<Record<string, unknown>>,
  truncated: boolean,
): OrderBuckets {
  let total = 0;
  let gmv = 0;
  let confirmed = 0;
  let confirmedRevenue = 0;
  let pendingPayment = 0;
  let disputed = 0;

  for (const order of rows) {
    const status = typeof order.orderStatus === 'string' ? order.orderStatus : 'pending';
    const amount = amountOf(order);
    total += 1;
    if (status === 'delivered') {
      confirmed += 1;
      confirmedRevenue += amount;
      gmv += amount;
    } else if (status === 'disputed') {
      disputed += 1;
    } else if (EXCLUDED_STATUSES.has(status)) {
      // Excluded from GMV and revenue by definition.
    } else {
      pendingPayment += 1;
      gmv += amount;
    }
  }

  return {
    total,
    gmv,
    confirmed,
    confirmedRevenue,
    pendingPayment,
    disputed,
    truncated,
  };
}

/**
 * Reads the funnel for the last `days` days. Every section is individually
 * guarded: one failing source nulls its own numbers and leaves the rest.
 */
export async function readGrowthFunnel(
  db: Firestore,
  days: number,
): Promise<GrowthFunnel> {
  const boundedDays = Math.min(90, Math.max(1, Math.floor(days) || 30));
  const to = new Date();
  const from = new Date(to.getTime() - boundedDays * 24 * 60 * 60 * 1000);

  const [qualifiedViews, shareClicks, requests, offers, orders, destination] =
    await Promise.all([
      countWhere(db, 'contentEvents', 'type', 'view', [
        ['qualified', true],
        ['self', false],
      ]),
      countWhere(db, 'contentEvents', 'type', 'click'),
      windowRows(db, 'requests', 'createdAt', from, FUNNEL_ENQUIRY_SCAN_CAP),
      windowRows(db, 'offers', 'createdAt', from, FUNNEL_ENQUIRY_SCAN_CAP),
      windowRows(db, 'orders', 'orderDate', from, FUNNEL_ORDER_SCAN_CAP),
      destinationAnalytics(db).catch(() => null),
    ]);

  const orderBuckets = orders
    ? foldOrders(orders.rows, orders.truncated)
    : {
        total: null,
        gmv: null,
        confirmed: null,
        confirmedRevenue: null,
        pendingPayment: null,
        disputed: null,
        truncated: false,
      };

  // Attributed orders = the sum of the per-destination server-verified
  // conversions. Any UNKNOWN (null) destination makes the total unknown — a
  // partial sum must never be presented as the whole.
  const attributedOrders = destination
    ? destination.perDestination.reduce<number | null>((sum, d) => {
        if (sum === null || d.attributedOrders === null) return null;
        return sum + d.attributedOrders;
      }, 0)
    : null;

  return {
    window: { days: boundedDays, from: from.toISOString(), to: to.toISOString() },
    exposure: { qualifiedViews, shareClicks },
    enquiries: {
      requestsCreated: requests ? requests.rows.length : null,
      offersSubmitted: offers ? offers.rows.length : null,
      truncated: Boolean(requests?.truncated || offers?.truncated),
    },
    orders: orderBuckets,
    attribution: {
      attributedOrders,
      byChannel: destination
        ? destination.perDestination.map((d) => ({
            destination: d.destination,
            qualifiedViews: d.qualifiedViews,
            attributedOrders: d.attributedOrders,
          }))
        : [],
    },
    notes: [
      'Every value is a real measurement: null means UNKNOWN, never a hidden zero.',
      'GMV counts live orders (delivered + in flight); "confirmed revenue" counts DELIVERED orders only. Pending payment and disputed orders are reported separately and are never revenue.',
      'Exposure (views, share clicks) is never converted into money — a click is not a sale.',
      'Counts cover the selected window; event-based counts additionally follow the spine’s 30-day retention.',
      'When "truncated" is true the scan hit its cap and the totals are floors, not complete figures.',
    ],
  };
}
