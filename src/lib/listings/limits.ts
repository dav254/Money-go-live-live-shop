/**
 * LISTING RULES — the platform's limits and payouts, in one file.
 *
 * ## Why these are constants and not scattered magic numbers
 *
 * The 60-second video trim, the 5-photos-per-listing cap and the per-seller
 * quota each lived in a different component, so "how much can a seller put up"
 * had no single answer and the copy in the UI could disagree with the code
 * that enforced it. Everything a seller can hit is here, and the UI reads these
 * values rather than repeating them.
 *
 * ## Services are listings, not a separate universe
 *
 * A plumber has no stock to ship, but they have exactly what a listing is: a
 * name, a price or a quote, images, video, comments, likes and an order. So a
 * service is the same Firestore document with `listingType: 'service'` and a
 * few extra fields — which is why services appear in the same feed, the same
 * shop, the same drawer and the same checkout as a product seller, instead of
 * a hollow "coming soon" section that nobody could ever trade through.
 */

/** Maximum length of one uploaded or recorded video. */
/**
 * 10 minutes.
 *
 * Video is the part of this marketplace we sell — the sections, the boosts and
 * the live tools are the revenue — so we do NOT ration it. What is left here is
 * not a product limit on how much a seller may use; it is the point at which
 * ffmpeg on a single small VPS stops being reliable. An hour-long 4K file is
 * not something one core can transcode inside a request, and a seller who hits
 * a timeout learns to distrust uploads entirely.
 *
 * The real constraint on cost is bandwidth, and that is solved with a CDN, not
 * with a smaller number in this file.
 */
export const MAX_VIDEO_SECONDS = 600;

/** Two minutes, said the way the seller-facing copy says it. */
export const MAX_VIDEO_LABEL = '10 minutes';

/**
 * Maximum length of one LIVE broadcast — SEVENTY MINUTES, the exact window
 * the seller pays for: `POST /api/live-session` charges 100 points for a
 * session with `timeRemainingMs = 70 minutes`, and the countdown the seller
 * watches is this number. Product decision (owner): a paid live session is a
 * show, not a clip, and nothing may cut it before the paid window ends — the
 * server-side watchdog uses this same constant for its ceiling.
 *
 * Deliberately INDEPENDENT of `MAX_VIDEO_SECONDS` (recorded uploads stay 10
 * minutes): the old "live must equal recorded" rule would have capped a paid
 * 70-minute show at the recorded-clip ceiling, cutting sellers off mid-broadcast
 * after taking their points.
 */
export const MAX_LIVE_SECONDS = 70 * 60;

/**
 * Media items a seller may have uploaded in total, images and videos together.
 *
 * Deliberately a single number across both kinds: a seller cannot dodge the cap
 * by uploading 80 clips instead of 80 photos, and the buyer scrolling the feed
 * sees the same thing either way.
 *
 * Counted across ALL of a seller's listings, not per listing — otherwise the
 * effective limit is 80 × (number of listings) and the number means nothing.
 */
export const SELLER_MEDIA_QUOTA_FREE = 80;

/**
 * Listing media kept alongside the one cover image/video.
 *
 * Photos are the buyer's evidence — the more angles the better — so eight.
 * Video is capped at ONE clip per listing: it is a hero demonstration, not a
 * gallery, and the feed plays the first clip anywhere.
 */
export const MAX_IMAGES_PER_LISTING = 8;
export const MAX_VIDEOS_PER_LISTING = 1;

/**
 * Minimum photos on a listing. A listing with no photo is invisible in the
 * feed and wastes a catalogue slot, so the form will not let one publish.
 */
export const MIN_IMAGES_PER_LISTING = 1;

/** Bytes caps. Kept here so the upload form and the API cannot disagree. */
export const MAX_IMAGE_SIZE_MB = 10;
export const MAX_VIDEO_SIZE_MB = 500;

/**
 * SERVICE CATEGORIES.
 *
 * Not an exhaustive trade list — it is a starting set that covers the work most
 * likely to be sold peer-to-peer in East Africa, and it is deliberately not
 * closed. A seller whose trade is missing can still list under "Other services"
 * and name it themselves; being unable to trade because the platform has not
 * heard of a job yet is the exact failure this platform is meant to avoid.
 */
export const SERVICE_CATEGORIES = [
  { key: 'plumbing', label: 'Plumbing' },
  { key: 'electrical', label: 'Electrical' },
  { key: 'carpentry', label: 'Carpentry' },
  { key: 'painting', label: 'Painting & decorators' },
  { key: 'cleaning', label: 'Cleaning' },
  { key: 'repair', label: 'Appliance & equipment repair' },
  { key: 'construction', label: 'Construction & masonry' },
  { key: 'moving', label: 'Moving & haulage' },
  { key: 'tutoring', label: 'Tutoring & lessons' },
  { key: 'beauty', label: 'Beauty & wellness' },
  { key: 'fitness', label: 'Fitness & coaching' },
  { key: 'catering', label: 'Catering & events' },
  { key: 'it', label: 'Computers & IT' },
  { key: 'automotive', label: 'Automotive' },
  { key: 'other', label: 'Other services' },
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number]['key'];

export function serviceCategoryLabel(key: string | null | undefined): string {
  return SERVICE_CATEGORIES.find((c) => c.key === key)?.label || 'Services';
}

/**
 * HOW A SERVICE IS PRICED.
 *
 * - `quote` — no price; the buyer asks and the seller quotes. This is how a
 *   plumber actually works, and forcing a number onto it is how a marketplace
 *   ends up with a "KSh 1" listing that means nothing.
 * - `hourly` — priced per hour, with an hours estimate the buyer can change.
 * - `fixed` — one price for one job, same as a product.
 */
export const PRICE_MODES = [
  { key: 'quote', label: 'Get a quote' },
  { key: 'hourly', label: 'Per hour' },
  { key: 'fixed', label: 'Fixed price' },
] as const;

export type PriceMode = (typeof PRICE_MODES)[number]['key'];

export function priceModeLabel(key: string | null | undefined): string {
  return PRICE_MODES.find((m) => m.key === key)?.label || 'Fixed price';
}

/**
 * VIEW & LIKE BONUSES.
 *
 * A seller who gets 10,000 views and 400 likes is doing something the platform
 * should reward, and today the feed pays them nothing for it. The ladder is
 * deliberately gentle at the bottom and steep at the top: a small seller should
 * feel the first milestone almost immediately, and a breakout seller should get
 * something worth changing their behaviour for.
 *
 * Milestones are PER LISTING and evaluated against lifetime totals, not a
 * rolling window, so a seller is never punished for an upload that took a
 * month to take off.
 */
export interface BonusTier {
  /** Views the listing must have passed. */
  views: number;
  /** Likes the listing must have passed. */
  likes: number;
  /** Points awarded once, the first time the listing crosses the tier. */
  points: number;
  label: string;
}

export const BONUS_TIERS: BonusTier[] = [
  { views: 100, likes: 5, points: 50, label: 'Getting noticed' },
  { views: 500, likes: 25, points: 150, label: 'Rising' },
  { views: 2_000, likes: 75, points: 400, label: 'Popular' },
  { views: 10_000, likes: 250, points: 1_000, label: 'Breakout' },
  { views: 50_000, likes: 1_000, points: 3_000, label: 'Viral' },
];

/** Everything a listing qualifies for, as points and the highest tier reached. */
export function bonusForListing(views: number, likes: number): {
  points: number;
  tier: BonusTier | null;
  nextTier: BonusTier | null;
} {
  const safeViews = Math.max(0, Number(views) || 0);
  const safeLikes = Math.max(0, Number(likes) || 0);

  const reached = BONUS_TIERS.filter((t) => safeViews >= t.views && safeLikes >= t.likes);
  const nextTier = BONUS_TIERS.find((t) => safeViews < t.views || safeLikes < t.likes) || null;

  return {
    points: reached.reduce((sum, t) => sum + t.points, 0),
    tier: reached.length ? reached[reached.length - 1] : null,
    nextTier,
  };
}

/**
 * Media items on one listing, counted the way the quota counts them.
 *
 * `videoUrls` is the array; `videoUrl` is the same first clip kept in the
 * legacy single-video field, so counting both would double-count it.
 */
export function mediaItemCount(listing: {
  imageUrls?: unknown;
  videoUrls?: unknown;
  videoUrl?: unknown;
} | null | undefined): number {
  if (!listing) return 0;
  const images = Array.isArray(listing.imageUrls) ? listing.imageUrls.length : 0;
  const videos = Array.isArray(listing.videoUrls) ? listing.videoUrls.length : listing.videoUrl ? 1 : 0;
  return images + videos;
}

/** Human-readable quota line, e.g. "48 of 80 media items used". */
export function quotaSummary(used: number): string {
  const remaining = Math.max(0, SELLER_MEDIA_QUOTA_FREE - used);
  return `${used} of ${SELLER_MEDIA_QUOTA_FREE} media items used · ${remaining} left`;
}
