/**
 * DISTRIBUTION HUB — destination traffic & conversion analytics (Stage 4).
 *
 * Reads the EXISTING event spine — nothing new is measured, nothing is
 * inferred. Two real sources, both equality-only aggregate queries (no
 * composite indexes, no unbounded scans):
 *
 *   1. `contentEvents` growth docs carrying a server-validated `channel`
 *      field (written by POST /api/events when an arrival URL carried a
 *      `?ch=` tracking parameter) — qualified, non-self views and share
 *      clicks per destination.
 *   2. `contentEvents` core docs (`order_confirmed`, origin `server`) with
 *      `attribution.channel` — VERIFIED conversions attributed to a
 *      destination. If checkout does not yet carry channel attribution,
 *      this counts ZERO — which is the honest answer, not a gap to paper
 *      over.
 *
 * Rules:
 *   • a failing counter reports `null` (unknown) — never a fabricated 0;
 *   • counts cover the RETAINED event window (30-day TTL), not all time;
 *   • search-engine arrivals do not carry `?ch=` (they arrive from Google/
 *     Bing, not our links) — those are measured by Search Console/GA when
 *      connected, and this module says so instead of guessing.
 */

import { type Firestore } from 'firebase-admin/firestore';
import { CHANNELS } from './channels';
import type { ChannelId } from '../types';

export interface DestinationTraffic {
  destination: string;
  label: string;
  /** Qualified, deduplicated, non-self listing views from tracked links. */
  qualifiedViews: number | null;
  /** Share clicks recorded while on a page carrying this channel param. */
  shareClicks: number | null;
  /** Server-verified orders attributed to this destination (0 = none yet). */
  attributedOrders: number | null;
}

export interface DestinationAnalytics {
  perDestination: DestinationTraffic[];
  /** Honest caveats rendered next to the numbers. */
  notes: string[];
}

/** Equality-only count; `null` means unknown — never a fake zero. */
async function countWhere(
  db: Firestore,
  field: string,
  value: string | boolean,
  extra: Array<[string, string | boolean]> = [],
): Promise<number | null> {
  try {
    let query = db.collection('contentEvents').where(field, '==', value);
    for (const [f, v] of extra) query = query.where(f, '==', v);
    const snap = await query.count().get();
    return snap.data().count;
  } catch {
    return null;
  }
}

export async function destinationAnalytics(db: Firestore): Promise<DestinationAnalytics> {
  const destinations = Object.values(CHANNELS);

  const perDestination = await Promise.all(
    destinations.map(async (dest): Promise<DestinationTraffic> => {
      const id: ChannelId = dest.id;
      const [qualifiedViews, shareClicks, attributedOrders] = await Promise.all([
        countWhere(db, 'channel', id, [
          ['type', 'view'],
          ['qualified', true],
          ['self', false],
        ]),
        countWhere(db, 'channel', id, [['type', 'click']]),
        // Core outcome events carry attribution NESTED (see event-doc.ts).
        countWhere(db, 'attribution.channel', id, [
          ['type', 'order_confirmed'],
          ['origin', 'server'],
        ]),
      ]);
      return { destination: id, label: dest.label, qualifiedViews, shareClicks, attributedOrders };
    }),
  );

  const notes = [
    'Counts cover the retained event window (30-day TTL), not all time.',
    'Arrivals from search engines do not carry a tracking parameter — search traffic is measured through Search Console and Google Analytics, not these counters.',
    'Attributed orders count server-verified confirmations only; no sales data is estimated.',
  ];

  return { perDestination, notes };
}
