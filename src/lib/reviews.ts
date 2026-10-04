/**
 * REVIEWS & RATINGS — the trust layer.
 *
 * ## Why two-sided
 *
 * A marketplace where only customers can leave reviews has no way to describe
 * the person who did not turn up. Sellers rate each other too: a buyer who
 * orders a plumber and is stood up is exactly the person who needs to warn the
 * next buyer. Both directions are limited to completed orders, which is what
 * keeps it from being a weapon.
 *
 * ## Reviews hang off the ORDER, not the user
 *
 * `reviews/{orderId}` — one review per order, written by exactly one party
 * about the other. Two documents under that id (`byCustomer`, `bySeller`) would
 * need a merge and a race; one document with both fields is a single atomic
 * write and the "already reviewed" check is a field read.
 *
 * That also makes abuse harder: you cannot review someone you have never
 * transacted with, because you cannot produce the order id.
 */

/** 1–5. Deliberately not 10: people do not use the ends of a 10-point scale. */
export type ReviewRating = 1 | 2 | 3 | 4 | 5;

export const RATING_VALUES: ReviewRating[] = [1, 2, 3, 4, 5];

export function isValidRating(value: unknown): value is ReviewRating {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

/** Long enough for a real account, short enough that nobody skips it. */
export const REVIEW_TEXT_MAX = 1000;
export const REVIEW_TEXT_MIN = 3;

export const RATING_LABELS: Record<ReviewRating, string> = {
  1: 'Very poor',
  2: 'Poor',
  3: 'Okay',
  4: 'Good',
  5: 'Excellent',
};

/**
 * Only a COMPLETED order can be reviewed.
 *
 * Not "paid", not "shipped": a buyer who paid and never got the thing has every
 * right to say so, and letting them wait for a seller-controlled status is how
 * review systems lose their credibility.
 */
/**
 * `completed` is a legacy value: it is not in the `Order` union any more, but
 * documents written before the union was tightened can still carry it, and
 * Firestore types are compile-time only. Accepting it keeps those historical
 * orders reviewable instead of locking their buyers and sellers out forever.
 */
export const REVIEWABLE_ORDER_STATUSES = ['delivered', 'completed', 'cancelled'] as const;

export function isReviewableStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (REVIEWABLE_ORDER_STATUSES as readonly string[]).includes(status);
}

export interface Review {
  id: string;
  orderId: string;
  /** Who wrote it. */
  authorId: string;
  authorName: string;
  /** Who it is about. */
  subjectId: string;
  subjectName?: string;
  rating: ReviewRating;
  text: string;
  /** 'customer' — the buyer reviewed the seller. */
  role: 'customer' | 'seller';
  createdAt: any;
  /** Set by moderation; hidden reviews do not count toward the average. */
  status: 'published' | 'flagged' | 'removed';
  flaggedReason?: string;
}

/** Both sides of one order, stored on the single review document. */
export interface OrderReviewDoc {
  orderId: string;
  buyerId: string;
  sellerId: string;
  buyerName?: string;
  sellerName?: string;
  orderStatus: string;
  /** Buyer → seller. */
  byCustomer?: {
    rating: ReviewRating;
    text: string;
    authorId: string;
    authorName: string;
    createdAt: any;
    status: 'published' | 'flagged' | 'removed';
  };
  /** Seller → buyer. */
  bySeller?: {
    rating: ReviewRating;
    text: string;
    authorId: string;
    authorName: string;
    createdAt: any;
    status: 'published' | 'flagged' | 'removed';
  };
  updatedAt?: any;
}

/**
 * Averages, counted from PUBLISHED reviews only.
 *
 * A flagged or removed review must not move someone's average — otherwise
 * reporting a review would be a way to change a score, which is the opposite of
 * what reporting is for.
 */
export function averageRating(reviews: { rating: number; status?: string }[]): {
  average: number;
  count: number;
} {
  const live = reviews.filter((r) => (r.status ?? 'published') === 'published');
  if (live.length === 0) return { average: 0, count: 0 };
  const total = live.reduce((sum, r) => sum + Number(r.rating || 0), 0);
  return {
    average: Math.round((total / live.length) * 10) / 10,
    count: live.length,
  };
}

/**
 * Which side of an order a viewer is.
 *
 * Returns null for anyone who is neither party, and that null is what stops the
 * review form rendering at all for a bystander.
 */
export function reviewerSide(
  uid: string | null | undefined,
  buyerId: string,
  sellerId: string,
): 'customer' | 'seller' | null {
  if (!uid) return null;
  if (uid === buyerId) return 'customer';
  if (uid === sellerId) return 'seller';
  return null;
}

export function validateReviewInput(text: string, rating: unknown): string | null {
  if (!isValidRating(rating)) return 'Choose a rating from 1 to 5.';
  const trimmed = (text || '').trim();
  if (trimmed.length < REVIEW_TEXT_MIN) return 'Write a few words so others know what happened.';
  if (trimmed.length > REVIEW_TEXT_MAX) return `Keep it under ${REVIEW_TEXT_MAX} characters.`;
  return null;
}
