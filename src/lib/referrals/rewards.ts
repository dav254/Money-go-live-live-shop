/**
 * REFERRAL REWARDS — the one place the numbers live.
 *
 * Every surface (the buyer screen, the seller screen, the admin leaderboard,
 * and the Firestore rules' companion admin screens) reads its economics from
 * here. When a tier changes it changes once. Nothing in this file reads or
 * writes Firestore — it is pure arithmetic, so the same function that renders
 * a progress bar is the one that decides what a referral is worth.
 */

/**
 * Escalating tiers.
 *
 * A flat "5 points per signup" rewards volume and nothing else: it makes the
 * tenth signup worth exactly what the first was worth, so the only strategy
 * is to spam. These tiers pay more per signup as the referrer's confirmed
 * count crosses each threshold, which means the incentive curve rewards the
 * *quality* of a network, not just its size.
 *
 * `upTo` is the inclusive upper bound of confirmed signups this band covers;
 * `null` means the band is open-ended (the best rate, forever).
 */
export interface ReferralTier {
  /** Human label shown on the progress bar. */
  name: string;
  /** Inclusive signup count this band covers, or null for open-ended. */
  upTo: number | null;
  /** Points awarded for the signup that lands inside this band. */
  points: number;
}

/**
 * The ladder. Read left to right: the 1st–5th signup pays 50, the 6th–15th
 * pays 75, the 16th–30th pays 100, and from the 31st onward every signup pays
 * 150 with no ceiling.
 */
export const REFERRAL_TIERS: ReferralTier[] = [
  { name: 'Starter', upTo: 5, points: 50 },
  { name: 'Builder', upTo: 15, points: 75 },
  { name: 'Connector', upTo: 30, points: 100 },
  { name: 'Ambassador', upTo: null, points: 150 },
];

/** Free-delivery credits a referrer earns per confirmed signup. */
export const DELIVERY_CREDITS_PER_SIGNUP = 1;

/**
 * Points needed to unlock one hour of live streaming, and the credits needed
 * to make one order ship free.
 *
 * Delivery is expressed in CREDITS rather than points on purpose. Points are
 * a spendable currency that can be cashed out, so tying free shipping to it
 * would let a referrer buy shipping with money that was meant to be a reward,
 * and would make the balance unreadable ("is this 300 points or three
 * deliveries?"). Credits are single-use and only ever come from referrals and
 * admin grants, which keeps the two economies from cannibalising each other.
 */
export const LIVE_STREAM_UNLOCK_COST = 200;
export const DELIVERY_CREDIT_COST_IN_POINTS = 40;

/** Minimum confirmed signups before a cash/voucher payout can be requested. */
export const MIN_SIGNUPS_FOR_PAYOUT = 10;

/**
 * Points that convert into `aiPoints`.
 *
 * Referral points are a reward, not a currency, so they are not spent directly
 * on AI — they are converted, and the AI tools keep spending their own
 * balance as they always have. That keeps one economy from cannibalising the
 * other: a user cannot cash out the points they already used for a generation.
 */
export const AI_TOPUP_COST = 50;

/** A referral only counts once the invited person has actually signed up. */
export type ReferralStatus = 'pending' | 'approved' | 'flagged' | 'rejected';

/**
 * Points a signup is worth, given how many the referrer has already banked.
 *
 * `confirmedCount` is the number ALREADY approved, so the first signup (0
 * banked) lands in the Starter band and pays `REFERRAL_TIERS[0].points`.
 */
export function pointsForSignup(confirmedCount: number): number {
  const n = Math.max(0, Number(confirmedCount) || 0);
  for (const tier of REFERRAL_TIERS) {
    if (tier.upTo === null || n < tier.upTo) return tier.points;
  }
  return REFERRAL_TIERS[REFERRAL_TIERS.length - 1].points;
}

/** The band `confirmedCount` currently sits in. */
export function currentTier(confirmedCount: number): ReferralTier {
  const n = Math.max(0, Number(confirmedCount) || 0);
  for (const tier of REFERRAL_TIERS) {
    if (tier.upTo === null || n < tier.upTo) return tier;
  }
  return REFERRAL_TIERS[REFERRAL_TIERS.length - 1];
}

/**
 * The next band up, or null once the top rate is reached.
 *
 * At 25 approved referrals the user is in Connector (16–30) and the next band
 * they can reach is Ambassador (31+). "Up" from where they ARE, not up from
 * the band that contains them — hence the `i + 1` below rather than `i`.
 */
export function nextTier(confirmedCount: number): ReferralTier | null {
  const n = Math.max(0, Number(confirmedCount) || 0);
  const here = currentTier(n);
  const index = REFERRAL_TIERS.findIndex((t) => t.name === here.name);
  if (index < 0) return null;
  return index + 1 < REFERRAL_TIERS.length ? REFERRAL_TIERS[index + 1] : null;
}

/** Signups still needed before the next band starts paying more. */
export function signupsToNextTier(confirmedCount: number): number {
  const n = Math.max(0, Number(confirmedCount) || 0);
  const next = nextTier(n);
  if (!next) return 0;

  /*
   * `next` is the UPCOMING band, so the signups still needed is where that
   * band BEGINS minus where we are — not its ceiling.
   *
   * The bands are contiguous (Starter ends at 5, Builder ends at 15), so a
   * band's start is the PREVIOUS band's ceiling and `bandFloorFor` derives it
   * for every band including the open-ended top one. Using `next.upTo` gave
   * 15 instead of 5 for a brand-new referrer; special-casing the top band with
   * `upTo === null ? n : ...` then reported "0 more" for anyone in Connector,
   * which is the band where the final step actually matters most.
   */
  return Math.max(0, bandFloorFor(next.name) - n);
}

/** The lower bound of a named band, derived from the ladder. */
function bandFloorFor(tierName: string): number {
  let floor = 0;
  for (const tier of REFERRAL_TIERS) {
    if (tier.name === tierName) return floor;
    if (tier.upTo !== null) floor = tier.upTo;
  }
  return floor;
}

/**
 * What the NEXT signup pays right now, and how many remain at that rate.
 * Drives the "next invite earns you X" line on both app screens.
 */
export function nextSignupValue(confirmedCount: number): {
  points: number;
  remainingAtThisRate: number;
  tierName: string;
} {
  const n = Math.max(0, Number(confirmedCount) || 0);
  const tier = currentTier(n);
  const cap = tier.upTo ?? Number.POSITIVE_INFINITY;
  return {
    points: tier.points,
    remainingAtThisRate: Math.max(0, cap - n),
    tierName: tier.name,
  };
}

/**
 * The inclusive signup range of the band `confirmedCount` sits in.
 *
 * Used by the progress bar. Derived from `REFERRAL_TIERS` rather than a
 * hardcoded floor list, so editing a tier cannot leave the bar disagreeing
 * with the ladder shown beside it.
 */
export function currentBandBounds(confirmedCount: number): {
  floor: number;
  ceiling: number | null;
  name: string;
} {
  const n = Math.max(0, Number(confirmedCount) || 0);
  let floor = 0;
  for (const tier of REFERRAL_TIERS) {
    if (tier.upTo === null || n < tier.upTo) {
      return { floor, ceiling: tier.upTo, name: tier.name };
    }
    floor = tier.upTo;
  }
  const last = REFERRAL_TIERS[REFERRAL_TIERS.length - 1];
  return { floor, ceiling: null, name: last.name };
}

/** Formats a points balance for display. */
export function formatPoints(n: number): string {
  return Math.max(0, Math.floor(Number(n) || 0)).toLocaleString();
}
