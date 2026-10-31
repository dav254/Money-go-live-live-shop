/**
 * GET /api/admin/search-engines/status
 *
 * The Search Engine Center's Overview/Verification data: per-engine status
 * derived from checks this request actually performs (see
 * `src/lib/seo/search-engine-center.ts` for the honesty contract), plus the
 * SEO surface checks (robots, sitemap, canonical).
 *
 * Two kinds of network traffic, both bounded:
 *   • read-only GETs to THIS deployment's own public origin (5s each);
 *   • an optional LIVE Search Console URL Inspection call, only when the
 *     admin asks for it (`?live=1`) and the OAuth credentials exist — so a
 *     page load never burns API quota.
 *
 * Authorization: `verifyAdminUid`. Response carries environment-variable
 * NAMES and public artifact URLs only — never values, never tokens.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import {
  ENGINE_ENV_REQUIREMENTS,
  configuredOrigin,
  deriveEngineStatuses,
  deriveSeoChecks,
  probePublicOrigin,
  readYandexVerificationFile,
  systemFetch,
  type GscLiveCheck,
} from '@/lib/seo/search-engine-center';
import { runDestinationAction } from '@/lib/vidnov-core/distribution/adapters';
import { publicUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

function allPresent(names: readonly string[]): boolean {
  return names.every((n) => (process.env[n] ?? '').trim().length > 0);
}

/** Live Search Console probe — official URL Inspection, nothing invented. */
async function liveSearchConsoleCheck(): Promise<GscLiveCheck> {
  const res = await runDestinationAction('search_console', 'inspect', {
    absoluteUrl: publicUrl('/'),
    publicPath: '/',
    fetchImpl: systemFetch,
  });
  if (res.outcome === 'accepted') {
    const parsed = /Index status:\s*([A-Z_]+)/.exec(res.message ?? '');
    return {
      attempted: true,
      ok: true,
      indexStatus:
        res.confirmed === 'indexed' ? 'INDEXED' : (parsed?.[1] ?? 'NOT_INDEXED'),
    };
  }
  return {
    attempted: true,
    ok: false,
    error: res.message ?? `Search Console returned ${res.responseStatus ?? 'no status'}.`,
  };
}

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const yandexFile = await readYandexVerificationFile();
  const probes = await probePublicOrigin(request.nextUrl.origin, fetch, yandexFile);

  let gsc: GscLiveCheck | undefined;
  if (request.nextUrl.searchParams.get('live') === '1' && allPresent(ENGINE_ENV_REQUIREMENTS.google)) {
    gsc = await liveSearchConsoleCheck();
  }

  const engines = deriveEngineStatuses({ probes, env: process.env, gsc });
  const seo = deriveSeoChecks(probes, configuredOrigin());

  return NextResponse.json({
    origin: probes.origin,
    configuredOrigin: configuredOrigin(),
    checkedAt: new Date().toISOString(),
    liveCheckRan: Boolean(gsc),
    engines,
    seo,
  });
}
