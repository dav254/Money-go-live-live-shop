/**
 * GROWTH POSTS — types, state machine and safety limits (pure module).
 *
 * ## What this engine is
 * The "extra hands" layer: a bounded job drafts ready-to-post social copy for
 * the products performing best on REAL metrics, parks each draft in an admin
 * approval queue, and only acts on an approved draft. Nothing here posts
 * anywhere by itself — publishing channels are gated by their own provider
 * configuration and are reported honestly (see `drafts.ts`).
 *
 * ## Why the state machine is closed
 * A draft is either approved or rejected; an approved post can only become
 * `copied` (the admin took the text to a network manually), `emailed` (the
 * seller was sent the ready-made post) or `failed`. There is deliberately NO
 * `published` state for social networks: no social API is connected yet, and
 * inventing one would be exactly the fake-confirmation the Vidnov engine
 * forbids (see distribution's ConfirmationState contract).
 *
 * Pure module: no I/O, no Firestore, no network. Safe for tests.
 */

/** Firestore collection + the `ref=` code every share link carries. */
export const GROWTH_POSTS_COLLECTION = 'growthPosts';
export const GROWTH_TRACKING_ID = 'growthpost';

export const GROWTH_POST_STATES = [
  'draft',
  'approved',
  'rejected',
  'copied',
  'emailed',
  'published',
  'failed',
] as const;
export type GrowthPostState = (typeof GROWTH_POST_STATES)[number];

/**
 * Legal transitions.
 *
 * `rejected` is the ONLY terminal state — a decision is final. Every other
 * post-approval state may move to any other, because one approved post can
 * be shared on several channels over time (copied today, published to
 * Bluesky tomorrow, emailed to the seller after that) and each action
 * records its own result in `results`.
 *
 * `published` is reachable only from an approved post AND only when the
 * platform's own API returned a message/record id (see `service.ts` — the
 * remoteId is written in the same patch). Nothing in this module can set it
 * optimistically.
 */
export const GROWTH_POST_TRANSITIONS: Record<GrowthPostState, readonly GrowthPostState[]> = {
  draft: ['approved', 'rejected'],
  approved: ['copied', 'emailed', 'published', 'failed'],
  rejected: [],
  copied: ['published', 'emailed', 'failed'],
  emailed: ['published', 'copied', 'failed'],
  published: ['published', 'copied', 'emailed', 'failed'],
  failed: ['published', 'copied', 'emailed', 'failed'],
};

export function canTransitionGrowthPost(from: GrowthPostState, to: GrowthPostState): boolean {
  return (GROWTH_POST_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * Publish paths that exist TODAY, in the order the queue offers them.
 *
 * Phase 2A added the four channels that are genuinely free AND need no
 * platform approval (see `social.ts`). Phase 2C added **Pinterest** and
 * **Reddit** — both official APIs, both free, both gated on credentials the
 * admin supplies:
 *   • Pinterest — `POST /v5/pins` (image pins only; business account, and
 *     pins stay hidden until the app's Standard-access review).
 *   • Reddit    — script-app OAuth + `POST /api/submit` to the brand's OWN
 *     subreddit (self-promotion rules make posting to other communities a
 *     human decision, never an automated one).
 *
 * Deliberately NOT here: X (charged per post), WhatsApp Channels (no
 * official publish API), Facebook/Instagram and Threads (Phase 2B — one
 * Meta app, app review).
 */
export const GROWTH_PUBLISH_CHANNELS = [
  'copy',
  'email',
  'bluesky',
  'mastodon',
  'telegram',
  'discord',
  'pinterest',
  'reddit',
] as const;
export type GrowthPublishChannel = (typeof GROWTH_PUBLISH_CHANNELS)[number];

/** The social networks — the subset that goes through `social.ts`. */
export const SOCIAL_CHANNELS = [
  'bluesky',
  'mastodon',
  'telegram',
  'discord',
  'pinterest',
  'reddit',
] as const;
export type SocialChannel = (typeof SOCIAL_CHANNELS)[number];

export function isSocialChannel(channel: string): channel is SocialChannel {
  return (SOCIAL_CHANNELS as readonly string[]).includes(channel);
}

/** One channel's recorded outcome on a post. Never contains upstream bodies. */
export interface GrowthPublishResult {
  state: 'published' | 'dev_captured' | 'copied' | 'failed';
  /** The platform's OWN message/record id — present iff state is published. */
  remoteId?: string;
  at: string;
  /** Sanitized note (no provider error bodies, no credentials). */
  note?: string;
}

/** One drafted post — every field derives from real product data or a decision. */
export interface GrowthPost {
  id: string;
  productId: string;
  sellerId: string;
  productName: string;
  productImage?: string;
  price?: number;
  currency?: string;
  /** AI-drafted, admin-approved copy. Never generated from thin air here. */
  caption: string;
  hashtags: string[];
  /** Same-site tracked path, e.g. `/products/x?ref=growthpost`. */
  sharePath: string;
  status: GrowthPostState;
  createdAt: string;
  updatedAt: string;
  /** Who ran the draft job: an admin uid or `system:growth-cron`. */
  draftedBy: string;
  decidedBy?: string;
  decidedAt?: string;
  publishedAt?: string;
  publishChannel?: GrowthPublishChannel;
  /** Recipient of an emailed post (a real seller address) — never logged. */
  emailTo?: string;
  /** Honest email outcome: sent | dev_captured | failed. */
  emailStatus?: string;
  /** Per-channel outcomes, keyed by channel id (Phase 2A social results). */
  results?: Record<string, GrowthPublishResult>;
  /** Rejection/failure note — sanitized, never an upstream error body. */
  reason?: string;
  /**
   * Scheduling — the in-house Postiz layer. NOT a status: a post keeps its
   * queue state (approved, published, …) and carries a pending action on the
   * side. The scheduler tick publishes when this instant passes and clears
   * the fields afterwards; a post with no `scheduledAt` is never touched.
   */
  scheduledAt?: string;
  /** Social channels the tick will publish to — `copy`/`email` stay manual. */
  scheduledChannels?: SocialChannel[];
  /** Who scheduled it: an admin uid or `system:growth-scheduler`. */
  scheduledBy?: string;
}

/**
 * Bounds, so "it works while I sleep" can never mean "it spends while I
 * sleep". Every number has a hard cap the routes clamp against.
 */
export const GROWTH_POST_LIMITS = {
  /** Posts one draft run may create. */
  perRun: 3,
  perRunMax: 5,
  /** Posts one UTC day may create (cron + manual share the budget). */
  perDay: 12,
  /** Days a product sits out after being drafted (no repeat spam). */
  cooldownDays: 14,
  /** Product page read window for candidate selection. */
  scanLimit: 80,
  /** Posts returned by the admin list. */
  listLimit: 50,
  /** Scheduler: earliest a post may be scheduled (ms from now). */
  scheduleMinAheadMs: 60_000,
  /** Scheduler: furthest a post may be scheduled (days from now). */
  scheduleMaxAheadDays: 90,
  /** Scheduler: posts ONE tick may publish (bounded outbound spend). */
  schedulerPerRun: 5,
  /** Scheduler: channels one post may fan out to. */
  schedulerChannelsMax: 4,
} as const;

/** Clamp a requested run size into the safe range. */
export function clampDraftLimit(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : GROWTH_POST_LIMITS.perRun;
  return Math.min(GROWTH_POST_LIMITS.perRunMax, Math.max(1, n));
}

/** Provider status shape the admin page renders — env NAMES only. */
export interface GrowthProviderStatus {
  id: string;
  label: string;
  status: 'configured' | 'not_configured';
  requiredEnvVars: string[];
  note: string;
}
