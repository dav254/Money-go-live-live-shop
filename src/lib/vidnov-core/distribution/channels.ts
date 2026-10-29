/**
 * DISTRIBUTION HUB — channel/destination registry and adapters.
 *
 * ## Honesty contract
 * These adapters VALIDATE and PREPARE product payloads for external
 * destinations. The three commerce feeds (Google Merchant Center, Meta
 * Commerce, TikTok Shop) have real submit/verify adapters in `adapters.ts`,
 * but credentials still gate everything: without official credentials there
 * is no code path that may leave `ready`, and `integrationStatus()` is
 * derived from environment-variable PRESENCE only (never values). A
 * destination with no credentials produces jobs that stop at `ready` with
 * a clear, safe message; only a verify step reading a platform status
 * source may ever report `published`.
 *
 * ## Destination kinds
 *   • `feed`      — commerce product feeds (submit + status-verified);
 *   • `local`     — OUR OWN public surfaces (sitemap): no credentials, the
 *                   engine can verify them against our own source of truth;
 *   • `indexing`  — URL-indexing APIs (IndexNow);
 *   • `webmaster` — search-engine webmaster consoles (Search Console, Bing);
 *   • `analytics` — measurement connections (GA4): platform-level only, they
 *                   never take per-listing jobs.
 *
 * ## What we deliberately do NOT do
 * No scraping, no unofficial publishing, no fake engagement, no bypassing
 * platform restrictions. Every submission goes through the platform's
 * official API with its documented auth scheme; without credentials the
 * service refuses to queue and the engine refuses to call out.
 *
 * Pure module: no Firestore, no network. Safe for tests.
 */

import type { ChannelId, ConfirmationState, IntegrationStatus, JobStatus } from '../types';
import type { ProductRef, SellerRef } from '../types';

/** Payload schema version — part of the idempotency id, bump on format change. */
export const PAYLOAD_VERSION = 'v1';

/** What a destination is, and what the engine may ever do with it. */
export type DestinationKind = 'feed' | 'local' | 'indexing' | 'webmaster' | 'analytics';

export interface DestinationCapabilities {
  /** The engine may call this destination's official API for queued jobs. */
  submit: boolean;
  /** The engine can VERIFY against a real status source (needed for `published`/`indexed`). */
  verify: boolean;
  /**
   * The confirmation states this destination can honestly reach AT ALL.
   * A submission API with no status endpoint can never list `indexed` here,
   * which is what keeps the engine from ever claiming one.
   */
  confirmable: readonly ConfirmationState[];
}

/** Safe rate limits the engine respects per destination (bounded defaults). */
export interface DestinationQuotas {
  /** Jobs this destination may process in ONE engine run. */
  perRun: number;
  /** Jobs this destination may process per UTC day. */
  perDay: number;
}

/**
 * Environment variable NAMES the engine expects for a real integration.
 * Presence checks only — values are never read into responses or logs.
 * The commerce feeds list the credentials their official APIs require;
 * until an admin sets them the destination reports `not_configured`.
 */
export const CHANNEL_ENV_REQUIREMENTS: Record<ChannelId, readonly string[]> = {
  google: [
    // Merchant API (the Content API sunset in Aug 2026): service account
    // added as a Merchant Center user, an API data source for product
    // inputs, and the feed label the offer is written under.
    'GOOGLE_MERCHANT_CENTER_ID',
    'GOOGLE_MERCHANT_SERVICE_ACCOUNT_JSON',
    'GOOGLE_MERCHANT_DATA_SOURCE_ID',
    'GOOGLE_MERCHANT_FEED_LABEL',
  ],
  meta: ['META_COMMERCE_ACCESS_TOKEN', 'META_CATALOG_ID'],
  tiktok: [
    'TIKTOK_SHOP_CLIENT_KEY',
    'TIKTOK_SHOP_CLIENT_SECRET',
    'TIKTOK_SHOP_ACCESS_TOKEN',
    'TIKTOK_SHOP_SHOP_CIPHER',
    // Create Product needs a leaf category and a warehouse for SKU inventory.
    'TIKTOK_SHOP_CATEGORY_ID',
    'TIKTOK_SHOP_WAREHOUSE_ID',
  ],
  // Local surface: the sitemap route already serves every public listing, so
  // this destination is configured out of the box — no secret involved.
  sitemap: [],
  indexnow: ['INDEXNOW_KEY'],
  bing: ['BING_WEBMASTER_API_KEY', 'BING_WEBMASTER_SITE_URL'],
  search_console: [
    'GOOGLE_SEARCH_CONSOLE_CLIENT_ID',
    'GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET',
    'GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN',
    'GOOGLE_SEARCH_CONSOLE_SITE_URL',
  ],
  ga: ['GA4_PROPERTY_ID', 'GA4_SERVICE_ACCOUNT_JSON'],
};

/** OPTIONAL env vars — surfaced to admins as hints, never required. */
export const CHANNEL_OPTIONAL_ENV: Record<ChannelId, readonly string[]> = {
  // Non-secret feed configuration — optional, with safe defaults.
  google: ['GOOGLE_MERCHANT_CONTENT_LANGUAGE'],
  meta: [],
  tiktok: ['TIKTOK_SHOP_PACKAGE_WEIGHT_KG'],
  sitemap: [],
  // IndexNow key file URL when it is NOT hosted at host root (protocol
  // default: https://vidnov.com/<key>.txt — the admin hosts the file).
  indexnow: ['INDEXNOW_KEY_LOCATION'],
  bing: [],
  search_console: [],
  ga: [],
};

export interface PreparedChannelPayload {
  channel: ChannelId;
  payloadVersion: string;
  /**
   * Normalised listing fields ready for the official API — plain data only:
   * no seller credentials, no tokens, no server-internal URLs.
   */
  product: {
    id: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    availability: 'in_stock' | 'out_of_stock' | 'on_request';
    condition?: 'new' | 'used';
    brand?: string;
    category?: string;
    location?: string;
    imageUrls: string[];
    /** Real stock count when the source document carries one (inventory mirrors). */
    stock?: number;
  };
  /** Tracked destination link using the existing `ref=` attribution format. */
  destinationUrl: string;
}

/** Minimal product shape the adapters prepare from (a real Firestore doc). */
export interface ChannelSourceProduct extends ProductRef, SellerRef {
  name: string;
  description?: string;
  price: number;
  localCurrency?: string;
  stock?: number;
  availabilityState?: string;
  condition?: 'new' | 'used';
  brand?: string;
  category?: string;
  location?: string;
  imageUrl?: string;
  imageUrls?: string[];
}

export interface ChannelDefinition {
  id: ChannelId;
  label: string;
  kind: DestinationKind;
  /** Per-listing jobs only — analytics connections take none. */
  jobEligible: boolean;
  /** What the engine may honestly do with this destination. */
  capabilities: DestinationCapabilities;
  /** Safe, bounded rate limits for this destination. */
  quotas: DestinationQuotas;
  /** `configured` only when every required env var is present. */
  integrationStatus(): IntegrationStatus;
  /** Which lifecycle states this channel can actually reach today. */
  reachableStates: readonly JobStatus[];
  /** True only when credentials exist — the service refuses to queue otherwise. */
  canSubmit(): boolean;
  /** Builds the prepared payload. Throws only on data that failed validation. */
  prepare(product: ChannelSourceProduct, destinationUrl: string): PreparedChannelPayload;
}

/** Boolean presence check — the VALUE is never read, logged or returned. */
function allEnvPresent(names: readonly string[]): boolean {
  return names.every((n) => (process.env[n] ?? '').trim().length > 0);
}

function availabilityOf(p: ChannelSourceProduct): PreparedChannelPayload['product']['availability'] {
  if (p.availabilityState === 'out_of_stock') return 'out_of_stock';
  if (p.availabilityState === 'on_request' || p.availabilityState === 'accepting_requests') return 'on_request';
  if (typeof p.stock === 'number' && p.stock <= 0) return 'out_of_stock';
  return 'in_stock';
}

function buildPayload(channel: ChannelId, p: ChannelSourceProduct, destinationUrl: string): PreparedChannelPayload {
  const images = (p.imageUrls ?? []).filter((u) => typeof u === 'string' && u.length > 0);
  if (p.imageUrl && !images.includes(p.imageUrl)) images.unshift(p.imageUrl);
  return {
    channel,
    payloadVersion: PAYLOAD_VERSION,
    product: {
      id: p.productId,
      title: String(p.name).slice(0, 150),
      description: (p.description ?? '').slice(0, 5000),
      price: p.price,
      currency: (p.localCurrency ?? 'NGN').toUpperCase().slice(0, 3),
      availability: availabilityOf(p),
      ...(p.condition ? { condition: p.condition } : {}),
      ...(p.brand ? { brand: p.brand.slice(0, 120) } : {}),
      ...(p.category ? { category: p.category.slice(0, 80) } : {}),
      ...(p.location ? { location: p.location.slice(0, 120) } : {}),
      imageUrls: images.slice(0, 10),
      ...(typeof p.stock === 'number' && Number.isFinite(p.stock) && p.stock >= 0
        ? { stock: Math.floor(p.stock) }
        : {}),
    },
    destinationUrl,
  };
}

/**
 * Without credentials a channel's jobs may never leave `ready`/`not_configured`.
 * With credentials, `submitted`/`live` become reachable — still only ever set
 * by a real submit/verify path reporting success. `stopped` is in BOTH lists:
 * halting distribution for an ineligible product must always be possible.
 */
function reachable(configured: boolean): readonly JobStatus[] {
  return configured
    ? ['not_configured', 'ready', 'queued', 'processing', 'submitted', 'live', 'failed', 'needs_attention', 'stopped']
    : ['not_configured', 'ready', 'failed', 'needs_attention', 'stopped'];
}

/** Static, safe capabilities for a destination that prepares only (default). */
const PREPARE_ONLY: DestinationCapabilities = {
  submit: false,
  verify: false,
  confirmable: [],
};

function definition(
  id: ChannelId,
  label: string,
  meta: {
    kind: DestinationKind;
    jobEligible?: boolean;
    capabilities?: DestinationCapabilities;
    quotas?: DestinationQuotas;
  },
): ChannelDefinition {
  return {
    id,
    label,
    kind: meta.kind,
    jobEligible: meta.jobEligible ?? true,
    capabilities: meta.capabilities ?? PREPARE_ONLY,
    // Bounded defaults; destinations with a real submit path declare their
    // own quotas (see CHANNELS below and the engine's reservation clamp).
    quotas: meta.quotas ?? { perRun: 10, perDay: 100 },
    integrationStatus: () => (allEnvPresent(CHANNEL_ENV_REQUIREMENTS[id]) ? 'configured' : 'not_configured'),
    // Getter, not a captured value: evaluated per call so tests and runtime
    // always see the CURRENT environment, never a snapshot from import time.
    get reachableStates(): readonly JobStatus[] {
      return reachable(allEnvPresent(CHANNEL_ENV_REQUIREMENTS[id]));
    },
    canSubmit: () => allEnvPresent(CHANNEL_ENV_REQUIREMENTS[id]),
    prepare: (p, destinationUrl) => buildPayload(id, p, destinationUrl),
  };
}

/**
 * Capabilities of the three commerce feeds: they submit offers through the
 * platform's official API and verify against a real status source
 * (`published` only ever comes from that read — see `adapters.ts`).
 */
const FEED_CAPABILITIES: DestinationCapabilities = {
  submit: true,
  verify: true,
  confirmable: ['accepted', 'published', 'failed', 'unknown'],
};

export const CHANNELS: Record<ChannelId, ChannelDefinition> = {
  google: definition('google', 'Google Merchant Center', {
    kind: 'feed',
    capabilities: FEED_CAPABILITIES,
    // Content API quota guidance: a few updates per product per day, max.
    quotas: { perRun: 5, perDay: 100 },
  }),
  meta: definition('meta', 'Meta Commerce', {
    kind: 'feed',
    capabilities: FEED_CAPABILITIES,
    quotas: { perRun: 10, perDay: 200 },
  }),
  tiktok: definition('tiktok', 'TikTok Shop', {
    kind: 'feed',
    capabilities: FEED_CAPABILITIES,
    quotas: { perRun: 5, perDay: 100 },
  }),
  // Free-first destinations — local sitemap publication first, then the
  // official indexing/webmaster APIs (each with its own credentials).
  sitemap: definition('sitemap', 'Public sitemap', {
    kind: 'local',
    capabilities: {
      submit: true,
      verify: true,
      // `published` = our own sitemap genuinely serves the URL (verified
      // against our source of truth). It never means "indexed by Google".
      confirmable: ['accepted', 'published', 'failed'],
    },
    quotas: { perRun: 50, perDay: 500 },
  }),
  indexnow: definition('indexnow', 'IndexNow', {
    kind: 'indexing',
    capabilities: {
      submit: true,
      // The IndexNow protocol has NO status endpoint: a 200 means
      // "received", never "indexed" — so verify is false and `indexed`
      // is not even an available claim for this destination.
      verify: false,
      confirmable: ['accepted', 'unknown', 'failed'],
    },
    quotas: { perRun: 10, perDay: 100 },
  }),
  bing: definition('bing', 'Bing Webmaster Tools', {
    kind: 'webmaster',
    capabilities: {
      submit: true,
      // No official API reports an indexed/not-indexed verdict for a URL,
      // so this destination can only ever reach `accepted`.
      verify: false,
      confirmable: ['accepted', 'unknown', 'failed'],
    },
    quotas: { perRun: 10, perDay: 100 },
  }),
  search_console: definition('search_console', 'Google Search Console', {
    kind: 'webmaster',
    capabilities: {
      // Google's Indexing API is restricted to job/livestream pages, so we
      // never submit arbitrary product URLs to it. What Search Console DOES
      // offer is URL Inspection — a real indexed/not-indexed verdict — which
      // is the engine's `inspect` action for this destination.
      submit: false,
      verify: true,
      confirmable: ['indexed', 'unknown', 'failed'],
    },
    quotas: { perRun: 10, perDay: 50 },
  }),
  ga: definition('ga', 'Google Analytics 4', {
    kind: 'analytics',
    // Platform-level measurement connection: it reports traffic, it does not
    // publish listings, so it never takes per-listing jobs.
    jobEligible: false,
    capabilities: { submit: false, verify: false, confirmable: [] },
  }),
};

export function getChannel(id: ChannelId): ChannelDefinition {
  const ch = CHANNELS[id];
  if (!ch) throw new Error('Unknown channel.');
  return ch;
}

/** Destinations that participate in per-listing jobs, in registry order. */
export function getJobDestinations(): ChannelDefinition[] {
  return Object.values(CHANNELS).filter((ch) => ch.jobEligible);
}
