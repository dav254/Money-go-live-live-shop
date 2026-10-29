/**
 * DISTRIBUTION HUB — destination adapters (the runtime layer).
 *
 * `channels.ts` declares WHAT each destination is; this module is the only
 * place that ever TALKS to one. Every adapter:
 *   • uses the official endpoint and auth scheme for its platform
 *     (documented — never a scrape, never an unofficial publishing path);
 *   • reads its own credentials from its own env vars — presence checked in
 *     the registry, values used ONLY inside a request and never returned,
 *     logged or stored;
 *   • returns a small, sanitized `RemoteResult`: HTTP status + a bounded,
 *     scrubbed message — response bodies are read at most for a short safe
 *     excerpt and raw upstream text never leaves this module;
 *   • maps failures onto the shared error taxonomy (`auth | validation |
 *     rate_limited | transient | unknown`), so retries stay bounded and
 *     credential-shaped failures need a human.
 *
 * ## The honesty rule, in code
 * A 2xx from a submission API yields `outcome: 'accepted'` — never
 * `confirmed: 'published'/'indexed'`. Only the `verify`/`inspect` actions,
 * which READ a real status source, may return a `confirmed` state. This is
 * the single choke point that makes "HTTP success ≠ published" enforceable.
 *
 * Network only behind an injected `fetchImpl` (tests pass a fake; production
 * routes pass globalThis.fetch). No Firestore, no logging.
 */

import { createHmac, createPrivateKey, sign } from 'crypto';
import type { ChannelId, ConfirmationState, ErrorClass } from '../types';
import {
  CHANNELS,
  CHANNEL_ENV_REQUIREMENTS,
  CHANNEL_OPTIONAL_ENV,
  getChannel,
  type PreparedChannelPayload,
} from './channels';
import { sanitizeErrorMessage } from './job-utils';
import { SITEMAP_ORIGIN, buildSitemapEntries, isPrivatePath } from '@/lib/sitemap-entries';

/** Minimal fetch surface (injectable for tests). */
export type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    /** FormData feeds TikTok's multipart image upload; tests pass strings. */
    body?: string | FormData;
    signal?: unknown;
  },
) => Promise<{
  status: number;
  ok: boolean;
  text(): Promise<string>;
  /** Binary body (image bytes) — optional so simple fakes stay valid. */
  arrayBuffer?(): Promise<ArrayBuffer>;
}>;

const TIMEOUT_MS = 10_000;

/** Strip any credential-ish query parameter from a URL before it can travel. */
function safeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    for (const key of [...u.searchParams.keys()]) {
      if (/key|token|secret|auth|sig/i.test(key)) u.searchParams.set(key, '[redacted]');
    }
    return u.toString();
  } catch {
    return '[invalid-url]';
  }
}

/**
 * Reads at most 300 chars of a response body and scrubs them. Used only to
 * give admins a safe hint ("invalid key", "site not verified") — the raw
 * upstream body is never stored or echoed.
 */
async function safeBodyHint(res: { text(): Promise<string> }): Promise<string | undefined> {
  try {
    const raw = (await res.text()).slice(0, 300);
    if (!raw.trim()) return undefined;
    return sanitizeErrorMessage(raw.replace(/\s+/g, ' '));
  } catch {
    return undefined;
  }
}

/** Success response codes that only ever mean "accepted for processing". */
const ACCEPTED = (status: number): RemoteResult => ({
  outcome: 'accepted',
  responseStatus: status,
});

const FAIL = (
  outcome: 'rejected' | 'error' | 'unknown',
  errorClass: ErrorClass,
  responseStatus?: number,
  message?: string,
): RemoteResult => ({
  outcome,
  errorClass,
  ...(responseStatus !== undefined ? { responseStatus } : {}),
  ...(message ? { message } : {}),
});

export interface RemoteResult {
  /**
   * `accepted` — remote accepted our request (HTTP success ONLY);
   * `rejected` — remote explicitly refused (validation/auth);
   * `error`    — transport/infra failure (transient / rate limited);
   * `unknown`  — ambiguous: we know nothing and claim nothing.
   */
  outcome: 'accepted' | 'rejected' | 'error' | 'unknown';
  errorClass?: ErrorClass;
  responseStatus?: number;
  /** Sanitized identifier returned by the remote (request id / confirmed URL). */
  remoteId?: string;
  /** Sanitized, bounded note. */
  message?: string;
  /**
   * VERIFIED confirmation — ONLY verify/inspect actions may set this, and
   * only from a real status source. Submissions never do.
   */
  confirmed?: ConfirmationState;
}

export interface ActionParams {
  /** Absolute public URL of the listing (built from the canonical origin). */
  absoluteUrl: string;
  /** Same-site path (e.g. `/products/x`) — local destinations use it. */
  publicPath: string;
  fetchImpl: FetchLike;
  /**
   * The prepared listing payload stored on the job — commerce feeds submit
   * these fields to their platform APIs. Absent for URL-only destinations.
   */
  payload?: PreparedChannelPayload;
  /**
   * Remote identifier recorded by an earlier attempt (Meta batch handle,
   * TikTok product id) — lets verify read the exact thing we submitted.
   */
  remoteId?: string;
}

/* ── Local destination: the public sitemap ──────────────────────────────── */

function absoluteFromPath(path: string): string {
  return `${SITEMAP_ORIGIN}${path}`;
}

/**
 * Real check against the SAME builder that generates `/sitemap.xml`:
 * if `buildSitemapEntries` would emit this URL, the live force-dynamic route
 * serves it. No network, no credentials — and no claim about Google.
 */
function sitemapPresence(publicPath: string): boolean {
  if (isPrivatePath(publicPath)) return false;
  try {
    const entries = buildSitemapEntries({
      productIds: [publicPath.replace('/products/', '')],
      shopIds: [],
    });
    return entries.some((e) => e.url === absoluteFromPath(publicPath));
  } catch {
    return false;
  }
}

/* ── Google auth: OAuth2 refresh-token exchange (Search Console) ────────── */

async function searchConsoleToken(fetchImpl: FetchLike): Promise<string | null> {
  const clientId = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID ?? '';
  const clientSecret = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET ?? '';
  const refreshToken = process.env.GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN ?? '';
  if (!clientId || !clientSecret || !refreshToken) return null;
  try {
    const res = await fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const parsed = JSON.parse(await res.text()) as { access_token?: unknown };
    return typeof parsed.access_token === 'string' && parsed.access_token.length > 0
      ? parsed.access_token
      : null;
  } catch {
    return null;
  }
}

/* ── Google auth: service-account JWT (GA4 Data API, RS256 via node:crypto) ─ */

function parseServiceAccount(raw: string): { clientEmail: string; privateKey: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { client_email?: unknown; private_key?: unknown };
    if (typeof parsed.client_email !== 'string' || typeof parsed.private_key !== 'string') {
      return null;
    }
    return { clientEmail: parsed.client_email, privateKey: parsed.private_key };
  } catch {
    return null;
  }
}

function ga4ServiceAccount(): { clientEmail: string; privateKey: string } | null {
  return parseServiceAccount(process.env.GA4_SERVICE_ACCOUNT_JSON ?? '');
}

/** Mints a short-lived OAuth2 access token for a Google service account. */
async function serviceAccountToken(
  fetchImpl: FetchLike,
  sa: { clientEmail: string; privateKey: string },
  scope: string,
): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
      iss: sa.clientEmail,
      scope,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })}`;
    const signature = sign('sha256', Buffer.from(unsigned), createPrivateKey(sa.privateKey));
    const jwt = `${unsigned}.${signature.toString('base64url')}`;

    const res = await fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const parsed = JSON.parse(await res.text()) as { access_token?: unknown };
    return typeof parsed.access_token === 'string' ? parsed.access_token : null;
  } catch {
    return null;
  }
}

async function ga4Token(fetchImpl: FetchLike): Promise<string | null> {
  const sa = ga4ServiceAccount();
  if (!sa) return null;
  return serviceAccountToken(fetchImpl, sa, 'https://www.googleapis.com/auth/analytics.readonly');
}

/* ── The one entry point the engine calls ───────────────────────────────── */

export type DestinationAction = 'submit' | 'verify' | 'inspect';

/**
 * Runs one action for one destination. Refuses anything the registry says
 * the destination cannot honestly do (`capabilities`), so a wiring bug can
 * never make a no-status-API platform "confirm" a publication.
 */
export async function runDestinationAction(
  destination: ChannelId,
  action: DestinationAction,
  params: ActionParams,
): Promise<RemoteResult> {
  const dest = getChannel(destination);
  const caps = dest.capabilities;
  if (action === 'submit' && !caps.submit) {
    return FAIL('rejected', 'not_configured', undefined, 'Destination cannot submit.');
  }
  if ((action === 'verify' || action === 'inspect') && !caps.verify) {
    return FAIL('rejected', 'not_configured', undefined, 'Destination cannot verify.');
  }
  if (!dest.canSubmit()) {
    return FAIL('rejected', 'not_configured', undefined, 'This channel is not configured yet.');
  }

  const result = await dispatch(destination, action, params);
  // HARD INVARIANT: a SUBMIT may never carry a verified confirmation —
  // whatever the adapter answered, only verify/inspect actions can claim
  // `published`/`indexed`, and only from a real status source.
  if (action === 'submit' && result.confirmed) {
    const { confirmed: _confirmed, ...rest } = result;
    return rest;
  }
  return result;
}

async function dispatch(
  destination: ChannelId,
  action: DestinationAction,
  params: ActionParams,
): Promise<RemoteResult> {
  switch (destination) {
    case 'sitemap':
      return runSitemap(action, params);
    case 'indexnow':
      return runIndexNow(action, params);
    case 'bing':
      return runBing(action, params);
    case 'search_console':
      return runSearchConsole(action, params);
    case 'google':
      return runGoogleMerchant(action, params);
    case 'meta':
      return runMetaCommerce(action, params);
    case 'tiktok':
      return runTikTokShop(action, params);
    default:
      return FAIL('rejected', 'not_configured', undefined, 'No runtime adapter for this destination.');
  }
}

function runSitemap(action: DestinationAction, params: ActionParams): RemoteResult {
  const present = sitemapPresence(params.publicPath);
  if (action === 'submit') {
    // Submission = confirming the listing is eligible for our own public
    // surface. The VERIFIED `published` claim is made by the verify action
    // below (the dispatch wrapper also strips `confirmed` from submits).
    return present
      ? { ...ACCEPTED(200), remoteId: params.absoluteUrl }
      : FAIL('rejected', 'validation', 404, 'URL is not part of the public sitemap.');
  }
  // Verify: read OUR source of truth — the exact builder behind /sitemap.xml.
  return present
    ? {
        outcome: 'accepted',
        responseStatus: 200,
        confirmed: 'published',
        remoteId: params.absoluteUrl,
      }
    : FAIL('unknown', 'unknown', 404, 'URL no longer present in the public sitemap.');
}

async function runIndexNow(action: DestinationAction, params: ActionParams): Promise<RemoteResult> {
  if (action !== 'submit') return FAIL('rejected', 'not_configured');
  const key = process.env.INDEXNOW_KEY ?? '';
  if (!key) return FAIL('rejected', 'not_configured');

  const body = {
    host: new URL(SITEMAP_ORIGIN).host,
    key,
    ...(process.env.INDEXNOW_KEY_LOCATION
      ? { keyLocation: process.env.INDEXNOW_KEY_LOCATION }
      : {}),
    urlList: [params.absoluteUrl],
  };

  try {
    const res = await params.fetchImpl('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return mapIndexNowStatus(res.status, await safeBodyHint(res));
  } catch (err) {
    return FAIL('error', 'transient', undefined, sanitizeErrorMessage(err));
  }
}

/** IndexNow protocol codes: 200 received, 202 key validation pending. */
function mapIndexNowStatus(status: number, hint?: string): RemoteResult {
  if (status === 200 || status === 202) return { ...ACCEPTED(status), responseStatus: status };
  if (status === 429) return FAIL('error', 'rate_limited', status, hint);
  if (status === 403) return FAIL('rejected', 'auth', status, hint);
  if (status === 400 || status === 422) return FAIL('rejected', 'validation', status, hint);
  if (status >= 500) return FAIL('error', 'transient', status, hint);
  return FAIL('unknown', 'unknown', status, hint);
}

async function runBing(action: DestinationAction, params: ActionParams): Promise<RemoteResult> {
  if (action !== 'submit') return FAIL('rejected', 'not_configured');
  const apiKey = process.env.BING_WEBMASTER_API_KEY ?? '';
  const siteUrl = process.env.BING_WEBMASTER_SITE_URL ?? '';
  if (!apiKey || !siteUrl) return FAIL('rejected', 'not_configured');

  const endpoint = `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrl?apikey=${encodeURIComponent(apiKey)}`;
  try {
    const res = await params.fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteUrl, url: params.absoluteUrl }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const hint = await safeBodyHint(res);
    if (res.ok) return { outcome: 'accepted', responseStatus: res.status };
    if (res.status === 401 || res.status === 403) return FAIL('rejected', 'auth', res.status, hint);
    if (res.status === 429) return FAIL('error', 'rate_limited', res.status, hint);
    if (res.status === 400 || res.status === 422)
      return FAIL('rejected', 'validation', res.status, hint);
    if (res.status >= 500) return FAIL('error', 'transient', res.status, hint);
    return FAIL('unknown', 'unknown', res.status, hint);
  } catch (err) {
    return FAIL('error', 'transient', undefined, sanitizeErrorMessage(err));
  }
}

async function runSearchConsole(
  action: DestinationAction,
  params: ActionParams,
): Promise<RemoteResult> {
  const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL ?? '';
  if (!siteUrl) return FAIL('rejected', 'not_configured');

  const token = await searchConsoleToken(params.fetchImpl);
  if (!token) return FAIL('rejected', 'auth', 401, 'Search Console authorization failed.');

  if (action === 'submit') {
    // Platform-level sitemap submission (PUT, no body) — see
    // submitSitemapToSearchConsole below; per-listing jobs use inspect.
    return FAIL('rejected', 'not_configured', undefined, 'Use the inspect action.');
  }

  try {
    const res = await params.fetchImpl(
      'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inspectionUrl: params.absoluteUrl, siteUrl }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    const hint = await safeBodyHint(res);
    if (res.status === 401 || res.status === 403) return FAIL('rejected', 'auth', res.status, hint);
    if (res.status === 429) return FAIL('error', 'rate_limited', res.status, hint);
    if (res.status >= 500) return FAIL('error', 'transient', res.status, hint);
    if (!res.ok) return FAIL('unknown', 'unknown', res.status, hint);

    // Parse ONLY the verdict field; nothing else from the body survives.
    const parsed = JSON.parse(await res.text()) as {
      inspectionResult?: { indexStatusResult?: { status?: unknown } };
    };
    const status = parsed.inspectionResult?.indexStatusResult?.status;
    if (status === 'INDEXED') {
      return {
        outcome: 'accepted',
        responseStatus: res.status,
        confirmed: 'indexed',
        remoteId: params.absoluteUrl,
      };
    }
    // A definite non-indexed verdict is honest `unknown`, not a failure.
    return {
      outcome: 'accepted',
      responseStatus: res.status,
      confirmed: 'unknown',
      message: `Index status: ${typeof status === 'string' ? status.slice(0, 32) : 'UNKNOWN'}.`,
    };
  } catch (err) {
    return FAIL('error', 'transient', undefined, sanitizeErrorMessage(err));
  }
}

/**
 * Platform-level: submit the PUBLIC sitemap to Search Console
 * (`PUT /v3/sites/{siteUrl}/sitemaps/{feedpath}`, OAuth). Idempotent — the
 * engine calls it at most once per day, guarded by `sitemapSubmittedAt`.
 */
export async function submitSitemapToSearchConsole(
  fetchImpl: FetchLike,
): Promise<RemoteResult> {
  const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL ?? '';
  if (!siteUrl) return FAIL('rejected', 'not_configured');
  const token = await searchConsoleToken(fetchImpl);
  if (!token) return FAIL('rejected', 'auth', 401, 'Search Console authorization failed.');

  const feedpath = `${SITEMAP_ORIGIN}/sitemap.xml`;
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(feedpath)}`;
  try {
    const res = await fetchImpl(endpoint, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok || res.status === 204) return ACCEPTED(res.status);
    const hint = await safeBodyHint(res);
    if (res.status === 401 || res.status === 403) return FAIL('rejected', 'auth', res.status, hint);
    if (res.status === 429) return FAIL('error', 'rate_limited', res.status, hint);
    if (res.status >= 500) return FAIL('error', 'transient', res.status, hint);
    return FAIL('unknown', 'unknown', res.status, hint);
  } catch (err) {
    return FAIL('error', 'transient', undefined, sanitizeErrorMessage(err));
  }
}

/* ── Shared response helpers for JSON APIs ────────────────────────────────── */

/** Reads a response body once: raw text (bounded) + parsed JSON if possible. */
async function readJsonBody(res: { text(): Promise<string> }): Promise<{ raw: string; json: unknown | null }> {
  const raw = (await res.text()).slice(0, 4000);
  try {
    return { raw, json: JSON.parse(raw) as unknown };
  } catch {
    return { raw, json: null };
  }
}

/** Safe, bounded hint from a raw body excerpt — never the full upstream text. */
function bodyHint(raw: string): string | undefined {
  const clean = raw.replace(/\s+/g, ' ').slice(0, 300);
  return clean.trim() ? sanitizeErrorMessage(clean) : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Uniform HTTP → error taxonomy for the JSON APIs below. */
function jsonHttpStatus(status: number, hint?: string): RemoteResult {
  if (status === 401 || status === 403) return FAIL('rejected', 'auth', status, hint);
  if (status === 429) return FAIL('error', 'rate_limited', status, hint);
  if (status === 400 || status === 404 || status === 409 || status === 422)
    return FAIL('rejected', 'validation', status, hint);
  if (status === 410)
    return FAIL('rejected', 'auth', status, hint ?? 'This API is not available to this project.');
  if (status >= 500) return FAIL('error', 'transient', status, hint);
  return FAIL('unknown', 'unknown', status, hint);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function feedProductOf(params: ActionParams): PreparedChannelPayload['product'] | null {
  const p = params.payload?.product;
  if (!p || typeof p.id !== 'string' || typeof p.title !== 'string') return null;
  return p;
}

/* ── Google Merchant Center (Merchant API v1) ──────────────────────────── */

const GOOGLE_CONTENT_SCOPE = 'https://www.googleapis.com/auth/content';

interface GoogleFeedConfig {
  merchantId: string;
  dataSourceId: string;
  feedLabel: string;
  contentLanguage: string;
}

function googleFeedConfig(): GoogleFeedConfig | null {
  const merchantId = (process.env.GOOGLE_MERCHANT_CENTER_ID ?? '').trim();
  const dataSourceId = (process.env.GOOGLE_MERCHANT_DATA_SOURCE_ID ?? '').trim();
  const feedLabel = (process.env.GOOGLE_MERCHANT_FEED_LABEL ?? '').trim();
  if (!merchantId || !dataSourceId || !feedLabel) return null;
  return {
    merchantId,
    dataSourceId,
    feedLabel,
    contentLanguage: (process.env.GOOGLE_MERCHANT_CONTENT_LANGUAGE ?? 'en').trim() || 'en',
  };
}

function googleFeedToken(fetchImpl: FetchLike): Promise<string | null> {
  const sa = parseServiceAccount(process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_JSON ?? '');
  if (!sa) return Promise.resolve(null);
  return serviceAccountToken(fetchImpl, sa, GOOGLE_CONTENT_SCOPE);
}

/** Merchant API availability enum (there is no `on_request` value). */
const GOOGLE_AVAILABILITY = {
  in_stock: 'IN_STOCK',
  out_of_stock: 'OUT_OF_STOCK',
  // "Available on request" ≈ order accepted, ships when fulfilled.
  on_request: 'BACKORDER',
} as const;

function googleOfferId(product: PreparedChannelPayload['product']): string {
  // Offer ids must be plain, URL-safe segments — the document id already is.
  return product.id.slice(0, 120);
}

async function runGoogleMerchant(action: DestinationAction, params: ActionParams): Promise<RemoteResult> {
  const cfg = googleFeedConfig();
  if (!cfg) return FAIL('rejected', 'not_configured');
  const product = feedProductOf(params);
  if (!product) {
    return FAIL('rejected', 'validation', undefined, 'Job is missing its prepared listing payload.');
  }
  const token = await googleFeedToken(params.fetchImpl);
  if (!token) return FAIL('rejected', 'auth', 401, 'Merchant Center authorization failed.');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const offerId = googleOfferId(product);

  if (action === 'submit') {
    const endpoint =
      `https://merchantapi.googleapis.com/products/v1/accounts/${encodeURIComponent(cfg.merchantId)}` +
      `/productInputs:insert?dataSource=${encodeURIComponent(
        `accounts/${cfg.merchantId}/dataSources/${cfg.dataSourceId}`,
      )}`;
    const body = {
      offerId,
      contentLanguage: cfg.contentLanguage,
      feedLabel: cfg.feedLabel,
      productAttributes: {
        title: product.title,
        ...(product.description ? { description: product.description } : {}),
        link: params.absoluteUrl,
        ...(product.imageUrls[0] ? { imageLink: product.imageUrls[0] } : {}),
        ...(product.imageUrls.length > 1
          ? { additionalImageLinks: product.imageUrls.slice(1, 10) }
          : {}),
        availability: GOOGLE_AVAILABILITY[product.availability],
        price: {
          amountMicros: String(Math.round(product.price * 1_000_000)),
          currencyCode: product.currency,
        },
        ...(product.condition ? { condition: product.condition === 'used' ? 'USED' : 'NEW' } : {}),
        ...(product.brand ? { brand: product.brand } : {}),
      },
    };
    try {
      const res = await params.fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) {
        // HTTP success only — the wrapper strips any `confirmed` from submits.
        return {
          ...ACCEPTED(res.status),
          remoteId: `${cfg.contentLanguage}~${cfg.feedLabel}~${offerId}`,
        };
      }
      const { raw } = await readJsonBody(res);
      return jsonHttpStatus(res.status, bodyHint(raw));
    } catch (err) {
      return FAIL('error', 'transient', undefined, sanitizeErrorMessage(err));
    }
  }

  // verify / inspect — read the REAL processed-product status.
  const resource = `${cfg.contentLanguage}~${cfg.feedLabel}~${offerId}`;
  const endpoint =
    `https://merchantapi.googleapis.com/products/v1/accounts/${encodeURIComponent(cfg.merchantId)}` +
    `/products/${encodeURIComponent(resource)}`;
  try {
    const res = await params.fetchImpl(endpoint, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 404) {
      // Not ingested yet (processing lag) — claim nothing either way.
      return {
        outcome: 'unknown',
        errorClass: 'unknown',
        responseStatus: 404,
        message: 'Product not yet present at Google.',
      };
    }
    if (!res.ok) {
      const { raw } = await readJsonBody(res);
      return jsonHttpStatus(res.status, bodyHint(raw));
    }
    const { json } = await readJsonBody(res);
    const status = asRecord(asRecord(json)?.productStatus);
    const dests = Array.isArray(status?.destinationStatuses) ? status.destinationStatuses : [];
    const issues = Array.isArray(status?.itemLevelIssues) ? status.itemLevelIssues : [];
    const approved = dests.some((d) => {
      const approvedCountries = asRecord(d)?.approvedCountries;
      return Array.isArray(approvedCountries) && approvedCountries.length > 0;
    });
    const disapproved = issues.some(
      (i) => asRecord(i)?.severity === 'DISAPPROVED',
    );
    if (approved) {
      return {
        outcome: 'accepted',
        responseStatus: res.status,
        confirmed: 'published',
        remoteId: resource,
        message: 'Approved for shopping destinations.',
      };
    }
    if (disapproved) {
      return FAIL('rejected', 'validation', res.status, 'Google disapproved this product.');
    }
    return {
      outcome: 'accepted',
      responseStatus: res.status,
      confirmed: 'unknown',
      message: 'Google has not finished reviewing this product yet.',
    };
  } catch (err) {
    return FAIL('error', 'transient', undefined, sanitizeErrorMessage(err));
  }
}

/* ── Meta Commerce (Catalog items_batch + batch status) ──────────────────── */

const META_GRAPH = 'https://graph.facebook.com/v26.0';

function metaFeedConfig(): { token: string; catalogId: string } | null {
  const token = (process.env.META_COMMERCE_ACCESS_TOKEN ?? '').trim();
  const catalogId = (process.env.META_CATALOG_ID ?? '').trim();
  return token && catalogId ? { token, catalogId } : null;
}

const META_AVAILABILITY = {
  in_stock: 'in stock',
  out_of_stock: 'out of stock',
  on_request: 'available for order',
} as const;

/** Graph error envelope → the shared error taxonomy (codes are documented). */
function metaGraphFail(status: number, json: unknown, hint?: string): RemoteResult {
  const error = asRecord(asRecord(json)?.error);
  const code = typeof error?.code === 'number' ? error.code : null;
  if (code === 190 || code === 466 || status === 401) return FAIL('rejected', 'auth', status, hint);
  if (code === 200 || code === 201) return FAIL('rejected', 'auth', status, hint ?? 'Missing catalog permission.');
  if (code === 80014 || status === 429) return FAIL('error', 'rate_limited', status, hint);
  if (code === 100 || status === 400 || status === 404 || status === 422)
    return FAIL('rejected', 'validation', status, hint);
  return jsonHttpStatus(status, hint);
}

async function runMetaCommerce(action: DestinationAction, params: ActionParams): Promise<RemoteResult> {
  const cfg = metaFeedConfig();
  if (!cfg) return FAIL('rejected', 'not_configured');
  const product = feedProductOf(params);
  if (!product) {
    return FAIL('rejected', 'validation', undefined, 'Job is missing its prepared listing payload.');
  }
  if (action === 'submit') {
    if (!product.imageUrls[0]) {
      return FAIL('rejected', 'validation', undefined, 'Listing has no image.');
    }
    const endpoint = `${META_GRAPH}/${encodeURIComponent(cfg.catalogId)}/items_batch`;
    const body = JSON.stringify({
      allow_upsert: true,
      item_type: 'PRODUCT_ITEM',
      requests: [
        {
          method: 'UPDATE',
          data: {
            id: product.id.slice(0, 120),
            title: product.title,
            ...(product.description ? { description: product.description } : {}),
            link: params.absoluteUrl,
            image_link: product.imageUrls[0],
            ...(product.brand ? { brand: product.brand } : {}),
            price: `${product.price.toFixed(2)} ${product.currency}`,
            availability: META_AVAILABILITY[product.availability],
            ...(product.condition ? { condition: product.condition } : {}),
          },
        },
      ],
    });
    try {
      const res = await params.fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const { raw, json } = await readJsonBody(res);
      if (!res.ok) return metaGraphFail(res.status, json, bodyHint(raw));
      const record = asRecord(json);
      const handles = Array.isArray(record?.handles) ? record.handles : [];
      const rows = Array.isArray(record?.validation_status) ? record.validation_status : [];
      for (const row of rows) {
        const errors = asRecord(row)?.errors;
        if (Array.isArray(errors) && errors.length > 0) {
          const first = asRecord(errors[0])?.message;
          return FAIL(
            'rejected',
            'validation',
            res.status,
            typeof first === 'string' ? first.slice(0, 200) : 'Catalog rejected this item.',
          );
        }
      }
      const handle = typeof handles[0] === 'string' ? handles[0] : null;
      if (handle) return { ...ACCEPTED(res.status), remoteId: handle.slice(0, 200) };
      // HTTP success but nothing ingested — claim nothing.
      return FAIL('unknown', 'unknown', res.status, 'Catalog accepted no items.');
    } catch (err) {
      return FAIL('error', 'transient', undefined, sanitizeErrorMessage(err));
    }
  }

  // verify — poll the REAL batch status recorded from our submit.
  if (!params.remoteId) {
    return FAIL('unknown', 'unknown', undefined, 'No catalog batch handle recorded.');
  }
  const endpoint =
    `${META_GRAPH}/${encodeURIComponent(cfg.catalogId)}/check_batch_request_status` +
    `?handle=${encodeURIComponent(params.remoteId)}` +
    '&load_ids_of_invalid_requests=true' +
    '&fields=handle,status,errors,errors_total_count,ids_of_invalid_requests';
  try {
    const res = await params.fetchImpl(endpoint, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const { raw, json } = await readJsonBody(res);
    if (!res.ok) return metaGraphFail(res.status, json, bodyHint(raw));
    const record = asRecord(json);
    const status = typeof record?.status === 'string' ? record.status : '';
    const invalid = Array.isArray(record?.ids_of_invalid_requests) ? record.ids_of_invalid_requests : [];
    const oursInvalid = invalid.includes(product.id.slice(0, 120));
    const errorsTotal = typeof record?.errors_total_count === 'number' ? record.errors_total_count : 0;
    if (status === 'Finished') {
      if (oursInvalid) {
        return FAIL('rejected', 'validation', res.status, 'Catalog rejected this item.');
      }
      if (errorsTotal > 0) {
        return FAIL('unknown', 'unknown', res.status, 'Batch finished with errors on other items.');
      }
      // Real status source: our row was stored in the catalog.
      return {
        outcome: 'accepted',
        responseStatus: res.status,
        confirmed: 'published',
        remoteId: params.remoteId.slice(0, 200),
        message: 'Item stored in the catalog.',
      };
    }
    if (status === 'Error' || status === 'Canceled') {
      return FAIL('unknown', 'unknown', res.status, 'Catalog batch did not complete.');
    }
    // Scheduled / Dispatched / Started — still processing, claim nothing.
    return {
      outcome: 'accepted',
      responseStatus: res.status,
      confirmed: 'unknown',
      message: 'Catalog batch still processing.',
    };
  } catch (err) {
    return FAIL('error', 'transient', undefined, sanitizeErrorMessage(err));
  }
}

/* ── TikTok Shop (v202309 Product API) ────────────────────────────────────── */

const TIKTOK_API = 'https://open-api.tiktokglobalshop.com';
const TIKTOK_VERSION_PATH = '/product/202309';

interface TikTokFeedConfig {
  appKey: string;
  appSecret: string;
  accessToken: string;
  shopCipher: string;
  categoryId: string;
  warehouseId: string;
  packageWeightKg: string;
}

function tiktokFeedConfig(): TikTokFeedConfig | null {
  const appKey = (process.env.TIKTOK_SHOP_CLIENT_KEY ?? '').trim();
  const appSecret = (process.env.TIKTOK_SHOP_CLIENT_SECRET ?? '').trim();
  const accessToken = (process.env.TIKTOK_SHOP_ACCESS_TOKEN ?? '').trim();
  const shopCipher = (process.env.TIKTOK_SHOP_SHOP_CIPHER ?? '').trim();
  const categoryId = (process.env.TIKTOK_SHOP_CATEGORY_ID ?? '').trim();
  const warehouseId = (process.env.TIKTOK_SHOP_WAREHOUSE_ID ?? '').trim();
  if (!appKey || !appSecret || !accessToken || !shopCipher || !categoryId || !warehouseId) return null;
  return {
    appKey,
    appSecret,
    accessToken,
    shopCipher,
    categoryId,
    warehouseId,
    packageWeightKg: (process.env.TIKTOK_SHOP_PACKAGE_WEIGHT_KG ?? '').trim() || '1',
  };
}

/**
 * v202309 request sign: HMAC-SHA256 over
 * `app_secret + path + sorted(keyvalue params) + body + app_secret`.
 * The access token travels only in the `x-tts-access-token` header, never in
 * the signed string. (TikTok's signing page is client-rendered — if the
 * signature format drifts, TikTok answers `code != 0` and the job fails
 * honestly in the admin queue; it can never fake a publish.)
 */
function tiktokSign(
  appSecret: string,
  path: string,
  query: Record<string, string>,
  body?: string,
): string {
  const base = Object.entries(query)
    .filter(([key]) => key !== 'sign')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}${value}`)
    .join('');
  const message = `${appSecret}${path}${base}${body ?? ''}${appSecret}`;
  return createHmac('sha256', appSecret).update(message).digest('hex');
}

function tiktokUrl(
  cfg: TikTokFeedConfig,
  path: string,
  extra: Record<string, string>,
  body?: string,
): string {
  const query: Record<string, string> = {
    app_key: cfg.appKey,
    timestamp: String(Math.floor(Date.now() / 1000)),
    ...extra,
  };
  query.sign = tiktokSign(cfg.appSecret, path, query, body);
  return `${TIKTOK_API}${path}?${new URLSearchParams(query).toString()}`;
}

function tiktokHeaders(cfg: TikTokFeedConfig, json = false): Record<string, string> {
  return {
    'x-tts-access-token': cfg.accessToken,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

/** Envelope: `code === 0` (or an explicit `data` with no code) means success. */
function tiktokEnvelope(json: unknown): { ok: boolean; message: string } {
  const record = asRecord(json);
  const code = typeof record?.code === 'number' ? record.code : null;
  const message = typeof record?.message === 'string' ? record.message.slice(0, 200) : '';
  const hasData = record?.data !== undefined && record.data !== null;
  return { ok: code === 0 || (code === null && hasData), message };
}

/** Downloads a listing image and uploads it to TikTok Shop → image `uri`. */
async function tiktokUploadImage(
  cfg: TikTokFeedConfig,
  imageUrl: string,
  fetchImpl: FetchLike,
): Promise<{ uri?: string; result?: RemoteResult }> {
  try {
    const download = await fetchImpl(imageUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!download.ok || !download.arrayBuffer) {
      return { result: FAIL('error', 'transient', download.status, 'Could not download listing image.') };
    }
    const bytes = await download.arrayBuffer();
    const form = new FormData();
    form.append('data', new Blob([bytes], { type: 'image/jpeg' }), 'product.jpg');
    form.append('use_case', 'MAIN_IMAGE');
    const path = `${TIKTOK_VERSION_PATH}/images/upload`;
    const res = await fetchImpl(tiktokUrl(cfg, path, {}), {
      method: 'POST',
      headers: tiktokHeaders(cfg),
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const { raw, json } = await readJsonBody(res);
    if (!res.ok) return { result: jsonHttpStatus(res.status, bodyHint(raw)) };
    const env = tiktokEnvelope(json);
    if (!env.ok) {
      return { result: FAIL('rejected', 'validation', res.status, env.message || 'Image upload rejected.') };
    }
    const data = asRecord(asRecord(json)?.data);
    const uri = typeof data?.uri === 'string' ? data.uri : null;
    if (!uri) return { result: FAIL('error', 'unknown', res.status, 'Image upload returned no URI.') };
    return { uri };
  } catch (err) {
    return { result: FAIL('error', 'transient', undefined, sanitizeErrorMessage(err)) };
  }
}

async function runTikTokShop(action: DestinationAction, params: ActionParams): Promise<RemoteResult> {
  const cfg = tiktokFeedConfig();
  if (!cfg) return FAIL('rejected', 'not_configured');
  const product = feedProductOf(params);
  if (!product) {
    return FAIL('rejected', 'validation', undefined, 'Job is missing its prepared listing payload.');
  }

  if (action === 'submit') {
    if (!product.imageUrls[0]) {
      return FAIL('rejected', 'validation', undefined, 'Listing has no image.');
    }
    // 1) Images must live on TikTok before a product can reference them.
    const uris: string[] = [];
    for (const imageUrl of product.imageUrls.slice(0, 3)) {
      const { uri, result } = await tiktokUploadImage(cfg, imageUrl, params.fetchImpl);
      if (result) return result;
      if (uri) uris.push(uri);
    }
    if (uris.length === 0) {
      return FAIL('rejected', 'validation', undefined, 'No listing image could be uploaded.');
    }

    // 2) Create + submit for platform review (`save_mode: LISTING`).
    const quantity =
      product.availability === 'out_of_stock' || product.availability === 'on_request'
        ? 0
        : Math.max(0, Math.floor(product.stock ?? 1));
    const path = `${TIKTOK_VERSION_PATH}/products`;
    const body = JSON.stringify({
      save_mode: 'LISTING',
      title: product.title,
      description: `<p>${escapeHtml(product.description || product.title)}</p>`,
      category_id: cfg.categoryId,
      main_images: uris.map((uri) => ({ uri })),
      skus: [
        {
          seller_sku: product.id.slice(0, 64),
          price: { amount: product.price.toFixed(2), currency: product.currency },
          inventory: [{ warehouse_id: cfg.warehouseId, quantity }],
        },
      ],
      package_weight: { value: cfg.packageWeightKg, unit: 'KILOGRAM' },
    });
    try {
      const res = await params.fetchImpl(tiktokUrl(cfg, path, {}, body), {
        method: 'POST',
        headers: tiktokHeaders(cfg, true),
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const { raw, json } = await readJsonBody(res);
      if (!res.ok) return jsonHttpStatus(res.status, bodyHint(raw));
      const env = tiktokEnvelope(json);
      const data = asRecord(asRecord(json)?.data);
      const productId = typeof data?.product_id === 'string' ? data.product_id : null;
      if (!env.ok || !productId) {
        return FAIL('rejected', 'validation', res.status, env.message || 'TikTok Shop rejected this product.');
      }
      return { ...ACCEPTED(res.status), remoteId: productId.slice(0, 200) };
    } catch (err) {
      return FAIL('error', 'transient', undefined, sanitizeErrorMessage(err));
    }
  }

  // verify — read the REAL audit + lifecycle status of the product we created.
  if (!params.remoteId) {
    return FAIL('unknown', 'unknown', undefined, 'No TikTok Shop product id recorded.');
  }
  const path = `${TIKTOK_VERSION_PATH}/products/${encodeURIComponent(params.remoteId)}`;
  try {
    const res = await params.fetchImpl(tiktokUrl(cfg, path, {}), {
      method: 'GET',
      headers: tiktokHeaders(cfg),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const { raw, json } = await readJsonBody(res);
    if (res.status === 404) {
      return {
        outcome: 'unknown',
        errorClass: 'unknown',
        responseStatus: 404,
        message: 'Product not yet present at TikTok Shop.',
      };
    }
    if (!res.ok) return jsonHttpStatus(res.status, bodyHint(raw));
    const env = tiktokEnvelope(json);
    if (!env.ok) {
      return FAIL('unknown', 'unknown', res.status, env.message || 'Status unavailable.');
    }
    const data = asRecord(asRecord(json)?.data);
    const audit = asRecord(data?.audit);
    const auditStatus = typeof audit?.status === 'string' ? audit.status : 'NONE';
    const lifecycle = typeof data?.product_status === 'string' ? data.product_status : '';
    if (auditStatus === 'APPROVED' && lifecycle === 'ACTIVATE') {
      return {
        outcome: 'accepted',
        responseStatus: res.status,
        confirmed: 'published',
        remoteId: params.remoteId.slice(0, 200),
        message: 'Approved and active on TikTok Shop.',
      };
    }
    if (auditStatus === 'FAILED') {
      return FAIL('rejected', 'validation', res.status, 'TikTok Shop rejected this product.');
    }
    if (lifecycle === 'DELETED') {
      return FAIL('rejected', 'validation', res.status, 'Product no longer exists at TikTok Shop.');
    }
    if (auditStatus === 'APPROVED') {
      return {
        outcome: 'accepted',
        responseStatus: res.status,
        confirmed: 'unknown',
        message: `Approved but not active (status: ${lifecycle || 'unknown'}).`,
      };
    }
    // NONE / AUDITING / PRE_APPROVED — review is still pending.
    return {
      outcome: 'accepted',
      responseStatus: res.status,
      confirmed: 'unknown',
      message: 'TikTok Shop review pending.',
    };
  } catch (err) {
    return FAIL('error', 'transient', undefined, sanitizeErrorMessage(err));
  }
}

/* ── GA4 traffic (connection-only: reports sessions, never invents sales) ── */

export interface Ga4Traffic {
  configured: boolean;
  /** Total sessions in the window, or null when unreadable. */
  totalSessions: number | null;
  /** Real per-day sessions straight from GA. */
  byDate: Array<{ date: string; sessions: number }>;
  /** Safe failure note when configured but unreadable. */
  error?: string;
}

/**
 * Reads the last 7 days of sessions from GA4 (Data API v1beta). Real numbers
 * only: a failure reports `null`, never a fabricated zero series.
 */
export async function readGa4Traffic(fetchImpl: FetchLike): Promise<Ga4Traffic> {
  const propertyId = (process.env.GA4_PROPERTY_ID ?? '').trim();
  const empty: Ga4Traffic = { configured: false, totalSessions: null, byDate: [] };
  if (!propertyId || !ga4ServiceAccount()) return empty;

  const token = await ga4Token(fetchImpl);
  if (!token) {
    return { ...empty, configured: true, error: 'Google Analytics authorization failed.' };
  }
  try {
    const res = await fetchImpl(
      `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'sessions' }],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      return {
        ...empty,
        configured: true,
        error: `Google Analytics returned ${res.status}.`,
      };
    }
    const parsed = JSON.parse(await res.text()) as {
      rows?: Array<{
        dimensionValues?: Array<{ value?: unknown }>;
        metricValues?: Array<{ value?: unknown }>;
      }>;
      rowCount?: unknown;
    };
    const byDate: Ga4Traffic['byDate'] = [];
    for (const row of parsed.rows ?? []) {
      const date = row.dimensionValues?.[0]?.value;
      const sessions = Number(row.metricValues?.[0]?.value ?? 0);
      if (typeof date === 'string' && Number.isFinite(sessions)) {
        byDate.push({ date, sessions: Math.max(0, Math.floor(sessions)) });
      }
    }
    const totalSessions = byDate.reduce((sum, r) => sum + r.sessions, 0);
    return { configured: true, totalSessions, byDate };
  } catch {
    return { ...empty, configured: true, error: 'Google Analytics request failed.' };
  }
}

/* ── Connection status for the Control Center ───────────────────────────── */

export interface ConnectionStatus {
  id: ChannelId;
  label: string;
  kind: string;
  jobEligible: boolean;
  status: 'configured' | 'not_configured';
  /** Env var NAMES only — presence, never values. */
  requiredEnvVars: readonly string[];
  optionalEnvVars: readonly string[];
  capabilities: { submit: boolean; verify: boolean; confirmable: readonly ConfirmationState[] };
}

/** Env presence per destination — the ONLY thing the admin view reveals. */
export function connectionStatuses(): ConnectionStatus[] {
  return Object.values(CHANNELS).map((dest) => ({
    id: dest.id,
    label: dest.label,
    kind: dest.kind,
    jobEligible: dest.jobEligible,
    status: dest.integrationStatus(),
    requiredEnvVars: CHANNEL_ENV_REQUIREMENTS[dest.id],
    optionalEnvVars: optionalEnvOf(dest.id),
    capabilities: {
      submit: dest.capabilities.submit,
      verify: dest.capabilities.verify,
      confirmable: dest.capabilities.confirmable,
    },
  }));
}

function optionalEnvOf(id: ChannelId): readonly string[] {
  return CHANNEL_OPTIONAL_ENV[id] ?? [];
}
