/**
 * Pure campaign content rules for the Vidnov → Postiz integration.
 *
 * Everything here is a pure function over a stored product document: it can
 * only re-state fields that genuinely exist on the record. It never derives
 * discounts, availability claims, ratings, or prices — if a field is missing
 * or invalid, the listing is excluded rather than guessed around.
 */

/** Platform-agnostic safe cap. X (free) allows 280; other channels allow more. */
export const MAX_CAMPAIGN_CHARS = 280;
/** Fixed attribution tag so campaign clicks are attributable in Vidnov. */
export const CAMPAIGN_REF = 'postiz';

/** The subset of the `products` document these rules read. */
export interface ProductLike {
  name?: unknown;
  price?: unknown;
  localCurrency?: unknown;
  availabilityState?: unknown;
  stock?: unknown;
  listingType?: unknown;
}

export type EligibilityReason = 'missing_name' | 'missing_price' | 'unavailable';
export type Eligibility =
  | { eligible: true; price: number }
  | { eligible: false; reason: EligibilityReason };

const UNAVAILABLE_STATES = new Set(['out_of_stock', 'fully_booked']);

/** Strips control characters and collapses whitespace — safe single-line text. */
export function cleanLine(raw: string, max: number): string {
  const flat = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/**
 * Gate for promoting a listing into a campaign.
 *
 * - a real name and a real price (> 0) are mandatory;
 * - `availabilityState` is authoritative when present (it is the field the
 *   storefront itself trusts): out_of_stock / fully_booked are excluded;
 * - with no state, `stock <= 0` excludes products — services
 *   (`listingType: 'service'`) have no stock concept and are not judged on it.
 */
export function checkProductEligibility(product: ProductLike): Eligibility {
  const name = typeof product.name === 'string' ? product.name.trim() : '';
  if (!name) return { eligible: false, reason: 'missing_name' };

  const price = typeof product.price === 'number' ? product.price : Number.NaN;
  if (!Number.isFinite(price) || price <= 0) {
    return { eligible: false, reason: 'missing_price' };
  }

  const state =
    typeof product.availabilityState === 'string' ? product.availabilityState : '';
  if (state) {
    if (UNAVAILABLE_STATES.has(state)) return { eligible: false, reason: 'unavailable' };
    return { eligible: true, price };
  }

  const isService = product.listingType === 'service';
  if (!isService && typeof product.stock === 'number' && product.stock <= 0) {
    return { eligible: false, reason: 'unavailable' };
  }
  return { eligible: true, price };
}

/** Formats the stored number exactly as stored — no invented rounding. */
export function formatPrice(price: number): string {
  return Number.isInteger(price) ? String(price) : price.toFixed(2);
}

/**
 * Renders the campaign text from stored facts only:
 *
 *   [admin note (optional, human marketing copy)]
 *   <product name>
 *   <price> [currency when the record has one]
 *   <product link + attribution>
 *
 * The link line is never truncated; the note and name are bounded.
 */
export function buildCampaignText(input: {
  productId: string;
  product: ProductLike;
  appUrl: string;
  note?: string;
}): string {
  const appUrl = input.appUrl.replace(/\/+$/, '');
  const link = `${appUrl}/products/${encodeURIComponent(input.productId)}?ref=${CAMPAIGN_REF}`;

  const name = cleanLine(String(input.product.name ?? ''), 140);
  const price = Number(input.product.price);
  const currency =
    typeof input.product.localCurrency === 'string' &&
    input.product.localCurrency.trim() &&
    /^[A-Za-z]{3,4}$/.test(input.product.localCurrency.trim())
      ? input.product.localCurrency.trim().toUpperCase()
      : '';
  const facts = currency
    ? `${formatPrice(price)} ${currency}`
    : formatPrice(price);

  const note = input.note ? cleanLine(input.note, 120) : '';
  const body = [note, name, facts].filter(Boolean).join('\n');

  // Budget: link + newlines are reserved first, everything else fits inside
  // what remains. Never truncate the link or the facts — trim the human copy.
  const reserved = link.length + 2;
  const room = MAX_CAMPAIGN_CHARS - reserved;
  if (body.length <= room) return `${body}\n${link}`;

  const factsLine = facts;
  const withoutNote = [name, factsLine].join('\n');
  if (withoutNote.length <= room) {
    // Drop the note first: facts are stored, notes are garnish.
    return `${withoutNote}\n${link}`;
  }
  const nameRoom = Math.max(1, room - factsLine.length - 1);
  return `${cleanLine(name, nameRoom)}\n${factsLine}\n${link}`;
}

/**
 * Server-side note hygiene for admin-supplied marketing copy.
 */
export function sanitizeNote(raw: string): string {
  return cleanLine(raw, 500);
}

/**
 * What Vidnov is allowed to claim about a post, and when.
 *
 * `draft`   → `accepted`  (created in Postiz, not scheduled, not published)
 * `schedule`→ `scheduled` (a time is queued — still NOT published)
 * `published` is DELIBERATELY unreachable from the create API: only a
 * provider/Webhook confirmation may ever produce it, and this integration
 * does not receive one yet. See docs in ops/postiz/README.md.
 */
export type PostizOutcome = 'accepted' | 'scheduled' | 'failed';

export function outcomeForCreate(type: 'draft' | 'schedule'): 'accepted' | 'scheduled' {
  return type === 'schedule' ? 'scheduled' : 'accepted';
}
