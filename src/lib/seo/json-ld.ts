/**
 * JSON-LD BUILDERS — the structured-data half of the AI exposure engine.
 *
 * ## Why this file exists
 * The product and shop pages are client components: a crawler that does not
 * run JavaScript (most AI crawlers, many search crawlers) receives an empty
 * shell with a spinner. The segment layouts under
 * `src/app/products/[productId]` and `src/app/sellers/[sellerId]` render
 * these graphs into the initial HTML so every reader — search engine, AI
 * agent or shopping pipeline — sees the same real facts the page shows.
 *
 * ## Honesty rules (the marketplace invariants, encoded)
 * - Only fields the document actually carries are emitted. Missing data is
 *   OMITTED, never defaulted into a claim.
 * - `aggregateRating` / `review` are never emitted at all: rating markup has
 *   to match a rating quoted everywhere the page is shown, and reviews live
 *   inside a tab here, not on the card. Half-true markup is how sites lose
 *   rich results — so we leave ratings to the surfaces that show them.
 * - Prices follow the product page's display convention exactly
 *   (`localPrice || price`, `localCurrency || 'USD'`), so structured data can
 *   never disagree with the visible page.
 * - `availability` is emitted only when the document is unambiguous
 *   (`out_of_stock`, or a real stock number on a non-service listing);
 *   anything else stays silent rather than guessing "InStock".
 * - Media URLs must be absolute http(s); relative paths resolve against the
 *   public origin, anything else is dropped.
 * - Listings whose price mode is "get a quote" get NO offer: publishing
 *   `price: 0` would invent a number the seller never set.
 *
 * `serializeJsonLd` escapes `<` so no listing's text can close the script
 * tag — the standard App Router defence for user content in `<head>`.
 */
import { publicOrigin, publicUrl } from '@/lib/site-url';

type Doc = Record<string, unknown>;

/** Site identity — mirrors the root metadata in `src/app/layout.tsx`. */
export const SITE_NAME = 'Vidnov';
export const SITE_DESCRIPTION =
  'Discover a different way to connect businesses and people. Vidnov is where businesses, creators and customers meet.';

/* ── small field helpers ─────────────────────────────────────────────────── */

/**
 * Trimmed, whitespace-collapsed text capped to `max` characters, or null.
 * Newlines collapse so one field can never break a markdown list or a
 * single-line meta tag.
 */
export function cleanText(value: unknown, max = 200): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * An absolute http(s) URL, or null. Root-relative paths resolve against the
 * public origin; every other scheme (`data:`, `javascript:`, …) is dropped.
 */
export function absUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) return publicOrigin() + trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function asDoc(value: unknown): Doc | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Doc)
    : null;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * The price the page displays, in the currency the page displays:
 * `localPrice || price`, `localCurrency || 'USD'` (both uppercased).
 * Returns null when there is no usable price to show.
 */
export function resolveOffer(doc: Doc): { price: number; currency: string } | null {
  // "Get a quote" listings have no number the seller set — no offer at all.
  if (str(doc.priceMode) === 'quote') return null;
  const localPrice = num(doc.localPrice);
  const price = localPrice !== undefined ? localPrice : num(doc.price);
  if (price === undefined || price < 0) return null;
  const rawCurrency = str(doc.localCurrency);
  const currency = rawCurrency && /^[A-Za-z]{3}$/.test(rawCurrency.trim())
    ? rawCurrency.trim().toUpperCase()
    : 'USD';
  return { price, currency };
}

/**
 * schema.org availability, or null when the document is not unambiguous.
 * Mirrors the product page's own "unavailable" rule: an explicit
 * `out_of_stock` state always wins; otherwise a real stock number on a
 * NON-service listing decides (services legitimately run at 0 stock while
 * still bookable); known positive states map through; anything else is
 * unknown and stays OUT of the markup.
 */
export function schemaAvailability(doc: Doc): string | null {
  const state = (str(doc.availabilityState) ?? '').toLowerCase();
  if (state === 'out_of_stock') return 'https://schema.org/OutOfStock';
  const isService = str(doc.listingType) === 'service';
  const stock = num(doc.stock);
  if (stock !== undefined && !isService) {
    return stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
  }
  if (state === 'in_stock' || state === 'available') return 'https://schema.org/InStock';
  if (state === 'preorder' || state === 'pre_order') return 'https://schema.org/PreOrder';
  if (state === 'sold_out' || state === 'unavailable') return 'https://schema.org/OutOfStock';
  return null;
}

/** `new`/`used` → schema.org condition URL; anything else is left out. */
function itemCondition(doc: Doc): string | undefined {
  const condition = (str(doc.condition) ?? '').toLowerCase();
  if (condition === 'new') return 'https://schema.org/NewCondition';
  if (condition === 'used') return 'https://schema.org/UsedCondition';
  return undefined;
}

/** Image URLs for a listing: primary image first, then the gallery, deduped. */
export function productImageUrls(doc: Doc): string[] {
  const out: string[] = [];
  const push = (value: unknown) => {
    const url = absUrl(value);
    if (url && !out.includes(url) && out.length < 10) out.push(url);
  };
  push(doc.imageUrl);
  if (Array.isArray(doc.imageUrls)) doc.imageUrls.forEach(push);
  return out;
}

/** https video URLs for a listing (primary + gallery), deduped, max 5. */
export function productVideoUrls(doc: Doc): string[] {
  const out: string[] = [];
  const push = (value: unknown) => {
    const url = absUrl(value);
    if (url && !out.includes(url) && out.length < 5) out.push(url);
  };
  push(doc.videoUrl);
  if (Array.isArray(doc.videoUrls)) doc.videoUrls.forEach(push);
  return out;
}

/* ── graphs ──────────────────────────────────────────────────────────────── */

/**
 * `Product` + `Offer` for one listing, or null when the document cannot
 * back a graph at all (no name). Deep-copies nothing: only known-good
 * fields are lifted into the output.
 */
export function buildProductJsonLd(doc: Doc, productId: string): Doc | null {
  const name = cleanText(doc.name, 200);
  if (!name) return null;
  const url = publicUrl(`/products/${productId}`);

  const out: Doc = { '@context': 'https://schema.org', '@type': 'Product', '@id': url, name, url };

  const description = cleanText(doc.description, 1000);
  if (description) out.description = description;

  const images = productImageUrls(doc);
  if (images.length) out.image = images;

  const videos = productVideoUrls(doc);
  if (videos.length) {
    out.video = videos.map((contentUrl) => ({
      '@type': 'VideoObject',
      name: name,
      contentUrl,
      embedUrl: contentUrl,
    }));
  }

  const brand = cleanText(doc.brand, 120);
  if (brand) out.brand = { '@type': 'Brand', name: brand };

  const category = cleanText(doc.category, 120);
  if (category) out.category = category;

  const sellerId = str(doc.sellerId);
  if (sellerId) {
    out.seller = { '@type': 'Organization', '@id': publicUrl(`/sellers/${sellerId}`) };
  }

  const offer = resolveOffer(doc);
  if (offer) {
    const schemaOffer: Doc = {
      '@type': 'Offer',
      url,
      price: String(offer.price),
      priceCurrency: offer.currency,
    };
    const availability = schemaAvailability(doc);
    if (availability) schemaOffer.availability = availability;
    const condition = itemCondition(doc);
    if (condition) schemaOffer.itemCondition = condition;
    out.offers = schemaOffer;
  }

  // NOTE: deliberately no `aggregateRating` / `review` — see file header.
  return out;
}

/**
 * `Store` graph for a shop page, or null when there is no shop name to
 * anchor it on (a profile-only page gets no graph rather than a guess).
 */
export function buildShopJsonLd(doc: Doc, sellerId: string): Doc | null {
  const name = cleanText(doc.shopName, 200);
  if (!name) return null;
  const url = publicUrl(`/sellers/${sellerId}`);

  const out: Doc = { '@context': 'https://schema.org', '@type': 'Store', '@id': url, name, url };

  const logo = absUrl(doc.logoUrl);
  if (logo) out.image = logo;

  const description = cleanText(doc.description, 600);
  if (description) out.description = description;

  const sameAs: string[] = [];
  for (const field of ['facebookUrl', 'instagramUrl', 'twitterUrl'] as const) {
    const link = absUrl(doc[field]);
    if (link && !sameAs.includes(link)) sameAs.push(link);
  }
  if (Array.isArray(doc.socialLinks)) {
    for (const raw of doc.socialLinks) {
      const link = absUrl(asDoc(raw)?.url);
      if (link && !sameAs.includes(link) && sameAs.length < 10) sameAs.push(link);
    }
  }
  if (sameAs.length) out.sameAs = sameAs;

  const locality = cleanText(doc.cityTown, 120);
  const region = cleanText(doc.county, 120);
  const street = cleanText(doc.location, 200);
  if (locality || region || street) {
    const address: Doc = { '@type': 'PostalAddress' };
    if (street) address.streetAddress = street;
    if (locality) address.addressLocality = locality;
    if (region) address.addressRegion = region;
    out.address = address;
  }

  const phone = cleanText(doc.contactPhone, 40);
  if (phone) out.telephone = phone;

  // NOTE: no `aggregateRating` here either — see file header.
  return out;
}

/** The site-wide `Organization` graph (root layout `<head>`). */
export function buildOrganizationJsonLd(): Doc {
  const origin = publicOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': origin,
    name: SITE_NAME,
    url: origin,
    logo: absUrl('/icons/icon-192.png') ?? `${origin}/icons/icon-192.png`,
    description: SITE_DESCRIPTION,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${origin}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * `BreadcrumbList` from a Home-first trail. Callers pass only URLs that
 * really resolve (a breadcrumb that links a 404 costs more than it earns).
 */
export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]): Doc | null {
  const usable = items.filter((item) => item.name && item.url);
  if (usable.length < 2) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: usable.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Serialize a graph for `<script type="application/ld+json">`.
 * `<` is escaped so no listing text can terminate the script element.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
