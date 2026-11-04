/**
 * SOCIAL ENGINE — URL and referral tracking.
 *
 * One canonical origin for every link the engine builds, reusing the existing
 * `publicOrigin()` / `publicUrl()` (`src/lib/site-url.ts`), the existing share
 * attribution helper `withShareRef()` (`src/lib/growth/events.ts`) and the
 * existing tracked-parameter names (`ref`, `ch`, `camp`) that
 * `vidnov-core/attribution` already reads on arrival.
 *
 * ## Safety rules
 *   • Every builder returns an ABSOLUTE URL on the canonical origin. A path
 *     segment can never introduce a scheme or an authority, so a stored path
 *     cannot turn a Vidnov link into an open redirect.
 *   • Path segments are decoded once and re-encoded, `.`/`..` segments are
 *     dropped, and query parameters are rebuilt rather than concatenated.
 *   • Credential-shaped parameters (`token`, `access_token`, `secret`, `code`,
 *     `password`, …) are never copied into a generated link: tracking links
 *     carry attribution only, never a secret or private customer data.
 *   • Existing links keep working: `ref`, `ch` and `camp` are the parameters
 *     the Growth Engine already normalises on arrival, and a second `ref` is
 *     never appended.
 *
 * Pure module: no I/O, no Firestore, safe to import from a client component.
 */
import { publicOrigin, publicUrl as basePublicUrl } from '@/lib/site-url';
import { withShareRef } from '@/lib/growth/events';
import { CHANNEL_IDS } from '@/lib/vidnov-core/types';
import { ATTRIBUTION_EVENTS, isModuleId, type AttributionEvent } from './types';

/** The public origin (https://vidnov.com unless overridden). */
export function canonicalOrigin(): string {
  return publicOrigin();
}

/** Absolute URL for a path on the canonical origin. */
export function publicUrl(path = ''): string {
  return basePublicUrl(path);
}

export type ShareKind = 'home' | 'campaign' | 'seller' | 'product' | 'service' | 'live';

export interface ShareUrlOptions {
  /** Human/source label for the caller (never emitted as a parameter). */
  source: string;
  /** Distribution channel id — emitted as `ch` only when it is a known id. */
  channel?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  ref?: string;
}

export interface UtmParts {
  source: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
}

/**
 * Parameters that must never be reproduced in a generated link. Matched
 * case-insensitively; anything credential-shaped is dropped from a URL that is
 * being rebuilt or forwarded.
 */
const SENSITIVE_PARAMS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'auth',
  'authorization',
  'secret',
  'client_secret',
  'consumer_secret',
  'api_key',
  'apikey',
  'key',
  'password',
  'passwd',
  'code',
  'state',
  'signature',
  'sig',
  'session',
  'sessionid',
  'email',
  'phone',
]);

export function isSensitiveParam(name: string): boolean {
  return SENSITIVE_PARAMS.has(name.trim().toLowerCase());
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Normalizes a path/segment so it can only ever point INSIDE the canonical
 * origin: no scheme, no protocol-relative authority, no traversal.
 */
export function sanitizePath(raw: string): string {
  // A scheme prefix (`https://`, `javascript:`, …) is removed entirely, and
  // `//host` cannot survive because empty segments are dropped.
  const withoutScheme = raw.trim().replace(/^[a-z][a-z0-9+.-]*:(\/\/)?/i, '');
  const segments = withoutScheme
    .split('?')[0]
    .split('/')
    .map((segment) => safeDecode(segment).trim())
    .filter((segment) => segment && segment !== '.' && segment !== '..');
  return segments.map((segment) => encodeURIComponent(segment)).join('/');
}

/** Existing query of a caller-supplied path, minus anything sensitive. */
function carryQuery(raw: string): Array<[string, string]> {
  const queryStart = raw.indexOf('?');
  if (queryStart < 0) return [];
  const params = new URLSearchParams(raw.slice(queryStart + 1));
  const kept: Array<[string, string]> = [];
  for (const [key, value] of params) {
    if (isSensitiveParam(key)) continue;
    kept.push([key, value.slice(0, 200)]);
  }
  return kept;
}

/** A campaign/source token: bounded, lower-case, no separators that break a URL. */
function cleanToken(value: string | undefined, max = 64): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  return /^[A-Za-z0-9._-]{1,64}$/.test(trimmed) ? trimmed.slice(0, max) : null;
}

/**
 * Builds an absolute, same-site tracked URL.
 *
 * `path` is a path inside the site (`p1`, `sellers/dave`, `p1?ref=old`), never
 * an external URL and never a full origin — the origin always comes from
 * `publicOrigin()`.
 */
export function buildShareUrl(kind: ShareKind, path: string, opts: ShareUrlOptions): string {
  const prefix =
    kind === 'seller' ? 'sellers' : kind === 'product' ? 'products' : kind === 'service' ? 'services' : kind === 'live' ? 'live' : '';

  let cleanPath = sanitizePath(path);
  if (prefix) {
    // Never double-prefix a path that already names its section.
    const first = cleanPath.split('/')[0];
    if (first !== prefix) cleanPath = cleanPath ? `${prefix}/${cleanPath}` : prefix;
  }

  const params: Array<[string, string]> = [];
  const carried = carryQuery(path);
  for (const [key, value] of carried) {
    // `camp`/`content`/`term` are rebuilt from the options; an existing
    // `ref`/`ch` is preserved so a link is never re-attributed.
    if (['camp', 'content', 'term'].includes(key)) continue;
    params.push([key, value]);
  }
  const hasRef = carried.some(([key]) => key === 'ref');
  const hasChannel = carried.some(([key]) => key === 'ch');
  const campaign = cleanToken(opts.campaign);
  const content = cleanToken(opts.content);
  const term = cleanToken(opts.term);
  const channel =
    !hasChannel && opts.channel && (CHANNEL_IDS as readonly string[]).includes(opts.channel) ? opts.channel : null;

  if (channel) params.push(['ch', channel]);
  if (campaign) params.push(['camp', campaign]);
  if (content) params.push(['content', content]);
  if (term) params.push(['term', term]);

  const query = params.length > 0 ? `?${new URLSearchParams(params).toString()}` : '';
  const relative = `/${cleanPath}${query}`;
  // withShareRef owns the `ref` format + validation (one implementation) and
  // refuses to stack a second ref on a link that already carries one.
  const tracked = withShareRef(relative, hasRef ? null : (opts.ref ?? null));
  const origin = canonicalOrigin();
  return tracked === '/' ? origin + query : origin + tracked;
}

/** UTM query string (`?utm_source=…`), or '' when nothing was requested. */
export function buildUtmQuery(opts: UtmParts): string {
  const params: Array<[string, string]> = [];
  const source = cleanToken(opts.source);
  if (source) params.push(['utm_source', source]);
  const medium = cleanToken(opts.medium);
  if (medium) params.push(['utm_medium', medium]);
  const campaign = cleanToken(opts.campaign);
  if (campaign) params.push(['utm_campaign', campaign]);
  const content = cleanToken(opts.content);
  if (content) params.push(['utm_content', content]);
  const term = cleanToken(opts.term);
  if (term) params.push(['utm_term', term]);
  return params.length > 0 ? `?${new URLSearchParams(params).toString()}` : '';
}

interface ReferralOptions {
  medium?: string;
  campaign?: string;
  content?: string;
}

function buildReferralUrl(section: 'sellers' | 'products', path: string, refCode: string, opts: ReferralOptions): string {
  const cleanPath = sanitizePath(path);
  const first = cleanPath.split('/')[0];
  const relativePath = first === section ? cleanPath : cleanPath ? `${section}/${cleanPath}` : section;

  const utm = buildUtmQuery({ source: 'growth', medium: opts.medium, campaign: opts.campaign, content: opts.content });
  const relative = utm ? `/${relativePath}${utm}` : `/${relativePath}`;
  return canonicalOrigin() + withShareRef(relative, refCode);
}

/** Seller page + `ref` (+ optional UTM), reusing the existing referral format. */
export function buildSellerReferralUrl(sellerPath: string, refCode: string, opts: ReferralOptions = {}): string {
  return buildReferralUrl('sellers', sellerPath, refCode, opts);
}

/** Product page + `ref` (+ optional UTM), reusing the existing referral format. */
export function buildProductReferralUrl(productPath: string, refCode: string, opts: ReferralOptions = {}): string {
  return buildReferralUrl('products', productPath, refCode, opts);
}

/**
 * The fixed OAuth callback for a module. The module is validated against the
 * registry, so this can never be pointed at another path.
 */
export function callbackUrl(module: string): string {
  if (!isModuleId(module)) throw new Error(`Unknown Social Engine module "${module}".`);
  return `${canonicalOrigin()}/api/social-engine/callback/${module}`;
}

/** Backward-compatible alias used by older call sites. */
export const oauthCallbackUrl = callbackUrl;

/**
 * True only for an absolute URL on the canonical origin. Used before any
 * redirect or before handing a URL to a provider.
 */
export function isSafeVidnovUrl(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    const origin = new URL(canonicalOrigin());
    return url.origin === origin.origin;
  } catch {
    return false;
  }
}

/** Percent-encodes a value, or returns the fallback when it is empty. */
export function encodeQuery(value: string, fallback = ''): string {
  const clean = (value ?? '').trim();
  return clean ? encodeURIComponent(clean) : fallback;
}

/** The six attribution events the engine records — never mixed together. */
export const TRACKED_EVENTS = ATTRIBUTION_EVENTS;
export type { AttributionEvent };
