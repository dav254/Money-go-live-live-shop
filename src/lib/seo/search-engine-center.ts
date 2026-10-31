/**
 * SEARCH ENGINE CENTER — the admin console's server-side truth layer.
 *
 * ## Honesty contract (the same spirit as the distribution engine)
 * Everything this module reports comes from a check it actually ran:
 *
 *   • probing THIS deployment's public origin for the artifacts search
 *     engines look for — the Bing `msvalidate.01` meta tag, the Yandex
 *     `yandex_*.html` file, the IndexNow key file, `robots.txt`,
 *     `/sitemap.xml` and the canonical link on the home page;
 *   • reading environment-variable PRESENCE (names only, never values).
 *
 * It never infers success from configuration alone. An engine whose
 * acceptance we cannot read from an official API stays `pending`, with a
 * detail line saying exactly what was and was not checked. The `verified`
 * state is reserved for engine-side confirmation; today no integration can
 * supply it, so this module never emits it (asserted by the test suite).
 *
 * ## What we deliberately do NOT do
 * No invented endpoints, no scraping of engine portals, no "assume it
 * worked". Every network call is either to our own origin (read-only GETs)
 * or through the EXISTING official adapters in
 * `src/lib/vidnov-core/distribution/adapters.ts`.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { INDEXNOW_KEY, INDEXNOW_KEY_PATH } from '@/lib/seo/indexnow';
import { publicOrigin } from '@/lib/site-url';
import type { FetchLike } from '@/lib/vidnov-core/distribution/adapters';

/**
 * The real `fetch`, typed the way the distribution adapters expect — so
 * every call this console makes goes through the SAME official adapters the
 * engine uses, with the same timeout semantics.
 */
export const systemFetch: FetchLike = (url, init) =>
  fetch(url, { ...init, signal: init?.signal as AbortSignal | undefined });

export type EngineId = 'google' | 'bing' | 'yandex' | 'indexnow';

/**
 * `verified` is engine-side confirmation and is NEVER produced by derivation
 * alone — see the honesty contract above. It exists in the union so a future
 * adapter that can read an ownership verdict has somewhere honest to land.
 */
export type EngineStatus = 'verified' | 'connected' | 'pending' | 'not_configured' | 'error';

export type CheckState = 'pass' | 'fail' | 'skip';

export interface EngineCheck {
  label: string;
  state: CheckState;
  /** Credential-free, bounded explanation of what this check saw. */
  detail: string;
}

export interface EngineStatusRow {
  id: EngineId;
  label: string;
  status: EngineStatus;
  /** One sentence: what was checked, and what is still outstanding. */
  detail: string;
  /** Environment variable NAMES only — presence, never values. */
  requiredEnvVars: readonly string[];
  configured: boolean;
  checks: EngineCheck[];
  /** Public URL of the artifact this engine's verification looks for. */
  artifactUrl: string | null;
}

/* ── Environment requirements (NAMES only — values never leave this file) ── */

export const ENGINE_ENV_REQUIREMENTS: Record<EngineId, readonly string[]> = {
  google: [
    'GOOGLE_SEARCH_CONSOLE_CLIENT_ID',
    'GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET',
    'GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN',
    'GOOGLE_SEARCH_CONSOLE_SITE_URL',
  ],
  bing: ['BING_WEBMASTER_API_KEY', 'BING_WEBMASTER_SITE_URL'],
  yandex: [],
  indexnow: ['INDEXNOW_ENABLED'],
};

function envPresent(env: Record<string, string | undefined>, names: readonly string[]): boolean {
  return names.every((n) => (env[n] ?? '').trim().length > 0);
}

function envPresentSingular(env: Record<string, string | undefined>, name: string): boolean {
  return (env[name] ?? '').trim().length > 0;
}

/* ── Yandex verification file (the exact file + code, read from disk) ────── */

/** Files Yandex told us to drop at the site root. */
export const YANDEX_FILE_PATTERN = /^yandex_[A-Za-z0-9]+\.html$/i;

export interface YandexVerification {
  filename: string;
  /** The `Verification: <code>` value Yandex matches against. */
  code: string;
}

function defaultPublicDir(): string {
  return path.join(process.cwd(), 'public');
}

/**
 * Reads the REAL verification file from `public/` so the console can never
 * drift from what is served. Returns null when no such file exists — the
 * honest "not configured" state, not an error.
 */
export async function readYandexVerificationFile(
  publicDir: string = defaultPublicDir(),
): Promise<YandexVerification | null> {
  try {
    const entries = await readdir(publicDir);
    const filename = entries.find((f) => YANDEX_FILE_PATTERN.test(f));
    if (!filename) return null;
    const body = await readFile(path.join(publicDir, filename), 'utf8');
    const code = /Verification:\s*([A-Za-z0-9]{8,64})/.exec(body)?.[1];
    if (!code) return null;
    return { filename, code };
  } catch {
    return null;
  }
}

/* ── Tiny HTML readers (regex over served markup, bounded inputs) ────────── */

function attr(tag: string, key: string): string | null {
  const m = tag.match(new RegExp(`${key}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return m ? (m[1] ?? null) : null;
}

/** First `<meta name=…>` content for a meta name, case-insensitive. */
export function metaContent(html: string, name: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const want = name.toLowerCase();
  for (const tag of tags) {
    const n = attr(tag, 'name');
    if (n && n.toLowerCase() === want) return attr(tag, 'content');
  }
  return null;
}

/** `href` of `<link rel="canonical">`, or null when the page omits one. */
export function canonicalHref(html: string): string | null {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const rel = (attr(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
    if (rel.includes('canonical')) return attr(tag, 'href');
  }
  return null;
}

export function pageTitle(html: string): string | null {
  const m = /<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(html);
  return m?.[1]?.replace(/\s+/g, ' ').trim() ?? null;
}

/* ── Public-origin probes (read-only GETs against our own site) ─────────── */

const PROBE_TIMEOUT_MS = 5_000;

export interface ProbeResult {
  path: string;
  ok: boolean;
  status: number | null;
  /** Bounded body slice (never a full page dump). */
  body: string;
  error?: string;
}

export interface OriginProbes {
  origin: string;
  home: ProbeResult;
  robots: ProbeResult;
  sitemap: ProbeResult;
  indexnowKey: ProbeResult;
  /** null when no `yandex_*.html` exists in `public/`. */
  yandex: ProbeResult | null;
  yandexFile: YandexVerification | null;
}

async function grab(
  fetchLike: typeof fetch,
  origin: string,
  pathname: string,
  limit: number,
): Promise<ProbeResult> {
  try {
    const res = await fetchLike(`${origin}${pathname}`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const body = res.ok ? (await res.text()).slice(0, limit) : '';
    return { path: pathname, ok: res.ok, status: res.status, body };
  } catch (err) {
    return {
      path: pathname,
      ok: false,
      status: null,
      body: '',
      error: err instanceof Error ? err.message.slice(0, 120) : 'network error',
    };
  }
}

/**
 * Probes the public artifacts an admin needs to see. All requests are
 * GETs to `origin` (our own deployment — the request's own host when the
 * route passes `nextUrl.origin`), with a 5s timeout each.
 */
export async function probePublicOrigin(
  origin: string,
  fetchLike: typeof fetch = fetch,
  yandexFile: YandexVerification | null = null,
): Promise<OriginProbes> {
  const base = origin.replace(/\/+$/, '');
  const yandex = yandexFile
    ? await grab(fetchLike, base, `/${yandexFile.filename}`, 4_000)
    : null;
  const [home, robots, sitemap, indexnowKey] = await Promise.all([
    grab(fetchLike, base, '/', 150_000),
    grab(fetchLike, base, '/robots.txt', 8_000),
    grab(fetchLike, base, '/sitemap.xml', 600_000),
    grab(fetchLike, base, INDEXNOW_KEY_PATH, 1_000),
  ]);
  return { origin: base, home, robots, sitemap, indexnowKey, yandex, yandexFile };
}

/* ── Engine status derivation (pure: probes + env in, statuses out) ──────── */

/** Outcome of a LIVE Search Console call — supplied by the route, never faked. */
export interface GscLiveCheck {
  attempted: boolean;
  ok?: boolean;
  /** `INDEXED` / `NOT_INDEXED` / … straight from the official response. */
  indexStatus?: string;
  error?: string;
}

export interface DeriveInput {
  probes: OriginProbes;
  env: Record<string, string | undefined>;
  gsc?: GscLiveCheck;
}

function pass(label: string, detail: string): EngineCheck {
  return { label, state: 'pass', detail };
}
function fail(label: string, detail: string): EngineCheck {
  return { label, state: 'fail', detail };
}
function skip(label: string, detail: string): EngineCheck {
  return { label, state: 'skip', detail };
}

export function deriveEngineStatuses(input: DeriveInput): EngineStatusRow[] {
  const { probes, env } = input;
  return [
    deriveGoogle(probes, env, input.gsc),
    deriveBing(probes, env),
    deriveYandex(probes),
    deriveIndexNow(probes, env),
  ];
}

function deriveGoogle(
  probes: OriginProbes,
  env: Record<string, string | undefined>,
  gsc?: GscLiveCheck,
): EngineStatusRow {
  const required = ENGINE_ENV_REQUIREMENTS.google;
  const configured = envPresent(env, required);
  const meta = metaContent(probes.home.body, 'google-site-verification');
  const checks: EngineCheck[] = [
    probes.home.ok
      ? meta
        ? pass('Verification tag on /', `google-site-verification served in the home page <head>.`)
        : fail('Verification tag on /', 'No google-site-verification meta tag on the home page.')
      : skip('Verification tag on /', `Home page probe failed (${probes.home.status ?? probes.home.error ?? 'no response'}).`),
    configured
      ? pass('Search Console API credentials', 'All four GOOGLE_SEARCH_CONSOLE_* variables are present (names only — values never read here).')
      : fail('Search Console API credentials', `Missing: ${required.filter((n) => !envPresentSingular(env, n)).join(', ')}.`),
  ];

  let status: EngineStatus;
  let detail: string;
  if (!probes.home.ok) {
    status = 'error';
    detail = 'The home page could not be probed, so nothing can be confirmed.';
  } else if (!meta && !configured) {
    status = 'not_configured';
    detail = 'No verification tag is served and the Search Console API credentials are absent.';
  } else if (gsc?.attempted) {
    if (gsc.ok) {
      status = 'connected';
      detail = `OAuth credentials verified with a live Search Console call; homepage index status: ${gsc.indexStatus ?? 'UNKNOWN'}.`;
      checks.push(pass('Live API check', `URL Inspection succeeded (${gsc.indexStatus ?? 'UNKNOWN'}).`));
    } else {
      status = 'error';
      detail = `The live Search Console call failed: ${gsc.error ?? 'authorization rejected'}.`;
      checks.push(fail('Live API check', gsc.error ?? 'Authorization rejected.'));
    }
  } else if (meta && configured) {
    status = 'pending';
    detail = 'Verification tag is served and credentials are present — run the live check to confirm the API accepts them.';
    checks.push(skip('Live API check', 'Not run on this load — use the Live check button.'));
  } else if (meta) {
    status = 'pending';
    detail = 'Verification tag is served, but the Search Console API credentials are absent, so no live check is possible.';
  } else {
    status = 'pending';
    detail = 'API credentials are present, but no verification tag is served on the home page yet.';
  }

  return {
    id: 'google',
    label: 'Google Search Console',
    status,
    detail,
    requiredEnvVars: required,
    configured,
    checks,
    artifactUrl: meta ? '/' : null,
  };
}

function deriveBing(
  probes: OriginProbes,
  env: Record<string, string | undefined>,
): EngineStatusRow {
  const required = ENGINE_ENV_REQUIREMENTS.bing;
  const configured = envPresent(env, required);
  const meta = metaContent(probes.home.body, 'msvalidate.01');
  const checks: EngineCheck[] = [
    probes.home.ok
      ? meta
        ? pass('msvalidate.01 tag on /', `Bing verification tag served with content "${meta.slice(0, 8)}…".`)
        : fail('msvalidate.01 tag on /', 'No msvalidate.01 meta tag on the home page.')
      : skip('msvalidate.01 tag on /', `Home page probe failed (${probes.home.status ?? probes.home.error ?? 'no response'}).`),
    configured
      ? pass('Bing Webmaster API credentials', 'BING_WEBMASTER_API_KEY and BING_WEBMASTER_SITE_URL are present (names only).')
      : fail('Bing Webmaster API credentials', 'BING_WEBMASTER_API_KEY / BING_WEBMASTER_SITE_URL are absent — URL submission to Bing is unavailable.'),
  ];

  let status: EngineStatus;
  let detail: string;
  if (!probes.home.ok) {
    status = 'error';
    detail = 'The home page could not be probed, so nothing can be confirmed.';
  } else if (meta && configured) {
    status = 'pending';
    detail = 'Verification tag is served and the SubmitUrl API credentials are present. Bing publishes the acceptance inside its own portal — there is no official status endpoint to read, so this screen will not claim "verified" on Bing\'s behalf.';
  } else if (meta) {
    status = 'pending';
    detail = 'Verification tag is served at /. Bing confirms ownership in its portal; the Webmaster API credentials are absent, so URL submission is unavailable.';
  } else if (configured) {
    status = 'pending';
    detail = 'API credentials are present, but no msvalidate.01 tag is served on the home page, so Bing cannot verify the site.';
  } else {
    status = 'not_configured';
    detail = 'No verification tag is served and no Bing Webmaster API credentials are set.';
  }

  return {
    id: 'bing',
    label: 'Microsoft Bing Webmaster Tools',
    status,
    detail,
    requiredEnvVars: required,
    configured,
    checks,
    artifactUrl: meta ? '/' : null,
  };
}

function deriveYandex(probes: OriginProbes): EngineStatusRow {
  const file = probes.yandexFile;
  const required = ENGINE_ENV_REQUIREMENTS.yandex;
  const checks: EngineCheck[] = [];

  let status: EngineStatus;
  let detail: string;
  if (!file) {
    status = 'not_configured';
    detail = 'No yandex_*.html verification file exists in public/, so there is nothing to serve.';
    checks.push(fail('Verification file in public/', 'Not found.'));
  } else if (!probes.yandex) {
    status = 'error';
    detail = `The verification file exists in the repository but could not be probed.`;
    checks.push(fail('Verification file served', `Probe did not run for /${file.filename}.`));
  } else if (!probes.yandex.ok) {
    status = 'error';
    detail = `/${file.filename} answered ${probes.yandex.status ?? 'no response'} instead of 200 — Yandex cannot verify until the deploy serves it.`;
    checks.push(fail('Verification file served', `HTTP ${probes.yandex.status ?? 'error'}.`));
  } else {
    const served = /Verification:\s*([A-Za-z0-9]{8,64})/.exec(probes.yandex.body)?.[1];
    checks.push(
      pass('Verification file in public/', `public/${file.filename} contains the expected code.`),
    );
    if (served === file.code) {
      status = 'pending';
      detail = `/${file.filename} is served and matches the code Yandex issued. Yandex confirms ownership inside its own portal — there is no official API to read that verdict from, so this screen will not claim "verified" on Yandex's behalf.`;
      checks.push(pass('Verification file served', `HTTP 200 with the matching Verification code.`));
    } else {
      status = 'error';
      detail = `/${file.filename} is served but its Verification code does not match public/${file.filename} — the deploy is serving a stale file.`;
      checks.push(fail('Verification code match', 'Served body does not contain the expected code.'));
    }
  }

  return {
    id: 'yandex',
    label: 'Yandex Webmaster',
    status,
    detail,
    requiredEnvVars: required,
    configured: Boolean(file),
    checks,
    artifactUrl: file ? `/${file.filename}` : null,
  };
}

function deriveIndexNow(
  probes: OriginProbes,
  env: Record<string, string | undefined>,
): EngineStatusRow {
  const enabled = (env.INDEXNOW_ENABLED ?? '').trim().toLowerCase() === 'true';
  const required = ENGINE_ENV_REQUIREMENTS.indexnow;
  const keyProbe = probes.indexnowKey;
  const servedKey = keyProbe.body.trim();
  const matches = keyProbe.ok && servedKey === INDEXNOW_KEY;

  const checks: EngineCheck[] = [
    keyProbe.ok
      ? matches
        ? pass('Key file served', `${INDEXNOW_KEY_PATH} is served and matches the key we submit.`)
        : fail('Key file served', `${INDEXNOW_KEY_PATH} does not match the key in the payload — engines would reject every ping.`)
      : fail('Key file served', `${INDEXNOW_KEY_PATH} answered ${keyProbe.status ?? keyProbe.error ?? 'no response'}.`),
    enabled
      ? pass('Feature flag', 'INDEXNOW_ENABLED is true — submissions are allowed.')
      : fail('Feature flag', 'INDEXNOW_ENABLED is not true in this environment — nothing is submitted.'),
  ];

  let status: EngineStatus;
  let detail: string;
  if (!keyProbe.ok && !enabled) {
    status = 'not_configured';
    detail = 'The feature is switched off and the key file is not served.';
  } else if (!enabled) {
    status = 'not_configured';
    detail = `The key file is served correctly, but INDEXNOW_ENABLED is not true here, so no ping is ever sent. Set INDEXNOW_ENABLED=true to activate.`;
  } else if (!keyProbe.ok) {
    status = 'error';
    detail = `INDEXNOW_ENABLED is true but ${INDEXNOW_KEY_PATH} is not reachable — every submission would fail key validation.`;
  } else if (!matches) {
    status = 'error';
    detail = `The served key does not match the key in the payload. Submissions would be rejected.`;
  } else {
    status = 'connected';
    detail = 'Feature flag is on and the key file matches the submitted key — protocol-local checks pass. IndexNow has no status endpoint; each submission\'s HTTP result is recorded in Activity.';
  }

  return {
    id: 'indexnow',
    label: 'IndexNow',
    status,
    detail,
    requiredEnvVars: required,
    configured: enabled,
    checks,
    artifactUrl: INDEXNOW_KEY_PATH,
  };
}

/* ── SEO surface checks (derived from the same probes) ───────────────────── */

export interface SeoChecks {
  robots: { ok: boolean; detail: string; sitemapLine: string | null };
  sitemap: {
    ok: boolean;
    urlCount: number;
    productUrls: number;
    shopUrls: number;
    detail: string;
  };
  canonical: { present: boolean; url: string | null; matchesOrigin: boolean; detail: string };
}

function count(haystack: string, needle: string): number {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n += 1;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

export function deriveSeoChecks(probes: OriginProbes, configuredOrigin: string): SeoChecks {
  const robotsOk = probes.robots.ok;
  const sitemapLine = /Sitemap:\s*(\S+)/i.exec(probes.robots.body)?.[1] ?? null;
  const robots: SeoChecks['robots'] = {
    ok: Boolean(robotsOk && sitemapLine),
    sitemapLine,
    detail: !robotsOk
      ? `/robots.txt answered ${probes.robots.status ?? probes.robots.error ?? 'no response'}.`
      : sitemapLine
        ? 'Served with a Sitemap: pointer.'
        : 'Served, but it declares no Sitemap: line.',
  };

  const sitemapOk = probes.sitemap.ok && /<urlset[\s>]/i.test(probes.sitemap.body);
  const urlCount = count(probes.sitemap.body, '<loc>');
  const productUrls = count(probes.sitemap.body, '/products/');
  const shopUrls = count(probes.sitemap.body, '/sellers/');
  const sitemap: SeoChecks['sitemap'] = {
    ok: sitemapOk,
    urlCount,
    productUrls,
    shopUrls,
    detail: !probes.sitemap.ok
      ? `/sitemap.xml answered ${probes.sitemap.status ?? probes.sitemap.error ?? 'no response'}.`
      : sitemapOk
        ? `Served with ${urlCount} URLs (${productUrls} product, ${shopUrls} shop).`
        : 'Answered 200 but the body is not a sitemap document.',
  };

  const canonical = canonicalHref(probes.home.body);
  const matchesOrigin = canonical !== null && canonical.replace(/\/+$/, '') === configuredOrigin.replace(/\/+$/, '');
  const canonicalChecks: SeoChecks['canonical'] = {
    present: canonical !== null,
    url: canonical,
    matchesOrigin,
    detail: !probes.home.ok
      ? 'Home page probe failed, so the canonical could not be read.'
      : !canonical
        ? 'The home page emits no canonical link.'
        : matchesOrigin
          ? `Canonical matches the configured origin (${configuredOrigin}).`
          : `Canonical (${canonical}) differs from the configured origin (${configuredOrigin}).`,
  };

  return { robots, sitemap, canonical: canonicalChecks };
}

/** The origin SEO truth is judged against — the configured public origin. */
export function configuredOrigin(): string {
  return publicOrigin().replace(/\/+$/, '');
}

/* ── On-demand page spot-check (official, read-only GETs of our pages) ───── */

export interface PageSeo {
  path: string;
  ok: boolean;
  status: number | null;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  canonical: string | null;
  robots: string | null;
  issues: string[];
}

/** Bounds the spot-check: ≤5 URLs, 5s each, one origin. */
export const SPOT_CHECK_LIMIT = 5;

export async function inspectPublicPages(
  paths: string[],
  origin: string,
  fetchLike: typeof fetch = fetch,
  limit: number = SPOT_CHECK_LIMIT,
): Promise<PageSeo[]> {
  const base = origin.replace(/\/+$/, '');
  const out: PageSeo[] = [];
  for (const raw of paths.slice(0, limit)) {
    const pathname = raw.startsWith('/') ? raw : `/${raw}`;
    let probe: ProbeResult;
    try {
      const res = await fetchLike(`${base}${pathname}`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      const body = res.ok ? (await res.text()).slice(0, 150_000) : '';
      probe = { path: pathname, ok: res.ok, status: res.status, body };
    } catch (err) {
      probe = {
        path: pathname,
        ok: false,
        status: null,
        body: '',
        error: err instanceof Error ? err.message.slice(0, 120) : 'network error',
      };
    }

    const title = probe.ok ? pageTitle(probe.body) : null;
    const description = probe.ok ? metaContent(probe.body, 'description') : null;
    const canonical = probe.ok ? canonicalHref(probe.body) : null;
    const robots = probe.ok ? metaContent(probe.body, 'robots') : null;
    const issues: string[] = [];
    if (!probe.ok) issues.push(`Page answered ${probe.status ?? probe.error ?? 'no response'}.`);
    if (probe.ok && !title) issues.push('No <title>.');
    if (probe.ok && title && title.length > 65) issues.push(`Title is ${title.length} characters (aim for ≤65).`);
    if (probe.ok && !description) issues.push('No meta description.');
    if (probe.ok && !canonical) issues.push('No canonical link.');
    if (probe.ok && robots && /noindex/i.test(robots)) issues.push('Page carries noindex while being spot-checked for indexing.');

    out.push({
      path: pathname,
      ok: probe.ok,
      status: probe.status,
      title,
      titleLength: title?.length ?? 0,
      metaDescription: description,
      canonical,
      robots,
      issues,
    });
  }
  return out;
}
