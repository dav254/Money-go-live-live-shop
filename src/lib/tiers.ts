/**
 * ACCOUNT TIERS — automatic, earned by activity.
 *
 * ## A sale is a DELIVERED order, and nothing else
 *
 * The live data made this concrete: of 106 orders, 86 are still `pending` and
 * 10 are `delivered`. Counting orders as "sales" would have handed a Gold badge
 * to sellers for orders nobody had paid for — and a badge that measures
 * *intention to buy* is worse than no badge, because buyers learn to read it as
 * proof of quality when it is proof of nothing.
 *
 * So the only counted event is money that actually changed hands and arrived.
 *
 * ## Automatic, and the badge can only go up
 *
 * Nothing an admin does is required for a badge to appear — that is the point
 * of "automatic". But automatic is not the same as unstable: a tier is
 * monotonic. A seller in a quiet month does not get demoted, because a badge
 * that disappears teaches sellers that the work was not real, and the next
 * thing they do is stop trying. Refunds and reversals are handled by admin, on
 * purpose, and visibly.
 *
 * ## Volume above everything else
 *
 * Tiers count *transactions*, never rating. A shop with two sales and a 5.0 is
 * not more trusted than one with forty sales and a 4.6; putting rating anywhere
 * near this number would let a single five-star review outrank years of
 * turning up. That mistake is available here and is deliberately not made.
 *
 * ## What the badge may promise
 *
 * Each tier unlocks concrete platform perks, expressed as data so they can be
 * tuned without touching the badge. None of them is a discount on the seller's
 * own pricing — the platform does not get to set a seller's price — they are
 * cost and exposure reductions the platform controls.
 */

export type AccountTier = 'none' | 'bronze' | 'silver' | 'gold' | 'premium';

export const ACCOUNT_TIERS: AccountTier[] = ['none', 'bronze', 'silver', 'gold', 'premium'];

/**
 * Completed transactions needed to reach each tier.
 *
 * Gold at 20 is the number asked for. The steps below it are deliberately
 * smaller so the first badge arrives almost immediately — a ladder whose first
 * rung takes 5 sales means a new seller sees nothing at all, and "nothing" is
 * what makes people decide the badge is not worth anything.
 *
 * Upper bound is Infinity rather than a number: there is no cap, because a cap
 * is an arbitrary line to argue about and "no ceiling" is simpler to explain and
 * impossible to object to.
 */
export const TIER_THRESHOLDS: { tier: Exclude<AccountTier, 'none'>; min: number }[] = [
  { tier: 'bronze', min: 1 },
  { tier: 'silver', min: 5 },
  { tier: 'gold', min: 20 },
  { tier: 'premium', min: 50 },
];

export interface TierMeta {
  label: string;
  detail: string;
  tone: 'neutral' | 'bronze' | 'silver' | 'gold' | 'premium';
  /** Below this count the tier reads as "working towards it", not as achieved. */
  min: number;
  next?: { tier: Exclude<AccountTier, 'none'>; remaining: number };
}

/**
 * What each tier actually unlocks.
 *
 * Deliberately platform-side benefits only — visibility and cost the platform
 * pays for. A tier that discounts a seller's own product would mean the badge
 * is telling buyers "this person cannot set their own price", which is the
 * opposite of a trust signal.
 */
export interface TierBenefit {
  key: string;
  label: string;
  detail: string;
  /**
   * Does this actually happen today?
   *
   * False means the perk is DECLARED, not delivered, and the UI must say so
   * rather than present it as something the seller already has. A badge that
   * promises a reduced fee while no fee engine exists is worse than no badge:
   * the seller earns it, believes it, and discovers otherwise at payout.
   *
   * Only the badges themselves are enforced — they are computed and rendered
   * from delivered orders, end to end. Everything else waits on the fee engine
   * and credits ledger, which do not exist yet.
   */
  enforced: boolean;
}

export const TIER_BENEFITS: Record<Exclude<AccountTier, 'none'>, TierBenefit[]> = {
  bronze: [
    { key: 'profile', label: 'Full business profile', detail: 'Logo, banner, description, contact details.', enforced: true },
    { key: 'reviews', label: 'Reviews and ratings', detail: 'Buyers can rate you, and you can rate them back.', enforced: true },
    { key: 'badge-bronze', label: 'Bronze badge', detail: 'Shown on your shop and beside your listings.', enforced: true },
  ],
  silver: [
    { key: 'profile', label: 'Everything in Bronze', detail: 'Full profile, reviews and ratings.', enforced: true },
    { key: 'matching', label: 'Priority in matching', detail: 'Appear higher when a customer request matches your category.', enforced: false },
    { key: 'badge-silver', label: 'Silver badge', detail: 'Shown on your shop and beside your listings.', enforced: true },
  ],
  gold: [
    { key: 'profile', label: 'Everything in Silver', detail: 'Profile, reviews, and priority matching.', enforced: true },
    { key: 'sponsored-credit', label: 'Promotional credits', detail: 'Credits towards Sponsored and Featured placement.', enforced: false },
    { key: 'lower-fee', label: 'Reduced platform fee', detail: 'A lower commission on each completed transaction.', enforced: false },
    { key: 'badge-gold', label: 'Gold badge', detail: 'Shown on your shop, your listings and in search.', enforced: true },
  ],
  premium: [
    { key: 'profile', label: 'Everything in Gold', detail: 'Profile, reviews, priority matching and credits.', enforced: true },
    { key: 'featured', label: 'Featured placement', detail: 'Eligible for Featured placement without buying each slot.', enforced: false },
    { key: 'lowest-fee', label: 'Lowest platform fee', detail: 'Our best rate, applied automatically.', enforced: false },
    { key: 'priority-support', label: 'Priority support', detail: 'Your messages reach the team first.', enforced: false },
    { key: 'badge-premium', label: 'Premium badge', detail: 'The top tier badge, shown across the platform.', enforced: true },
  ],
};

/**
 * WHAT AN ADMIN MAY GIVE — offers, promotions and bonuses.
 *
 * A closed list on purpose. A free-text bonus field invites "good boy", "vip",
 * "keep the seller happy", which tells the recipient nothing and tells an
 * auditor nothing either. Each entry here says what the seller actually
 * receives.
 *
 * Note what is absent: no tier, and no rank. A bonus is an act with a value and
 * a reason attached; a tier is arithmetic. The two are stored separately so a
 * goodwill gesture can never be mistaken for evidence of quality.
 */
export interface BonusOption {
  key: string;
  label: string;
  detail: string;
  /** Bonus types that reduce what the seller pays, rather than adding value. */
  kind: 'credit' | 'waiver' | 'promotion' | 'support';
}

export const BONUS_OPTIONS: BonusOption[] = [
  { key: 'promo-credit', label: 'Promotional credit', detail: 'Credit towards Sponsored and Featured placement.', kind: 'credit' },
  { key: 'fee-waiver', label: 'Platform fee waiver', detail: 'Commission waived on the next completed transactions.', kind: 'waiver' },
  { key: 'fee-reduction', label: 'Reduced platform fee', detail: 'A lower commission for a fixed number of sales.', kind: 'waiver' },
  { key: 'featured-slot', label: 'Featured placement', detail: 'A Sponsored slot in the area the seller works in.', kind: 'promotion' },
  { key: 'campaign', label: 'Campaign boost', detail: 'Inclusion in a regional campaign or seasonal promotion.', kind: 'promotion' },
  { key: 'priority-support', label: 'Priority support', detail: 'Their messages reach the team ahead of the queue.', kind: 'support' },
  { key: 'goodwill', label: 'Goodwill payment', detail: 'A direct payment for a problem the platform caused.', kind: 'credit' },
];

export function isKnownBonus(key: string): boolean {
  return BONUS_OPTIONS.some((b) => b.key === key);
}

/** Benefits the platform delivers today, for this tier. */
export function activeBenefits(tier: AccountTier): TierBenefit[] {
  return benefitsFor(tier).filter((b) => b.enforced);
}

/** Benefits a seller can see are coming. Shown as such, never as a promise. */
export function upcomingBenefits(tier: AccountTier): TierBenefit[] {
  return benefitsFor(tier).filter((b) => !b.enforced);
}

export const TIER_META: Record<AccountTier, TierMeta> = {
  none: {
    label: 'New',
    detail: 'No completed transactions yet. The first sale starts this.',
    tone: 'neutral',
    min: 0,
    next: { tier: 'bronze', remaining: 1 },
  },
  bronze: {
    label: 'Bronze',
    detail: '1 or more completed transactions.',
    tone: 'bronze',
    min: 1,
    next: { tier: 'silver', remaining: 4 },
  },
  silver: {
    label: 'Silver',
    detail: '5 or more completed transactions.',
    tone: 'silver',
    min: 5,
    next: { tier: 'gold', remaining: 15 },
  },
  gold: {
    label: 'Gold',
    detail: '20 or more completed transactions.',
    tone: 'gold',
    min: 20,
    next: { tier: 'premium', remaining: 30 },
  },
  premium: {
    label: 'Premium',
    detail: '50 or more completed transactions. There is no tier above this.',
    tone: 'premium',
    min: 50,
  },
};

/** The only statuses that count. Everything else is a promise, not a sale. */
export const COUNTED_ORDER_STATUSES = ['delivered'] as const;

/**
 * The tier for a count of completed transactions.
 *
 * Pure, and therefore testable — which matters because this number ends up on
 * a badge that a buyer uses to decide whether to hand over money.
 */
export function tierForCompletedTransactions(count: number): AccountTier {
  if (!Number.isFinite(count) || count <= 0) return 'none';
  let current: AccountTier = 'bronze';
  for (const step of TIER_THRESHOLDS) {
    if (count >= step.min) current = step.tier;
  }
  return current;
}

export interface TierProgress {
  tier: AccountTier;
  completed: number;
  /** Transactions still needed for the next tier. 0 at the top. */
  toNext: number;
  next?: Exclude<AccountTier, 'none'>;
  /** 0–1 towards the next tier. 1 at the top tier. */
  progress: number;
}

/**
 * Progress towards the next tier, for the seller-facing meter.
 *
 * The fraction is computed against the span the seller is actually inside, not
 * from zero — otherwise someone at 49 transactions looks 98% of the way to
 * Premium when they are really 2 sales away, and the number stops meaning
 * anything.
 */
export function tierProgress(completed: number): TierProgress {
  const safe = Number.isFinite(completed) && completed > 0 ? Math.floor(completed) : 0;
  const tier = tierForCompletedTransactions(safe);
  const meta = TIER_META[tier];

  if (!meta.next) {
    return { tier, completed: safe, toNext: 0, progress: 1 };
  }

  const nextStep = TIER_THRESHOLDS.find((s) => s.tier === meta.next!.tier)!;
  const toNext = Math.max(0, nextStep.min - safe);
  const span = nextStep.min - meta.min;
  const done = safe - meta.min;
  return {
    tier,
    completed: safe,
    toNext,
    next: meta.next.tier,
    progress: span > 0 ? Math.min(1, Math.max(0, done / span)) : 1,
  };
}

/**
 * Combine two sources into the highest tier reached.
 *
 * A seller is usually both a seller and a buyer, and the platform wants both
 * to be rewarded. Highest wins, which is safe because tiers never demote.
 */
export function highestTier(...tiers: (AccountTier | null | undefined)[]): AccountTier {
  let best: AccountTier = 'none';
  for (const t of tiers) {
    if (t && ACCOUNT_TIERS.indexOf(t) > ACCOUNT_TIERS.indexOf(best)) best = t;
  }
  return best;
}

export function benefitsFor(tier: AccountTier): TierBenefit[] {
  return tier === 'none' ? [] : TIER_BENEFITS[tier];
}

export function tierMeta(tier: unknown): TierMeta {
  return typeof tier === 'string' && tier in TIER_META ? TIER_META[tier as AccountTier] : TIER_META.none;
}

/**
 * Has this account actually EARNED this tier?
 *
 * The badge asks this rather than trusting the stored value. An account
 * carrying `gold` that has since been suspended, or whose completed orders
 * were all refunded, still has the string in its document — and a badge that
 * survives its own conditions is decoration.
 *
 * `tierIndex` is the stored tier, `earnedTier` is what the counts currently
 * justify. The stored one may only ever be equal or lower: the automatic ladder
 * never demotes (see the file header), so a stored tier ABOVE what the counts
 * support means something revoked it, and that is not this function's call to
 * undo.
 */
export function isTierEligible(storedTier: AccountTier, earnedTier: AccountTier): boolean {
  const stored = ACCOUNT_TIERS.indexOf(storedTier);
  const earned = ACCOUNT_TIERS.indexOf(earnedTier);
  if (stored < 0 || earned < 0) return false;
  return earned >= stored;
}
