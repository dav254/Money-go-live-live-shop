/**
 * SEARCH ENGINE CENTER — the console may only ever report what it checked.
 *
 * Three things are pinned here:
 *
 *  1. The EXISTING verification artifacts stay exactly as issued — the Bing
 *     `msvalidate.01` tag in the root layout and the Yandex `yandex_*.html`
 *     file at the site root — and the lib probes their exact public URLs.
 *  2. Status derivation is honest: `verified` (engine-side acceptance) is
 *     never produced by our own checks, a failed live call reports `error`,
 *     and a disabled/misconfigured integration never reads as success.
 *  3. The admin surface is gated server-side and returns env var NAMES only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  ENGINE_ENV_REQUIREMENTS,
  SPOT_CHECK_LIMIT,
  canonicalHref,
  deriveEngineStatuses,
  deriveSeoChecks,
  inspectPublicPages,
  metaContent,
  probePublicOrigin,
  readYandexVerificationFile,
  type DeriveInput,
  type OriginProbes,
  type ProbeResult,
} from '../lib/seo/search-engine-center';
import { INDEXNOW_KEY, INDEXNOW_KEY_PATH } from '../lib/seo/indexnow';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const YANDEX_FILE_PATTERN = /^yandex_[A-Za-z0-9]+\.html$/i;

/* ── Fixtures ─────────────────────────────────────────────────────────────── */

function probe(partial: Partial<ProbeResult> = {}): ProbeResult {
  return { path: '/', ok: true, status: 200, body: '', ...partial };
}

function probes(partial: Partial<OriginProbes> = {}): OriginProbes {
  return {
    origin: 'https://vidnov.com',
    home: probe({ path: '/' }),
    robots: probe({ path: '/robots.txt', body: 'User-agent: *\nSitemap: https://vidnov.com/sitemap.xml' }),
    sitemap: probe({ path: '/sitemap.xml', body: '<urlset><url><loc>https://vidnov.com/products/a</loc></url></urlset>' }),
    indexnowKey: probe({ path: INDEXNOW_KEY_PATH, body: `${INDEXNOW_KEY}\n` }),
    yandex: probe({ path: '/yandex_test.html', body: 'Verification: abcdef123456' }),
    yandexFile: { filename: 'yandex_test.html', code: 'abcdef123456' },
    ...partial,
  };
}

const NO_ENV: Record<string, string | undefined> = {};
const ALL_CONFIGURED = {
  GOOGLE_SEARCH_CONSOLE_CLIENT_ID: 'id',
  GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET: 'secret',
  GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN: 'token',
  GOOGLE_SEARCH_CONSOLE_SITE_URL: 'https://vidnov.com',
  BING_WEBMASTER_API_KEY: 'key',
  BING_WEBMASTER_SITE_URL: 'https://vidnov.com',
  INDEXNOW_ENABLED: 'true',
};

function statusOf(input: Partial<DeriveInput>, id: string) {
  const rows = deriveEngineStatuses({
    probes: input.probes ?? probes(),
    env: input.env ?? NO_ENV,
    ...(input.gsc ? { gsc: input.gsc } : {}),
  });
  const row = rows.find((r) => r.id === id);
  assert.ok(row, `engine ${id} is present`);
  return row;
}

/* ── 1 · Existing verification artifacts are preserved ───────────────────── */

describe('existing verification codes are preserved and probed at their exact URLs', () => {
  it('the Bing msvalidate.01 tag is still in the root layout with the issued code', () => {
    const layout = read('src/app/layout.tsx');
    assert.ok(
      layout.includes("'msvalidate.01': '65BCB3F6E5C04EAAFC7BE59684ADBF43'"),
      'the Bing verification code must stay exactly as issued',
    );
    assert.ok(layout.includes('verification:'), 'the tag ships through Next metadata');
  });

  it('exactly one Yandex verification file exists at the public root, with its code', () => {
    const files = fs.readdirSync(path.join(ROOT, 'public')).filter((f) => YANDEX_FILE_PATTERN.test(f));
    assert.equal(files.length, 1, `expected one yandex_*.html file, found ${files.length}`);
    const body = fs.readFileSync(path.join(ROOT, 'public', files[0]), 'utf8');
    assert.match(body, /Verification:\s*[A-Za-z0-9]{8,64}/, 'the file carries a Verification code');
    assert.match(files[0], /^yandex_[A-Za-z0-9]+\.html$/, 'served at the exact filename Yandex requires');
  });

  it('readYandexVerificationFile reports the SAME file and code that is served', async () => {
    const found = await readYandexVerificationFile();
    assert.ok(found, 'the file is discovered from disk');
    const served = fs.readFileSync(path.join(ROOT, 'public', found.filename), 'utf8');
    const code = /Verification:\s*([A-Za-z0-9]{8,64})/.exec(served)?.[1];
    assert.equal(found.code, code, 'the code checked is the code on disk');
  });

  it('probePublicOrigin asks for the exact verification URLs', async () => {
    const seen: string[] = [];
    const fakeFetch = (async (url: string | URL) => {
      seen.push(String(url));
      return new Response('Verification: abcdef123456', { status: 200 });
    }) as unknown as typeof fetch;

    const result = await probePublicOrigin(
      'https://vidnov.com',
      fakeFetch,
      { filename: 'yandex_b4efb8b912dc1041.html', code: 'b4efb8b912dc1041' },
    );
    assert.equal(result.yandex?.path, '/yandex_b4efb8b912dc1041.html');
    assert.ok(seen.some((u) => u.endsWith('/yandex_b4efb8b912dc1041.html')));
    assert.ok(seen.some((u) => u.endsWith('/')));
    assert.ok(seen.some((u) => u.endsWith('/robots.txt')));
    assert.ok(seen.some((u) => u.endsWith('/sitemap.xml')));
    assert.ok(seen.some((u) => u.endsWith(INDEXNOW_KEY_PATH)));
    assert.equal(result.yandex?.ok, true);
  });
});

/* ── 2 · Status derivation is honest ─────────────────────────────────────── */

describe('engine statuses never claim more than the checks proved', () => {
  it('never emits `verified` from our own checks — that state needs engine-side evidence', () => {
    const scenarios: DeriveInput[] = [
      { probes: probes(), env: ALL_CONFIGURED },
      { probes: probes(), env: NO_ENV },
      {
        probes: probes({
          home: probe({ body: '<meta name="google-site-verification" content="x"><meta name="msvalidate.01" content="y">' }),
        }),
        env: ALL_CONFIGURED,
      },
      {
        probes: probes({
          home: probe({ status: 500, ok: false, body: '' }),
          yandex: probe({ ok: false, status: 404, body: '' }),
        }),
        env: ALL_CONFIGURED,
      },
    ];
    for (const scenario of scenarios) {
      for (const row of deriveEngineStatuses(scenario)) {
        assert.notEqual(row.status, 'verified', `${row.id} must not self-report verified`);
      }
    }
  });

  it('IndexNow: connected only when the flag is on AND the served key matches', () => {
    assert.equal(statusOf({ env: { INDEXNOW_ENABLED: 'true' } }, 'indexnow').status, 'connected');
    assert.equal(
      statusOf(
        { env: { INDEXNOW_ENABLED: 'true' }, probes: probes({ indexnowKey: probe({ body: 'deadbeef\n' }) }) },
        'indexnow',
      ).status,
      'error',
      'a mismatched key file would fail engine validation — that is an error, not a success',
    );
    assert.equal(
      statusOf(
        { env: { INDEXNOW_ENABLED: 'true' }, probes: probes({ indexnowKey: probe({ ok: false, status: 404, body: '' }) }) },
        'indexnow',
      ).status,
      'error',
    );
    assert.equal(statusOf({ env: NO_ENV }, 'indexnow').status, 'not_configured');
    assert.equal(statusOf({ env: { INDEXNOW_ENABLED: 'false' } }, 'indexnow').status, 'not_configured');
  });

  it('Yandex: pending while the file is served and matching, error otherwise', () => {
    assert.equal(statusOf({}, 'yandex').status, 'pending');
    assert.equal(
      statusOf(
        { probes: probes({ yandex: probe({ ok: false, status: 404, body: '' }) }) },
        'yandex',
      ).status,
      'error',
      'a 404 on the verification file is an error, not a pending state',
    );
    assert.equal(
      statusOf({ probes: probes({ yandex: probe({ body: 'Verification: WRONGCODE99' }) }) }, 'yandex').status,
      'error',
      'a stale served file must never read as configured',
    );
    assert.equal(
      statusOf(
        { probes: probes({ yandex: null, yandexFile: null }) },
        'yandex',
      ).status,
      'not_configured',
    );
  });

  it('Bing: pending at best until the engine itself confirms; never `connected` from a tag alone', () => {
    const withTag = probes({
      home: probe({ body: '<meta name="msvalidate.01" content="65BCB3F6E5C04EAAFC7BE59684ADBF43">' }),
    });
    assert.equal(statusOf({ probes: withTag, env: NO_ENV }, 'bing').status, 'pending');
    assert.equal(statusOf({ probes: withTag, env: ALL_CONFIGURED }, 'bing').status, 'pending');
    assert.equal(
      statusOf({ probes: probes({ home: probe({ body: '<html></html>' }) }), env: NO_ENV }, 'bing').status,
      'not_configured',
    );
    assert.equal(
      statusOf({ probes: probes({ home: probe({ status: 500, ok: false, body: '' }) }), env: ALL_CONFIGURED }, 'bing').status,
      'error',
    );
  });

  it('Google: a FAILED live API call reports error, a passed one reports connected', () => {
    const withTag = probes({
      home: probe({ body: '<meta name="google-site-verification" content="abc">' }),
    });
    assert.equal(
      statusOf({ probes: withTag, env: ALL_CONFIGURED, gsc: { attempted: true, ok: false, error: 'invalid_grant' } }, 'google').status,
      'error',
      'a rejected credential must not read as connected',
    );
    assert.equal(
      statusOf({ probes: withTag, env: ALL_CONFIGURED, gsc: { attempted: true, ok: true, indexStatus: 'INDEXED' } }, 'google').status,
      'connected',
    );
    assert.equal(statusOf({ probes: withTag, env: ALL_CONFIGURED }, 'google').status, 'pending');
    assert.equal(
      statusOf({ probes: withTag, env: NO_ENV }, 'google').status,
      'pending',
      'tag served without credentials is still pending',
    );
    assert.equal(
      statusOf({ probes: probes({ home: probe({ body: '<html></html>' }) }), env: NO_ENV }, 'google').status,
      'not_configured',
    );
  });

  it('every row exposes env var NAMES only (never values) and a plain-language detail', () => {
    for (const row of deriveEngineStatuses({ probes: probes(), env: ALL_CONFIGURED })) {
      assert.ok(row.detail.length > 10, `${row.id} explains itself`);
      for (const name of row.requiredEnvVars) {
        assert.match(name, /^[A-Z][A-Z0-9_]*$/, `${row.id} lists uppercase env names`);
      }
    }
    assert.deepEqual([...ENGINE_ENV_REQUIREMENTS.bing], ['BING_WEBMASTER_API_KEY', 'BING_WEBMASTER_SITE_URL']);
  });
});

/* ── 3 · SEO surface checks ──────────────────────────────────────────────── */

describe('SEO checks read the probed documents', () => {
  it('flags a robots.txt without a Sitemap pointer', () => {
    const bad = deriveSeoChecks(
      probes({ robots: probe({ body: 'User-agent: *\nDisallow: /dashboard' }) }),
      'https://vidnov.com',
    );
    assert.equal(bad.robots.ok, false);
    assert.equal(bad.robots.sitemapLine, null);

    const good = deriveSeoChecks(probes(), 'https://vidnov.com');
    assert.equal(good.robots.ok, true);
    assert.equal(good.robots.sitemapLine, 'https://vidnov.com/sitemap.xml');
  });

  it('counts product and shop URLs in the sitemap body', () => {
    const body = [
      '<urlset>',
      '<url><loc>https://vidnov.com/products/p1</loc></url>',
      '<url><loc>https://vidnov.com/products/p2</loc></url>',
      '<url><loc>https://vidnov.com/sellers/s1</loc></url>',
      '</urlset>',
    ].join('');
    const result = deriveSeoChecks(probes({ sitemap: probe({ body }) }), 'https://vidnov.com');
    assert.equal(result.sitemap.ok, true);
    assert.equal(result.sitemap.urlCount, 3);
    assert.equal(result.sitemap.productUrls, 2);
    assert.equal(result.sitemap.shopUrls, 1);
  });

  it('reports canonical mismatches against the configured origin', () => {
    const mismatch = deriveSeoChecks(
      probes({ home: probe({ body: '<link rel="canonical" href="https://www.example.com/">' }) }),
      'https://vidnov.com',
    );
    assert.equal(mismatch.canonical.present, true);
    assert.equal(mismatch.canonical.matchesOrigin, false);

    const missing = deriveSeoChecks(probes({ home: probe({ body: '<html></html>' }) }), 'https://vidnov.com');
    assert.equal(missing.canonical.present, false);
    assert.equal(missing.canonical.matchesOrigin, false);
  });

  it('reads meta tags regardless of attribute order', () => {
    assert.equal(
      metaContent('<meta content="abc123" name="msvalidate.01">', 'msvalidate.01'),
      'abc123',
    );
    assert.equal(
      metaContent('<meta name="google-site-verification" content="xyz">', 'google-site-verification'),
      'xyz',
    );
    assert.equal(metaContent('<meta name="description" content="hello">', 'robots'), null);
    assert.equal(
      canonicalHref('<link href="https://vidnov.com/" rel="canonical">'),
      'https://vidnov.com/',
    );
    assert.equal(canonicalHref('<html></html>'), null);
  });
});

/* ── 4 · Spot-check stays bounded and read-only ──────────────────────────── */

describe('page spot-check', () => {
  it('respects the limit and reports issues per page', async () => {
    let calls = 0;
    const fakeFetch = (async () => {
      calls += 1;
      return new Response('<html><head><title>Product</title></head><body></body></html>', { status: 200 });
    }) as unknown as typeof fetch;

    const pages = await inspectPublicPages(
      ['/products/a', '/products/b', '/products/c'],
      'https://vidnov.com',
      fakeFetch,
      2,
    );
    assert.equal(pages.length, 2, 'bounded by the limit');
    assert.equal(calls, 2);
    assert.ok(pages[0].issues.includes('No meta description.'));
    assert.ok(pages[0].issues.includes('No canonical link.'));
    assert.equal(pages[0].title, 'Product');
  });

  it('uses a fixed small default limit', () => {
    assert.equal(SPOT_CHECK_LIMIT, 5);
  });
});

/* ── 5 · The admin surface stays gated and leak-free ─────────────────────── */

describe('routes are admin-gated and return names only', () => {
  const routes = [
    'src/app/api/admin/search-engines/status/route.ts',
    'src/app/api/admin/search-engines/submit/route.ts',
    'src/app/api/admin/search-engines/history/route.ts',
  ];

  for (const rel of routes) {
    it(`${rel} calls verifyAdminUid before doing anything`, () => {
      const src = read(rel);
      const guard = src.indexOf('verifyAdminUid');
      assert.ok(guard >= 0, 'uses the shared admin guard');
      assert.ok(
        src.indexOf('403') > guard,
        'answers 403 when the guard returns nothing',
      );
      assert.ok(
        guard < src.indexOf('await request.json()') || !src.includes('await request.json()'),
        'the body is not even parsed before authorization',
      );
    });
  }

  it('the status response never echoes environment values', () => {
    const src = read('src/app/api/admin/search-engines/status/route.ts');
    const responseBlock = src.slice(src.lastIndexOf('NextResponse.json('));
    assert.ok(!responseBlock.includes('process.env'), 'raw env never reaches the payload');
    assert.ok(!responseBlock.includes('...'), 'nothing is spread into the payload');
  });

  it('submissions validate site-relative paths through the shared private-path guard', () => {
    const src = read('src/app/api/admin/search-engines/submit/route.ts');
    assert.ok(src.includes('isPrivatePath'), 'private/admin/auth paths are rejected');
    assert.ok(src.includes('const MAX_BATCH = 10'), 'batches are hard-capped');
    for (const adapter of ['pingIndexNow', 'submitSitemapToSearchConsole', 'runDestinationAction']) {
      assert.ok(src.includes(adapter), `${adapter} is reused, not reimplemented`);
    }
  });

  it('records manual submissions in the EXISTING audit log, action set extended once', () => {
    const src = read('src/app/api/admin/search-engines/submit/route.ts');
    assert.ok(src.includes('recordAudit'), 'no second log store');
    const audit = read('src/lib/vidnov-core/distribution/audit.ts');
    assert.ok(audit.includes("'url_submitted'"), 'the audit set covers manual URL submissions');
  });
});
