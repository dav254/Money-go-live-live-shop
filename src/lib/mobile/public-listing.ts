/**
 * PUBLIC LISTING PROJECTION — one shape for every mobile read.
 *
 * The Android app reads the same `products` documents the website does, but it
 * must never receive the whole document: product docs carry seller-only and
 * moderation fields (cost notes, moderation flags, mirror bookkeeping,
 * counters) that no buyer screen needs and that must not travel to a device.
 *
 * So every mobile route maps documents through `projectListing()` and the
 * client only ever sees this explicit field list. Adding a field to a product
 * does not silently widen the public surface — it has to be added here.
 *
 * The projection is deliberately *optional-heavy*: the app renders documents
 * written by the website, the seller dashboard, the VPS mirror and older schema
 * generations. A missing field must degrade to a hidden line, never a crash.
 */

export interface PublicListing {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  tags?: string;
  location?: string;
  vendorLocation?: string;
  price?: number;
  localPrice?: number;
  localCurrency?: string;
  wasPrice?: number;
  stock?: number;
  availabilityState?: string;
  sellerId?: string;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  videoUrls?: string[];
  condition?: 'new' | 'used';
  listingType?: 'product' | 'service';
  priceMode?: 'quote' | 'hourly' | 'fixed';
  /** ISO 8601, or null when the document has no usable timestamp. */
  uploadedAt?: string | null;
  /** Public like counter — read-only, the same field the website writes. */
  likes?: number;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function strList(value: unknown, max = 8): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  // De-duplicated: a seller who uploads the same photo twice should not get two
  // identical gallery panes on the phone (or pay to transfer it twice).
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim()) continue;
    seen.add(item);
    if (seen.size >= max) break;
  }
  return seen.size ? Array.from(seen) : undefined;
}

/** Firestore Timestamp | ISO string | number → ISO string (null when unknown). */
export function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === 'object') {
    const maybe = value as { toDate?: () => Date; toMillis?: () => number; _seconds?: number; seconds?: number };
    if (typeof maybe.toDate === 'function') {
      try {
        return maybe.toDate().toISOString();
      } catch {
        return null;
      }
    }
    if (typeof maybe.toMillis === 'function') {
      try {
        return new Date(maybe.toMillis()).toISOString();
      } catch {
        return null;
      }
    }
    const seconds = maybe._seconds ?? maybe.seconds;
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      return new Date(seconds * 1000).toISOString();
    }
  }
  return null;
}

/** A public seller card — four display fields, nothing else. */
export interface PublicSeller {
  id: string;
  name?: string;
  shopName?: string;
  avatarUrl?: string;
  location?: string;
  role?: string;
  verified?: boolean;
}

export function projectSeller(
  id: string,
  data: Record<string, unknown> | null | undefined,
): PublicSeller {
  const d = data ?? {};
  return {
    id,
    name: str(d.fullName) ?? str(d.displayName) ?? str(d.name),
    shopName: str(d.shopName),
    avatarUrl: str(d.profilePictureUrl) ?? str(d.avatarUrl) ?? str(d.photoURL),
    location: str(d.location) ?? str(d.city),
    role: str(d.userRole) ?? str(d.role),
    verified: d.verificationStatus === 'verified' || d.isVerified === true,
  };
}

/** Map one product document (Firestore doc or VPS mirror payload) to the public shape. */
export function projectListing(id: string, data: Record<string, unknown> | null | undefined): PublicListing {
  const d = data ?? {};
  const listingType =
    d.listingType === 'service' || d.listingType === 'product' ? d.listingType : undefined;
  const priceMode =
    d.priceMode === 'quote' || d.priceMode === 'hourly' || d.priceMode === 'fixed'
      ? d.priceMode
      : undefined;

  return {
    id,
    name: str(d.name),
    description: str(d.description),
    category: str(d.category),
    tags: str(d.tags),
    location: str(d.location) ?? str(d.city),
    vendorLocation: str(d.vendorLocation),
    price: num(d.price),
    localPrice: num(d.localPrice),
    localCurrency: str(d.localCurrency),
    wasPrice: num(d.wasPrice),
    stock: num(d.stock),
    availabilityState: str(d.availabilityState),
    sellerId: str(d.sellerId),
    imageUrl: str(d.imageUrl),
    imageUrls: strList(d.imageUrls),
    videoUrl: str(d.videoUrl),
    videoUrls: strList(d.videoUrls, 4),
    condition: d.condition === 'new' || d.condition === 'used' ? d.condition : undefined,
    listingType,
    priceMode,
    uploadedAt: toIso(d.uploadDate) ?? toIso(d.createdAt),
    likes: num(d.likes),
  };
}

/** Every image a listing can show, primary first, de-duplicated. */
export function listingImages(listing: PublicListing): string[] {
  const all = [listing.imageUrl, ...(listing.imageUrls ?? [])].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );
  return Array.from(new Set(all)).slice(0, 8);
}
