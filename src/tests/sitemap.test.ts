/**
 * SITEMAP CONTRACT — what Search Console is promised, checked mechanically.
 *
 * The endpoint-level facts (HTTP 200, `application/xml`, parses) are verified
 * against the running app; these tests pin the rules that generate the
 * document: canonical domain, privacy exclusions, dedupe, id hygiene and
 * well-formed (escaped) XML.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSitemapEntries,
  entriesToSitemapXml,
  isPrivatePath,
  SITEMAP_ORIGIN,
} from '../lib/sitemap-entries';
import robots from '../app/robots';

test('sitemap uses exactly the canonical https://vidnov.com origin', () => {
  assert.equal(SITEMAP_ORIGIN, 'https://vidnov.com');
  const entries = buildSitemapEntries({
    productIds: ['prod_1', 'prod_2'],
    shopIds: ['sellerA'],
  });
  for (const e of entries) {
    assert.ok(
      e.url === SITEMAP_ORIGIN || e.url.startsWith(`${SITEMAP_ORIGIN}/`),
      `URL escapes canonical origin: ${e.url}`,
    );
    assert.ok(!e.url.startsWith('http://'), `non-HTTPS URL: ${e.url}`);
    assert.ok(!e.url.includes('www.'), `unexpected www host: ${e.url}`);
  }
});

test('homepage is always first and present exactly once', () => {
  const entries = buildSitemapEntries({ productIds: [], shopIds: [] });
  assert.equal(entries[0]?.url, SITEMAP_ORIGIN);
  assert.equal(
    entries.filter((e) => e.url === SITEMAP_ORIGIN).length,
    1,
    'homepage duplicated',
  );
});

test('public listings are included when eligible', () => {
  const entries = buildSitemapEntries({
    productIds: ['abc123', 'def_456'],
    shopIds: ['seller7'],
  });
  const urls = entries.map((e) => e.url);
  assert.ok(urls.includes(`${SITEMAP_ORIGIN}/products/abc123`));
  assert.ok(urls.includes(`${SITEMAP_ORIGIN}/products/def_456`));
  assert.ok(urls.includes(`${SITEMAP_ORIGIN}/sellers/seller7`));
});

test('private surfaces never appear, and /sellers is not caught by /seller', () => {
  assert.equal(isPrivatePath('/dashboard/seller'), true);
  assert.equal(isPrivatePath('/app/buyer/cart'), true);
  assert.equal(isPrivatePath('/admin'), true);
  assert.equal(isPrivatePath('/auth'), true);
  assert.equal(isPrivatePath('/checkout/123'), true);
  // Segment-aware: the public storefront route must NOT be treated private.
  assert.equal(isPrivatePath('/sellers/seller7'), false);
  assert.equal(isPrivatePath('/products/abc'), false);

  const entries = buildSitemapEntries({
    // Hostile/edge inputs: a builder must never emit private paths even if a
    // caller passes ids that would form them.
    productIds: ['../dashboard', 'a/b', '', null, 'ok-id'],
    shopIds: ['seller7'],
  });
  for (const e of entries) {
    assert.equal(isPrivatePath(new URL(e.url).pathname), false, e.url);
  }
  const urls = entries.map((e) => e.url);
  assert.ok(urls.includes(`${SITEMAP_ORIGIN}/sellers/seller7`), '/sellers must survive the deny-list');
});

test('ids are deduplicated and hygiene-filtered', () => {
  const entries = buildSitemapEntries({
    productIds: ['dup', 'dup', 'has space', 'a<b'],
    shopIds: ['dup-shop', 'dup-shop'],
  });
  const urls = entries.map((e) => e.url);
  assert.equal(urls.filter((u) => u.endsWith('/products/dup')).length, 1);
  assert.equal(urls.filter((u) => u.endsWith('/sellers/dup-shop')).length, 1);
  assert.ok(!urls.some((u) => u.includes('has%20space') || u.includes('has space')));
  assert.ok(!urls.some((u) => u.includes('a<b') || u.includes('a%3Cb')));
});

test('generated XML is well-formed, escaped and count-accurate', () => {
  const entries = buildSitemapEntries({
    // `&` ids are dropped by the hygiene filter (never emitted at all),
    // so the document below is guaranteed escapable-by-construction.
    productIds: ['prod&1', 'safe'],
    shopIds: ['seller7'],
  });
  assert.ok(!entries.some((e) => e.url.includes('prod&1')), 'unsafe id must be filtered');
  const xml = entriesToSitemapXml(entries);

  assert.ok(xml.startsWith('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
  assert.ok(xml.endsWith('</urlset>'));

  const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.length, entries.length, '<loc> count must match entries');
  // `&` must be escaped, not raw
  assert.ok(!/<loc>[^<]*&[^a]/.test(xml.replace(/&amp;|&lt;|&gt;|&quot;/g, '')), 'raw ampersand in XML');

  // Escaping itself, proven directly at the serializer with a crafted entry
  // (production ids never contain these characters — see hygiene filter).
  const hostile = entriesToSitemapXml([
    { url: 'https://vidnov.com/products/a&b?q=1<z>"' },
  ]);
  assert.ok(hostile.includes('a&amp;b?q=1&lt;z&gt;&quot;'), `escaping broken: ${hostile}`);
  assert.ok(!hostile.includes('a&b'), 'raw ampersand leaked');

  // Balanced <url> elements (lightweight well-formedness: every open has a close).
  const opens = (xml.match(/<url>/g) || []).length;
  const closes = (xml.match(/<\/url>/g) || []).length;
  assert.equal(opens, closes);
  assert.equal(opens, entries.length);

  // Homepage loc is the bare canonical origin.
  assert.equal(locs[0], SITEMAP_ORIGIN);
});

test('entry list stays under the sitemap protocol ceiling', () => {
  const many = Array.from({ length: 60_000 }, (_, i) => `id${i}`);
  const entries = buildSitemapEntries({ productIds: many, shopIds: [] });
  assert.ok(entries.length <= 5000, `expected cap, got ${entries.length}`);
});

test('robots preserves sitemap pointer and the original disallow list', () => {
  const rules = robots();
  // Next types `rules` as object-or-array — normalize once here.
  const list = Array.isArray(rules.rules) ? rules.rules : [rules.rules];
  assert.equal(rules.sitemap, `${SITEMAP_ORIGIN}/sitemap.xml`);

  const wildcard = list.find((r) => r.userAgent === '*');
  assert.ok(wildcard, 'wildcard rule must exist');
  assert.equal(wildcard.allow, '/');
  assert.deepEqual(
    wildcard.disallow,
    ['/dashboard', '/app', '/admin', '/api', '/auth', '/messages', '/checkout', '/buyer'],
    'original disallow list preserved verbatim',
  );
});

test('robots explicitly allows OAI-SearchBot and ordinary search crawlers', () => {
  const rules = robots();
  const list = Array.isArray(rules.rules) ? rules.rules : [rules.rules];
  const wildcard = list.find((r) => r.userAgent === '*')!;

  for (const ua of ['OAI-SearchBot', 'Googlebot', 'Bingbot', 'DuckDuckBot']) {
    const rule = list.find((r) => r.userAgent === ua);
    assert.ok(rule, `${ua} must have an explicit rule`);
    assert.equal(rule.allow, '/', `${ua} must be explicitly allowed`);
    assert.deepEqual(rule.disallow, wildcard.disallow, `${ua} keeps the same disallow list`);
  }

  // Named rules come first: consumers take the first match.
  assert.equal(list[0]?.userAgent, 'OAI-SearchBot');

  // GPTBot must NOT be named — its permissions stay whatever the wildcard
  // has always given it, unless changed for a separate documented reason.
  assert.ok(
    !list.some((r) => /GPTBot/i.test(String(r.userAgent))),
    'GPTBot must not gain an explicit rule',
  );
});