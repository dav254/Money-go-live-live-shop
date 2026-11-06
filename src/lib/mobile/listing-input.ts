import { FieldValue } from 'firebase-admin/firestore';

/**
 * ONE LISTING CONTRACT for the mobile seller tools.
 *
 * Route modules may only export HTTP verbs and route config, so the validation
 * that create and edit share lives here. The rules mirror what the website's
 * upload form enforces, and every field is clamped before it reaches Firestore.
 */

export const MAX_IMAGES = 8;

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function money(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

/** Only media the Vidnov pipeline stored, or an absolute https asset. */
export function mediaRef(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/api/media/')) return trimmed;
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  return null;
}

export interface ListingInput {
  name?: unknown;
  description?: unknown;
  category?: unknown;
  listingType?: unknown;
  condition?: unknown;
  price?: unknown;
  currency?: unknown;
  wasPrice?: unknown;
  stock?: unknown;
  location?: unknown;
  deliveryOptions?: unknown;
  tags?: unknown;
  imageUrls?: unknown;
  unpublished?: unknown;
}

export type ListingResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Shared validation for create and edit — one contract, two verbs. Returns the
 * cleaned document or a sentence explaining exactly what is wrong. The caller
 * supplies the ownership and timestamps that must never come from the client.
 */
export function readListing(raw: ListingInput): ListingResult {
  const name = text(raw.name, 120);
  if (name.length < 2) return { ok: false, error: 'Give the listing a name of at least 2 characters.' };

  const description = text(raw.description, 5000);
  if (description.length < 10) {
    return { ok: false, error: 'Add a description of at least 10 characters.' };
  }

  const category = text(raw.category, 60);
  if (!category) return { ok: false, error: 'Choose a category.' };

  const listingType = raw.listingType === 'service' ? 'service' : 'product';
  const condition = raw.condition === 'used' ? 'used' : 'new';

  const price = money(raw.price);
  if (price === null) return { ok: false, error: 'Enter a price of 0 or more.' };

  const currency = text(raw.currency, 3).toUpperCase() || 'USD';
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: 'Choose a valid currency code.' };

  const wasPriceRaw = raw.wasPrice == null || raw.wasPrice === '' ? null : money(raw.wasPrice);
  if (wasPriceRaw !== null && wasPriceRaw < price) {
    return { ok: false, error: 'The “was” price must be higher than the current price.' };
  }

  const stockRaw = raw.stock == null || raw.stock === '' ? null : Number(raw.stock);
  if (stockRaw !== null && (!Number.isFinite(stockRaw) || stockRaw < 0)) {
    return { ok: false, error: 'Stock cannot be negative.' };
  }
  const stock = listingType === 'service' ? 0 : Math.floor(stockRaw ?? 1);

  const images: string[] = [];
  if (Array.isArray(raw.imageUrls)) {
    for (const item of raw.imageUrls) {
      const ref = mediaRef(item);
      if (!ref) continue;
      if (!images.includes(ref)) images.push(ref);
      if (images.length >= MAX_IMAGES) break;
    }
  }

  return {
    ok: true,
    value: {
      name,
      description,
      category,
      listingType,
      condition,
      price,
      localPrice: price,
      localCurrency: currency,
      wasPrice: wasPriceRaw,
      stock,
      location: text(raw.location, 120),
      deliveryOptions: text(raw.deliveryOptions, 300),
      tags: text(raw.tags, 200),
      imageUrl: images[0] ?? '',
      imageUrls: images,
      thumbnailUrls: images,
      videoUrl: '',
      videoUrls: [],
      videoThumbnailUrls: [],
      hasVideo: false,
      unpublished: raw.unpublished === true,
      availabilityState:
        listingType === 'service' ? 'available' : stock > 0 ? 'in_stock' : 'out_of_stock',
      updatedAt: FieldValue.serverTimestamp(),
    },
  };
}
