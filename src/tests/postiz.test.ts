/**
 * POSTIZ INTEGRATION — the guarantees the Vidnov ↔ Postiz bridge must never lose.
 *
 *   • only genuine stored listing facts can enter a campaign: missing price,
 *     unavailable stock and nameless listings are refused, not guessed around;
 *   • campaign text is assembled from stored fields only + an optional human
 *     note, always ending in the attributed product link;
 *   • Vidnov may only ever create `draft` or `schedule` posts — never `now`,
 *     and `published` is unreachable without provider confirmation;
 *   • the API key lives server-side only, upstream bodies are never echoed,
 *     and failures come back as safe error classes;
 *   • the admin routes verify admin identity, rate-limit the publish path,
 *     derive provider types from Postiz itself (never from client input),
 *     and the client bundle never sees POSTIZ_* env access.
 *
 * Run: npx tsx --test src/tests/postiz.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  MAX_CAMPAIGN_CHARS,
  buildCampaignText,
  checkProductEligibility,
  formatPrice,
  outcomeForCreate,
  sanitizeNote,
} from '../lib/postiz/content';
import {
  classifyHttpStatus,
  getPostizConfig,
  postizCreatePost,
  postizListChannels,
  type PostizConfig,
} from '../lib/postiz/client';
import { PUBLISH_LIMIT, allowRequest, countWithin } from '../lib/postiz/rate-limit';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const APP_URL = 'https://vidnov.com';
const baseProduct = {
  name: 'Maison One chronograph',
  price: 249,
  localCurrency: 'KES',
  stock: 4,
};

/* ── Eligibility: only genuine, purchasable listings ─────────────────────── */

describe('listing eligibility', () => {
  it('accepts a priced, in-stock listing', () => {
    assert.deepEqual(checkProductEligibility(baseProduct), { eligible: true, price: 249 });
  });

  it('refuses missing, zero and invalid prices', () => {
    assert.deepEqual(checkProductEligibility({ ...baseProduct, price: 0 }), {
      eligible: false,
      reason: 'missing_price',
    });
    assert.deepEqual(checkProductEligibility({ ...baseProduct, price: Number.NaN }), {
      eligible: false,
      reason: 'missing_price',
    });
    assert.deepEqual(checkProductEligibility({ ...baseProduct, price: undefined }), {
      eligible: false,
      reason: 'missing_price',
    });
  });

  it('refuses nameless listings', () => {
    assert.deepEqual(checkProductEligibility({ ...baseProduct, name: '   ' }), {
      eligible: false,
      reason: 'missing_name',
    });
  });

  it('refuses out-of-stock and fully-booked states, trusts other states', () => {
    assert.equal(
      checkProductEligibility({ ...baseProduct, availabilityState: 'out_of_stock' }).eligible,
      false,
    );
    assert.equal(
      checkProductEligibility({ ...baseProduct, availabilityState: 'fully_booked' }).eligible,
      false,
    );
    // The storefront treats every other state as purchasable.
    for (const state of ['preorder', 'on_request', 'available_today', 'low_stock']) {
      assert.equal(checkProductEligibility({ ...baseProduct, availabilityState: state }).eligible, true);
    }
  });

  it('refuses zero-stock products without a state — but services have no stock', () => {
    assert.deepEqual(checkProductEligibility({ ...baseProduct, stock: 0 }), {
      eligible: false,
      reason: 'unavailable',
    });
    assert.equal(
      checkProductEligibility({ ...baseProduct, stock: 0, listingType: 'service' }).eligible,
      true,
    );
    assert.equal(checkProductEligibility({ ...baseProduct, stock: 5 }).eligible, true);
  });
});

/* ── Rendering: stored facts only, link always last ──────────────────────── */

describe('campaign text rendering', () => {
  it('renders exactly the stored facts and the attributed link', () => {
    const text = buildCampaignText({
      productId: 'abc123',
      product: baseProduct,
      appUrl: `${APP_URL}/`,
    });
    assert.equal(
      text,
      'Maison One chronograph\n249 KES\nhttps://vidnov.com/products/abc123?ref=postiz',
    );
  });

  it('omits the currency when the record has none — it never invents one', () => {
    const text = buildCampaignText({
      productId: 'x',
      product: { name: 'Plain item', price: 10.5 },
      appUrl: APP_URL,
    });
    assert.ok(text.includes('\n10.50\n'));
    assert.ok(!/KES|NGN|USD|EUR|\$/.test(text), 'no currency may be fabricated');
  });

  it('formats stored prices verbatim (no invented rounding of integers)', () => {
    assert.equal(formatPrice(249), '249');
    assert.equal(formatPrice(249.99), '249.99');
    assert.equal(formatPrice(10.5), '10.50');
    // Lowercase currency codes are normalized; junk codes are dropped.
    const lower = buildCampaignText({
      productId: 'x',
      product: { ...baseProduct, localCurrency: 'kes' },
      appUrl: APP_URL,
    });
    assert.ok(lower.includes('249 KES'));
    const junk = buildCampaignText({
      productId: 'x',
      product: { ...baseProduct, localCurrency: 'KES!' },
      appUrl: APP_URL,
    });
    assert.ok(!junk.includes('KES!'));
  });

  it('keeps the human note as garnish and strips control characters', () => {
    const note = sanitizeNote('Fresh\u0000 drop\n\nlive now');
    assert.equal(note, 'Fresh drop live now');
    const text = buildCampaignText({
      productId: 'abc',
      product: baseProduct,
      appUrl: APP_URL,
      note,
    });
    assert.ok(text.startsWith('Fresh drop live now\n'));
  });

  it('never truncates the link — human copy yields to it', () => {
    const text = buildCampaignText({
      productId: 'long-id',
      product: { name: 'N'.repeat(400), price: 1, localCurrency: 'USD' },
      appUrl: APP_URL,
      note: 'W'.repeat(400),
    });
    const lines = text.split('\n');
    assert.ok(text.length <= MAX_CAMPAIGN_CHARS + 1, `got ${text.length}`);
    assert.equal(lines[lines.length - 1], 'https://vidnov.com/products/long-id?ref=postiz');
  });

  it('URL-encodes product ids in the share link', () => {
    const text = buildCampaignText({
      productId: 'a/b c',
      product: baseProduct,
      appUrl: APP_URL,
    });
    assert.ok(text.includes('/products/a%2Fb%20c?ref=postiz'));
  });
});

/* ── Outcomes: accepted / scheduled / failed — never a fake "published" ──── */

describe('outcome honesty', () => {
  it('maps create types to accepted/scheduled only', () => {
    assert.equal(outcomeForCreate('draft'), 'accepted');
    assert.equal(outcomeForCreate('schedule'), 'scheduled');
    const src = read('src/lib/postiz/content.ts');
    assert.ok(
      !/:\s*'published'/.test(src),
      "'published' must not be an assignable outcome from the create API",
    );
  });

  it('the code never sends an immediate `now` post', () => {
    for (const file of ['src/lib/postiz/client.ts', 'src/app/api/admin/postiz/publish/route.ts']) {
      const src = read(file);
      assert.ok(!/type:\s*'now'/.test(src), `${file} must never build a publish-now payload`);
    }
  });
});

/* ── Client: config, classification, sanitised failures, honest success ──── */

describe('postiz client', () => {
  const KEY = 'pk_test_do_not_leak';

  it('reads server config and rejects malformed values', () => {
    assert.equal(getPostizConfig({}), null);
    assert.equal(getPostizConfig({ POSTIZ_API_URL: 'https://s.vidnov.com' }), null);
    assert.equal(getPostizConfig({ POSTIZ_API_KEY: 'x' }), null);
    assert.equal(getPostizConfig({ POSTIZ_API_URL: 'ftp://nope', POSTIZ_API_KEY: 'x' }), null);
    assert.deepEqual(
      getPostizConfig({ POSTIZ_API_URL: 'https://social.vidnov.com/', POSTIZ_API_KEY: ' k1 ' }),
      { url: 'https://social.vidnov.com', key: 'k1' },
    );
  });

  it('classifies HTTP statuses into safe classes', () => {
    assert.equal(classifyHttpStatus(401), 'auth');
    assert.equal(classifyHttpStatus(403), 'auth');
    assert.equal(classifyHttpStatus(400), 'validation');
    assert.equal(classifyHttpStatus(404), 'validation');
    assert.equal(classifyHttpStatus(429), 'rate_limited');
    assert.equal(classifyHttpStatus(503), 'transient');
    assert.equal(classifyHttpStatus(418), 'unknown');
  });

  it('sends the key only in the Authorization header, as a draft with real provider types', async () => {
    let seen: { url: string; init: { method: string; headers: Record<string, string>; body?: string } } | null = null;
    const fetchImpl = async (url: string, init: never) => {
      seen = { url, init: init as unknown as { method: string; headers: Record<string, string>; body?: string } };
      return {
        ok: true,
        status: 200,
        json: async () => [{ postId: 'post-1', integration: 'int-1' }],
        text: async () => '',
      };
    };
    const config: PostizConfig = { url: 'https://social.vidnov.com', key: KEY };
    const res = await postizCreatePost(
      config,
      {
        type: 'draft',
        date: '2026-11-01T10:00:00.000Z',
        content: 'Hello\nhttps://vidnov.com/products/p1?ref=postiz',
        channels: [{ id: 'int-1', identifier: 'bluesky' }],
      },
      { fetchImpl: fetchImpl as never },
    );
    assert.equal(res.ok, true);
    assert.deepEqual(res.value, [{ postId: 'post-1' }]);

    assert.ok(seen);
    const seenCall = seen as { url: string; init: { method: string; headers: Record<string, string>; body?: string } };
    assert.equal(seenCall.url, 'https://social.vidnov.com/public/v1/posts');
    assert.equal(seenCall.init.method, 'POST');
    assert.equal(seenCall.init.headers.Authorization, KEY);
    assert.equal(
      Object.values(seenCall.init.headers).filter((v) => String(v).includes(KEY)).length,
      1,
      'key appears in exactly one header',
    );
    assert.ok(!seenCall.url.includes(KEY), 'key never in the URL');
    assert.ok(!(seenCall.init.body ?? '').includes(KEY), 'key never in the body');

    const body = JSON.parse(seenCall.init.body ?? '{}');
    assert.equal(body.type, 'draft');
    assert.equal(body.shortLink, false);
    assert.deepEqual(body.tags, []);
    assert.equal(body.posts[0].integration.id, 'int-1');
    assert.equal(body.posts[0].settings.__type, 'bluesky');
    assert.equal(body.posts[0].value[0].image.length, 0);
  });

  it('never echoes an upstream body — even a secret-shaped one', async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 500,
      json: async () => ({}) as Promise<unknown>,
      text: async () => 'upstream exploded: super-secret-token-12345',
    });
    const res = await postizCreatePost(
      { url: 'https://social.vidnov.com', key: KEY },
      {
        type: 'draft',
        date: '2026-11-01T10:00:00.000Z',
        content: 'x',
        channels: [{ id: 'i', identifier: 'bluesky' }],
      },
      { fetchImpl: fetchImpl as never },
    );
    assert.equal(res.ok, false);
    assert.equal(res.errorClass, 'transient');
    assert.ok(!JSON.stringify(res).includes('super-secret-token-12345'));
    assert.ok(!JSON.stringify(res).includes(KEY));
  });

  it('reports an unparsable success as a failure, not a fake post', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => [],
      text: async () => '',
    });
    const res = await postizCreatePost(
      { url: 'https://social.vidnov.com', key: KEY },
      {
        type: 'draft',
        date: '2026-11-01T10:00:00.000Z',
        content: 'x',
        channels: [{ id: 'i', identifier: 'x' }],
      },
      { fetchImpl: fetchImpl as never },
    );
    assert.equal(res.ok, false);
    assert.equal(res.errorClass, 'unknown');
  });

  it('network failure is transient and keeps no details', async () => {
    const fetchImpl = async () => {
      throw new Error('ECONNREFUSED 10.0.0.5:4007 leak');
    };
    const res = await postizListChannels(
      { url: 'https://social.vidnov.com', key: KEY },
      { fetchImpl: fetchImpl as never },
    );
    assert.equal(res.ok, false);
    assert.equal(res.errorClass, 'transient');
    assert.ok(!JSON.stringify(res).includes('10.0.0.5'));
  });

  it('parses integrations defensively and keeps the provider identifier', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => [
        { id: 'i1', name: 'Vidnov', identifier: 'bluesky', disabled: false },
        { id: 'i2', name: 'TG', identifier: 'telegram', disabled: true, profile: 'vidnov' },
        { junk: true },
        null,
        { id: 'i3' }, // no identifier → unusable, dropped
      ],
      text: async () => '',
    });
    const res = await postizListChannels(
      { url: 'https://social.vidnov.com', key: KEY },
      { fetchImpl: fetchImpl as never },
    );
    assert.equal(res.ok, true);
    assert.equal(res.value?.length, 2);
    assert.equal(res.value?.[0].identifier, 'bluesky');
    assert.equal(res.value?.[1].disabled, true);
    assert.equal(res.value?.[1].profile, 'vidnov');
  });
});

/* ── Rate limiting ───────────────────────────────────────────────────────── */

describe('publish rate limiting', () => {
  it('allows up to the limit inside the window and refuses the next', () => {
    const store = new Map<string, number[]>();
    const now = 1_000_000;
    for (let i = 0; i < PUBLISH_LIMIT.max; i++) {
      assert.equal(allowRequest('admin-1', store, PUBLISH_LIMIT, now), true, `hit ${i}`);
    }
    assert.equal(allowRequest('admin-1', store, PUBLISH_LIMIT, now), false);
    // Another admin is unaffected.
    assert.equal(allowRequest('admin-2', store, PUBLISH_LIMIT, now), true);
    // After the window the budget resets.
    assert.equal(allowRequest('admin-1', store, PUBLISH_LIMIT, now + PUBLISH_LIMIT.windowMs + 1), true);
  });

  it('counts only timestamps inside the window', () => {
    const times = [100, 200, 300, 400];
    assert.equal(countWithin(times, 500, 250), 2);
    assert.equal(countWithin(times, 500, 10_000), 4);
    assert.equal(countWithin(times, 500, 50), 0);
  });
});

/* ── Routes & bundle hygiene (source level) ──────────────────────────────── */

describe('routes and bundle keep their gates', () => {
  const publish = read('src/app/api/admin/postiz/publish/route.ts');
  const status = read('src/app/api/admin/postiz/status/route.ts');
  const page = read('src/app/dashboard/admin/system/postiz/page.tsx');
  const client = read('src/lib/postiz/client.ts');

  it('publish route verifies identity AND admin on both methods', () => {
    assert.ok(publish.includes('verifyUserContext'));
    assert.ok(publish.includes('user.isAdmin'));
    assert.equal(publish.split('!user || !user.isAdmin').length - 1, 2, 'GET preview + POST publish');
  });

  it('status route is admin-gated and returns no secrets', () => {
    assert.ok(status.includes('verifyUserContext') && status.includes('user.isAdmin'));
    assert.ok(!/POSTIZ_API_KEY\s*[:=]/.test(status), 'the key itself never appears');
  });

  it('publish route rate-limits before doing work', () => {
    const gate = publish.indexOf('allowRequest(');
    const upstream = publish.indexOf('postizCreatePost(');
    assert.ok(gate > 0 && upstream > gate, 'limiter runs before the outbound call');
  });

  it('provider types come from Postiz, never from the client body', () => {
    assert.ok(publish.includes('postizListChannels('), 'channels are resolved server-side');
    assert.ok(!publish.includes('__type:'), 'the route never hand-builds settings.__type');
    const clientIdx = client.indexOf('settings: { __type:');
    assert.ok(clientIdx > 0, 'the client derives settings from the validated channel row');
  });

  it('attribution survives into every campaign', () => {
    const content = read('src/lib/postiz/content.ts');
    assert.ok(content.includes("ref=postiz") || content.includes('CAMPAIGN_REF'));
    assert.ok(content.includes('CAMPAIGN_REF = \'postiz\''));
  });

  it('the browser never gets POSTIZ env access or the server client', () => {
    for (const file of [
      'src/app/dashboard/admin/system/postiz/page.tsx',
      'src/lib/postiz/content.ts',
    ]) {
      const src = read(file);
      assert.ok(!src.includes('process.env'), `${file} must not touch env vars`);
      assert.ok(!src.includes('NEXT_PUBLIC_POSTIZ'), `${file} must not define a public Postiz key`);
    }
    assert.ok(client.includes('server-only module imported in the browser'), 'client guards itself');
    assert.ok(page.includes("'use client'"), 'the admin page is a client component');
    assert.ok(!page.includes('POSTIZ_API_KEY='), 'page never carries a key assignment');
  });

  it('both firestore.rules files are identical and name the new collection', () => {
    const a = read('firestore.rules');
    const b = read('src/firestore.rules');
    assert.equal(a, b, 'rules copies must stay byte-identical');
    assert.ok(a.includes('postizLog'), 'postizLog is documented as admin-SDK-only');
    assert.ok(a.includes('emailWebhookEvents'), 'email reliability note preserved');
  });
});
