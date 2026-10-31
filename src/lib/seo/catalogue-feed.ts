/**
 * CATALOGUE FEED for the machine surfaces — `/llms.txt` and `/products.json`.
 *
 * ## Why this file exists
 * Sitemaps serve search crawlers; AI agents read a different way: they fetch
 * a small human/machine-readable index of what a site sells. These builders
 * turn the SAME public catalogue the sitemap uses into:
 *
 *  - `buildLlmsText`    — an [llms.txt](https://llmstxt.org) style markdown
 *                         index: one link per real listing/shop, prices only
 *                         where the document carries them.
 *  - `buildProductsPayload` — a stable JSON feed (`/products.json`) with the
 *                         product facts an agent needs to quote a listing:
 *                         url, price, currency, availability, images, video.
 *
 * ## Honesty rules
 * - Sources mirror the sitemap: PocketBase first, Firestore fallback,
 *   visibility rules unchanged (`isPublicListingDoc`) + the suspended-owner
 *   deny-set when the mirror can supply one.
 * - Missing fields are omitted from every entry; a listing without a name is
 *   not listed at all (an unnamed link helps no buyer or agent).
 * - Availability/currency come from the same helpers the JSON-LD uses, so
 *   every surface quotes the same facts.
 * - Caps (500 products / 200 shops) keep the files small enough that an
 *   agent fetches them in one round trip; `source` is reported honestly.
 *
 * Server-only: reads PocketBase / Firestore. The pure builders are
 * dependency-light and unit-tested in `src/tests/ai-exposure.test.ts`.
 */
import { publicUrl } from '@/lib/site-url';
import { pocketBaseEnabled, pbListRecordsPage } from '@/lib/pocketbase/server';
import { PRODUCTS_COLLECTION } from '@/lib/pocketbase/products';
import { SHOPS_COLLECTION } from '@/lib/pocketbase/shops';
import {
  isPublicListingDoc,
  pbPageFetcher,
  readSuspendedUids,
  type PageFetcher,
} from '@/lib/sitemap-catalogue';
import { SITEMAP_ORIGIN } from '@/lib/sitemap-entries';
import {
  cleanText,
  productImageUrls,
  productVideoUrls,
  resolveOffer,
  schemaAvailability,
  SITE_DESCRIPTION,
  SITE_NAME,
} from '@/lib/seo/json-ld';

/** Feed caps — deliberately smaller than the sitemap's. */
export const FEED_MAX_PRODUCTS = 500;
export const FEED_MAX_SHOPS = 200;
/** One page read per collection: mirrors the sitemap's page ceiling. */
const PAGE_SIZE = 500;
const MAX_PAGES = 4;

export interface SeoProductEntry {
  id: string;
  url: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  availability?: string;
  category?: string;
  condition?: string;
  sellerId?: string;
  images: string[];
  video?: string;
  updatedAt?: string;
}

export interface SeoShopEntry {
  id: string;
  url: string;
  name: string;
  description?: string;
  logo?: string;
  sameAs: string[];
  updatedAt?: string;
}

export interface SeoCatalogue {
  products: SeoProductEntry[];
  shops: SeoShopEntry[];
  source: 'pocketbase' | 'firestore';
}

/* ── field helpers ───────────────────────────────────────────────────────── */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** ISO stamp from an ISO string or a Firestore Timestamp-shaped object. */
function isoStamp(value: unknown): string | undefined {
  if (typeof value === 'string') return /^\d{4}-\d{2}-\d{2}T/.test(value) ? value : undefined;
  const maybe = asRecord(value);
  if (maybe && typeof maybe.toDate === 'function') {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** One public product entry from a listing document, or null (no name). */
export function toProductEntry(
  id: string,
  doc: Record<string, unknown>,
): SeoProductEntry | null {
  const name = cleanText(doc.name, 200);
  if (!name) return null;
  const offer = resolveOffer(doc);
  const entry: SeoProductEntry = {
    id,
    url: publicUrl(`/products/${id}`),
    name,
    images: productImageUrls(doc),
  };
  const description = cleanText(doc.description, 400);
  if (description) entry.description = description;
  if (offer) {
    entry.price = offer.price;
    entry.currency = offer.currency;
  }
  const availability = schemaAvailability(doc);
  if (availability) entry.availability = availability;
  const category = cleanText(doc.category, 80);
  if (category) entry.category = category;
  const condition = cleanText(doc.condition, 20);
  if (condition) entry.condition = condition;
  const sellerId = str(doc.sellerId);
  if (sellerId) entry.sellerId = sellerId;
  const video = productVideoUrls(doc)[0];
  if (video) entry.video = video;
  const updated = isoStamp(doc.updatedAt) ?? isoStamp(doc.uploadDate);
  if (updated) entry.updatedAt = updated;
  return entry;
}

/** One public shop entry from a shop document, or null (no shop name). */
export function toShopEntry(id: string, doc: Record<string, unknown>): SeoShopEntry | null {
  const name = cleanText(doc.shopName, 200);
  if (!name) return null;
  const entry: SeoShopEntry = {
    id,
    url: publicUrl(`/sellers/${id}`),
    name,
    sameAs: [],
  };
  const description = cleanText(doc.description, 300);
  if (description) entry.description = description;
  const logo = typeof doc.logoUrl === 'string' && doc.logoUrl.trim() ? doc.logoUrl.trim() : null;
  if (logo) entry.logo = logo;
  for (const field of ['facebookUrl', 'instagramUrl', 'twitterUrl'] as const) {
    const link = str(doc[field]);
    if (link && !entry.sameAs.includes(link) && entry.sameAs.length < 10) entry.sameAs.push(link);
  }
  const updated = isoStamp(doc.updatedAt);
  if (updated) entry.updatedAt = updated;
  return entry;
}

/* ── loaders (PB first, Firestore fallback) ──────────────────────────────── */

async function collect(
  fetchPage: PageFetcher,
  collection: string,
  opts: {
    max: number;
    filter?: string;
    sort?: string;
    take: (record: Record<string, unknown>) => Record<string, unknown> | null;
  },
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let page = 1;
  for (;;) {
    const { items, totalItems } = await fetchPage(collection, {
      page,
      perPage: PAGE_SIZE,
      filter: opts.filter,
      sort: opts.sort,
    });
    for (const record of items) {
      if (out.length >= opts.max) return out;
      const taken = opts.take(record);
      if (taken) out.push(taken);
    }
    if (out.length >= opts.max) return out;
    if (items.length === 0) break;
    if (page * PAGE_SIZE >= totalItems) break;
    if (page >= MAX_PAGES) break;
    page += 1;
  }
  return out;
}

function mirrorProductDoc(record: Record<string, unknown>): Record<string, unknown> | null {
  const data = asRecord(record.data);
  if (!data) return null;
  const doc = typeof data.status === 'string' ? data : { ...data, status: record.status };
  if (!isPublicListingDoc(doc)) return null;
  const id = str(record.fsId);
  if (!id) return null;
  const entry = toProductEntry(id, doc);
  return entry ? { __entry: entry, __owner: str(doc.sellerId) ?? str(record.sellerId) ?? '' } : null;
}

function mirrorShopDoc(record: Record<string, unknown>): Record<string, unknown> | null {
  const data = asRecord(record.data);
  if (!data || !isPublicListingDoc(data)) return null;
  const id = str(record.fsId) ?? str(data.ownerId);
  if (!id) return null;
  const entry = toShopEntry(id, data);
  return entry ? { __entry: entry, __owner: id } : null;
}

async function loadFromPocketBase(): Promise<SeoCatalogue | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    const products = await collect(pbPageFetcher, PRODUCTS_COLLECTION, {
      max: FEED_MAX_PRODUCTS,
      filter: "status != 'deleted'",
      sort: '-createdAt',
      take: mirrorProductDoc,
    });
    const shops = await collect(pbPageFetcher, SHOPS_COLLECTION, {
      max: FEED_MAX_SHOPS,
      take: mirrorShopDoc,
    });
    // Suspended owners drop out of discovery — best-effort, never blocking.
    const suspended = await readSuspendedUids(pbPageFetcher);
    const allowed = (owner: string) => !suspended || !owner || !suspended.has(owner);
    return {
      products: products
        .filter((row) => allowed(String(row.__owner ?? '')))
        .map((row) => row.__entry as SeoProductEntry)
        .slice(0, FEED_MAX_PRODUCTS),
      shops: shops
        .filter((row) => allowed(String(row.__owner ?? '')))
        .map((row) => row.__entry as SeoShopEntry)
        .slice(0, FEED_MAX_SHOPS),
      source: 'pocketbase',
    };
  } catch (error) {
    console.error('[seo] PocketBase catalogue read failed:', error instanceof Error ? error.name : 'error');
    return null;
  }
}

async function loadFromFirestore(): Promise<SeoCatalogue | null> {
  try {
    const { db } = await import('@/firebase/server');
    const [productsSnap, shopsSnap] = await Promise.all([
      db.collection('products').orderBy('uploadDate', 'desc').limit(FEED_MAX_PRODUCTS).get(),
      db.collection('sellerShops').limit(FEED_MAX_SHOPS).get(),
    ]);
    const products: SeoProductEntry[] = [];
    for (const docSnap of productsSnap.docs) {
      const doc = (docSnap.data() ?? {}) as Record<string, unknown>;
      if (!isPublicListingDoc(doc)) continue;
      const entry = toProductEntry(docSnap.id, doc);
      if (entry) products.push(entry);
      if (products.length >= FEED_MAX_PRODUCTS) break;
    }
    const shops: SeoShopEntry[] = [];
    for (const docSnap of shopsSnap.docs) {
      const doc = (docSnap.data() ?? {}) as Record<string, unknown>;
      if (!isPublicListingDoc(doc)) continue;
      const entry = toShopEntry(docSnap.id, doc);
      if (entry) shops.push(entry);
      if (shops.length >= FEED_MAX_SHOPS) break;
    }
    return { products, shops, source: 'firestore' };
  } catch (error) {
    console.error('[seo] Firestore catalogue read failed:', error instanceof Error ? error.name : 'error');
    return null;
  }
}

/**
 * The public catalogue: PocketBase first, Firestore fallback, or an EMPTY
 * truthful catalogue when no source can vouch for one (never fabricated).
 */
export async function loadSeoCatalogue(): Promise<SeoCatalogue> {
  const mirror = await loadFromPocketBase();
  if (mirror && (mirror.products.length || mirror.shops.length)) return mirror;
  const firestore = await loadFromFirestore();
  if (firestore) return firestore;
  return mirror ?? { products: [], shops: [], source: 'pocketbase' };
}

/* ── pure builders ───────────────────────────────────────────────────────── */

/** Markdown-safe single line: brackets/parens stripped so links stay parseable. */
function mdLabel(value: string): string {
  return value.replace(/[[\]()<>]/g, '').trim();
}

/**
 * The `/llms.txt` document. Spec shape: H1 → blockquote summary → sections
 * of `- [Name](url)` lines. When the catalogue is empty the file says so
 * plainly instead of inventing entries.
 */
export function buildLlmsText(catalogue: SeoCatalogue): string {
  const lines: string[] = [];
  lines.push(`# ${SITE_NAME}`);
  lines.push('');
  lines.push(
    `> ${SITE_DESCRIPTION} Every link below is a public page that renders its full content in the initial HTML; the machine-readable catalogue with prices, availability, images and video is at ${publicUrl('/products.json')}.`,
  );
  lines.push('');

  if (catalogue.products.length) {
    lines.push('## Products');
    lines.push('');
    for (const product of catalogue.products) {
      const label = mdLabel(product.name);
      if (!label) continue;
      const facts: string[] = [];
      if (product.price !== undefined && product.currency) {
        facts.push(`${product.currency} ${product.price}`);
      }
      if (product.category) facts.push(mdLabel(product.category));
      lines.push(`- [${label}](${product.url})${facts.length ? `: ${facts.join(' · ')}` : ''}`);
    }
    lines.push('');
  }

  if (catalogue.shops.length) {
    lines.push('## Shops');
    lines.push('');
    for (const shop of catalogue.shops) {
      const label = mdLabel(shop.name);
      if (!label) continue;
      lines.push(`- [${label}](${shop.url})`);
    }
    lines.push('');
  }

  if (!catalogue.products.length && !catalogue.shops.length) {
    lines.push(
      'No public listings are available at this moment. Check the sitemap for the current indexable pages.',
    );
    lines.push('');
  }

  // The sitemap pointer mirrors robots.txt exactly: it names the sitemap's
  // own canonical origin (SITEMAP_ORIGIN), not an env-derived app URL that
  // could differ and hand AI agents a redirect.
  lines.push(`Sitemap: ${SITEMAP_ORIGIN}/sitemap.xml`);
  lines.push('');
  return lines.join('\n');
}

/**
 * The `/products.json` payload — the same entries as llms.txt plus the
 * media/price facts, with an honest `source` and `generatedAt` stamp.
 */
export function buildProductsPayload(
  catalogue: SeoCatalogue,
  generatedAt: Date = new Date(),
): string {
  const payload = {
    site: SITE_NAME,
    description: SITE_DESCRIPTION,
    generatedAt: generatedAt.toISOString(),
    source: catalogue.source,
    productCount: catalogue.products.length,
    shopCount: catalogue.shops.length,
    products: catalogue.products,
    shops: catalogue.shops,
    sitemap: `${SITEMAP_ORIGIN}/sitemap.xml`,
  };
  return JSON.stringify(payload, null, 2);
}
