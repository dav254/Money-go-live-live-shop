/**
 * DISTRIBUTION HUB — product eligibility (pure).
 *
 * The gate every distribution job must pass, and re-pass whenever the
 * reconciliation sweep re-checks a listing. Answers ONE question: may this
 * product be pushed to external destinations right now?
 *
 * Checks (documented, deterministic, no I/O):
 *   1. **URL safety**     — the document id must be a safe public URL segment
 *                           (`/products/{id}`), never a path or host.
 *   2. **Ownership**      — a real, non-empty `sellerId` string exists. The
 *                           id is verified against the STORED document by the
 *                           service; here we only require that it exists.
 *   3. **Required fields**— a non-empty name and a finite, non-negative
 *                           price (services may legitimately be price-on-quote).
 *   4. **Image availability** — at least one http(s) image URL; a listing
 *                           without a picture is not something to syndicate.
 *   5. **Visibility**      — explicit opt-out flags (`hidden`, `archived`,
 *                           `isActive: false`, `status: hidden/removed/...`)
 *                           make a listing ineligible. Absent flags mean
 *                           visible, mirroring the Product type's semantics
 *                           ("absent means available").
 *
 * Reasons are a small, stable vocabulary so the admin UI can group them —
 * never free-form upstream text.
 */

import { DOC_ID_PATTERN } from '../types';

/** Stable, safe-to-display eligibility failure reasons. */
export const INELIGIBILITY_REASONS = [
  'unsafe_id',
  'missing_seller',
  'missing_name',
  'invalid_price',
  'missing_image',
  'not_visible',
] as const;
export type IneligibilityReason = (typeof INELIGIBILITY_REASONS)[number];

export interface EligibilityResult {
  eligible: boolean;
  reasons: IneligibilityReason[];
  /** The same-site public path for this listing, when the id is safe. */
  publicPath: string | null;
}

/** Explicit opt-out markers a listing may carry (any one ⇒ not visible). */
const HIDDEN_STATUS = new Set(['hidden', 'removed', 'unpublished', 'draft', 'archived']);

function isHttpUrl(value: unknown): boolean {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value) && value.length <= 2048;
}

function hasImage(data: Record<string, unknown>): boolean {
  if (isHttpUrl(data.imageUrl)) return true;
  for (const key of ['imageUrls', 'thumbnailUrls'] as const) {
    const list = data[key];
    if (Array.isArray(list) && list.some(isHttpUrl)) return true;
  }
  return false;
}

/** True when the document explicitly says the listing is not publicly listed. */
export function isVisiblyHidden(data: Record<string, unknown>): boolean {
  if (data.hidden === true) return true;
  if (data.archived === true) return true;
  if (data.isActive === false) return true;
  if (data.listed === false) return true;
  if (data.visibility === 'private') return true;
  if (typeof data.status === 'string' && HIDDEN_STATUS.has(data.status.toLowerCase())) {
    return true;
  }
  return false;
}

/**
 * Decides whether one product document may be distributed. Pure and
 * side-effect free: reconciliation and job creation share this one answer so
 * "eligible" can never mean two different things.
 */
export function evaluateProductEligibility(
  productId: string,
  data: Record<string, unknown>,
): EligibilityResult {
  const reasons: IneligibilityReason[] = [];

  const idSafe = typeof productId === 'string' && DOC_ID_PATTERN.test(productId);
  if (!idSafe) reasons.push('unsafe_id');

  if (typeof data.sellerId !== 'string' || !data.sellerId.trim()) reasons.push('missing_seller');
  if (typeof data.name !== 'string' || !data.name.trim()) reasons.push('missing_name');

  const price = data.price;
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) reasons.push('invalid_price');

  if (!hasImage(data)) reasons.push('missing_image');
  if (isVisiblyHidden(data)) reasons.push('not_visible');

  return {
    eligible: reasons.length === 0,
    reasons,
    publicPath: idSafe ? `/products/${productId}` : null,
  };
}
