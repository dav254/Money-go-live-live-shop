/**
 * SHOP OPPORTUNITY AGENT — funnel & attribution reader (Firestore injected).
 *
 * One honest view of the acquisition chain:
 *
 *   candidate → eligible → invitation approved → sent → replied → onboarding
 *     → registered → shop published → product published   (our own stages)
 *   → qualified visit                                      (campaign-tagged
 *                                                            arrivals in the
 *                                                            existing event
 *                                                            spine)
 *   → enquiry → offer → order → completed sale             (NOT attributable
 *                                                            to a campaign
 *                                                            today ⇒ null =
 *                                                            UNKNOWN, never a
 *                                                            fabricated zero)
 *
 * Rules:
 *   • Every number is `number | null`. null means the read failed or the
 *     join does not exist — never a hidden 0.
 *   • Stage/message counts come from ONE bounded scan each (folded in
 *     memory) with `truncated` floors; arrival/order counts are equality-only
 *     aggregate queries (auto single-field indexes, no composite dependency).
 *   • `campaign` tagging on contentEvents comes from the `?camp=` parameter
 *     of tracked links (same event spine as `ref`/`ch` — nothing new is
 *     measured here).
 *   • A campaign count of 0 after a SUCCESSFUL read is a real zero (no
 *     arrivals/confirmations yet) — distinct from null (unknown).
 */

import type { Firestore } from 'firebase-admin/firestore';
import {
  CANDIDATES_COLLECTION,
  MESSAGES_COLLECTION,
  SUPPRESSION_COLLECTION,
  CANDIDATE_STAGES,
  MESSAGE_STATES,
  type CandidateStage,
  type MessageState,
} from './types';

const SCAN_CAP = 500;

export interface ShopAgentFunnelWindow {
  days: number;
  from: string;
  to: string;
}

export interface StageCounts {
  perStage: Record<CandidateStage, number | null>;
  /** True when the scan hit the cap — counts are floors. */
  truncated: boolean;
}

export interface MessageCounts {
  perState: Record<MessageState, number | null>;
  truncated: boolean;
}

export interface AttributionCounts {
  /** Qualified, deduplicated arrivals carrying `?camp=<campaign>`. */
  campaignViews: number | null;
  campaignClicks: number | null;
  /** Server-verified order confirmations carrying attribution.campaign. */
  attributedOrders: number | null;
}

export interface ShopAgentFunnel {
  window: ShopAgentFunnelWindow;
  stages: StageCounts;
  messages: MessageCounts;
  suppression: { optOuts: number | null; manualOrComplaint: number | null };
  attribution: AttributionCounts;
  /**
   * Post-registration marketplace outcomes. Campaign-level joins for
   * enquiries/offers/completed sales do not exist yet ⇒ null (unknown).
   */
  downstream: {
    registered: number | null;
    shopPublished: number | null;
    productPublished: number | null;
    enquiries: number | null;
    offers: number | null;
    orders: number | null;
    completedSales: number | null;
  };
  notes: string[];
}

/** Equality-only count; `null` on any failure — never a fabricated zero. */
async function countWhere(
  db: Firestore,
  collection: string,
  field: string,
  value: string | boolean,
  extra: Array<[string, string | boolean]> = [],
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

function nullStages(): Record<CandidateStage, number | null> {
  return Object.fromEntries(CANDIDATE_STAGES.map((s) => [s, null])) as Record<CandidateStage, number | null>;
}

function nullStates(): Record<MessageState, number | null> {
  return Object.fromEntries(MESSAGE_STATES.map((s) => [s, null])) as Record<MessageState, number | null>;
}

/** One bounded scan folded into per-stage counts. Null on failure. */
async function stageCounts(db: Firestore): Promise<StageCounts> {
  try {
    const snap = await db.collection(CANDIDATES_COLLECTION).limit(SCAN_CAP).get();
    const perStage = nullStages();
    for (const doc of snap.docs) {
      const stage = (doc.data() as { stage?: CandidateStage }).stage ?? 'discovered';
      if (stage in perStage) perStage[stage] = (perStage[stage] ?? 0) + 1;
    }
    return { perStage, truncated: snap.docs.length >= SCAN_CAP };
  } catch {
    return { perStage: nullStages(), truncated: false };
  }
}

async function messageCounts(db: Firestore): Promise<MessageCounts> {
  try {
    const snap = await db.collection(MESSAGES_COLLECTION).limit(SCAN_CAP).get();
    const perState = nullStates();
    for (const doc of snap.docs) {
      const state = (doc.data() as { state?: MessageState }).state ?? 'pending_approval';
      if (state in perState) perState[state] = (perState[state] ?? 0) + 1;
    }
    return { perState, truncated: snap.docs.length >= SCAN_CAP };
  } catch {
    return { perState: nullStates(), truncated: false };
  }
}

export async function readShopAgentFunnel(
  db: Firestore,
  days: number,
  campaignId = 'shopagent',
): Promise<ShopAgentFunnel> {
  const boundedDays = Math.min(90, Math.max(1, Math.floor(days) || 30));
  const to = new Date();
  const from = new Date(to.getTime() - boundedDays * 86_400_000);

  const [stages, messages, optOuts, blockedSuppression, campaignViews, campaignClicks, attributedOrders] =
    await Promise.all([
      stageCounts(db),
      messageCounts(db),
      countWhere(db, SUPPRESSION_COLLECTION, 'reason', 'opt_out'),
      countWhere(db, SUPPRESSION_COLLECTION, 'source', 'admin'),
      countWhere(db, 'contentEvents', 'campaign', campaignId, [
        ['type', 'view'],
        ['qualified', true],
        ['self', false],
      ]),
      countWhere(db, 'contentEvents', 'campaign', campaignId, [['type', 'click']]),
      // Core outcome events carry attribution NESTED (see events/event-doc.ts),
      // while growth arrivals store `campaign` at the top level.
      countWhere(db, 'contentEvents', 'attribution.campaign', campaignId, [
        ['type', 'order_confirmed'],
        ['origin', 'server'],
      ]),
    ]);

  const atLeast = (...values: Array<number | null>): number | null => {
    // Registered = the union of the post-contact stages. Any unknown makes
    // the total unknown — a partial sum is never shown as the whole.
    let sum = 0;
    for (const v of values) {
      if (v === null) return null;
      sum += v;
    }
    return sum;
  };

  const perStage = stages.perStage;
  const registered =
    atLeast(perStage.registered, perStage.shop_published, perStage.product_published);
  const shopPublished = atLeast(perStage.shop_published, perStage.product_published);
  const productPublished = perStage.product_published;

  return {
    window: { days: boundedDays, from: from.toISOString(), to: to.toISOString() },
    stages,
    messages,
    suppression: { optOuts, manualOrComplaint: blockedSuppression },
    attribution: { campaignViews, campaignClicks, attributedOrders },
    downstream: {
      registered,
      shopPublished,
      productPublished,
      enquiries: null,
      offers: null,
      orders: null,
      completedSales: null,
    },
    notes: [
      'Stage and message counts come from one bounded scan (500 docs) — when “truncated” is true they are floors.',
      'null means UNKNOWN (the read failed or no join exists) — it is never a hidden zero.',
      'Campaign arrivals are real event-spine measurements (deduplicated, 30-day retention window).',
      'Enquiries, offers, orders and completed sales have no campaign-level join yet — reported as unknown on purpose; see the marketplace-wide Growth Funnel for real order buckets.',
      'A click or a visit is never treated as a sale; only server-verified order confirmations count as conversions.',
    ],
  };
}
