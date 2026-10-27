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

import { createPrivateKey, sign } from 'crypto';
import type { ChannelId, ConfirmationState, ErrorClass } from '../types';
import {
  CHANNELS,
  CHANNEL_ENV_REQUIREMENTS,
  CHANNEL_OPTIONAL_ENV,
  getChannel,
} from './channels';
import { sanitizeErrorMessage } from './job-utils';
import { SITEMAP_ORIGIN, buildSitemapEntries, isPrivatePath } from '@/lib/sitemap-entries';

/** Minimal fetch surface (injectable for tests). */
export type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: unknown;
  },
) => Promise<{ status: number; ok: boolean; text(): Promise<string> }>;

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

function ga4ServiceAccount(): { clientEmail: string; privateKey: string } | null {
  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON ?? '';
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

async function ga4Token(fetchImpl: FetchLike): Promise<string | null> {
  const sa = ga4ServiceAccount();
  if (!sa) return null;
  try {
    const now = Math.floor(Date.now() / 1000);
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
      iss: sa.clientEmail,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
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
