/**
 * PRODUCT GROWTH CENTRE — rules and reuse contracts.
 *
 * Two kinds of test here:
 *
 *   1. The promotion arithmetic and gates are pure, so they are tested
 *      directly: points cost, duration bounds, selection caps, caption limits,
 *      and the order in which a free destination is refused.
 *
 *   2. The reuse claims are structural, so they are checked by reading the
 *      source. The whole point of this feature is that it is an orchestrator
 *      over the existing engine — if it ever grew its own queue, channel
 *      registry or charge path, these tests would fail before a reviewer had
 *      to notice.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  CAPTION_MAX,
  MAX_CHANNELS_PER_CAMPAIGN,
  MAX_PAID_DAYS,
  MAX_PRODUCTS_PER_CAMPAIGN,
  MIN_PAID_DAYS,
  POINTS_PER_DAY,
  canAfford,
  defaultCaption,
  destinationGroup,
  freeSubmitBlock,
  normaliseCaption,
  normaliseDurationDays,
  normaliseSelection,
  paidBlockReason,
  promotionCostPoints,
  skipReasonText,
} from '../lib/seller-growth/promotion';

const ROOT = process.cwd();
const ROUTE = path.join(ROOT, 'src/app/api/seller/product-growth/route.ts');
const PAGE = path.join(ROOT, 'src/app/dashboard/seller/product-growth/page.tsx');
const ADMIN_PAGE = path.join(ROOT, 'src/app/dashboard/admin/system/distribution/page.tsx');
const MOBILE_SCREEN = path.join(ROOT, 'mobile/app/seller/growth.tsx');

test('paid boosts are priced per day and bounded', () => {
  assert.equal(promotionCostPoints(1), POINTS_PER_DAY);
  assert.equal(promotionCostPoints(7), POINTS_PER_DAY * 7);

  // Out-of-range values clamp rather than producing a free or huge boost.
  assert.equal(promotionCostPoints(0), POINTS_PER_DAY);
  assert.equal(promotionCostPoints(999), POINTS_PER_DAY * MAX_PAID_DAYS);

  // Rounding never produces a fractional charge.
  assert.equal(Number.isInteger(promotionCostPoints(2.4)), true);
});

test('a duration must be a whole number of days inside the allowed range', () => {
  assert.equal(normaliseDurationDays(3), 3);
  assert.equal(normaliseDurationDays('7'), 7);
  assert.equal(normaliseDurationDays(0), null);
  assert.equal(normaliseDurationDays(MIN_PAID_DAYS - 1), null);
  assert.equal(normaliseDurationDays(MAX_PAID_DAYS + 1), null);
  assert.equal(normaliseDurationDays('abc'), null);
  assert.equal(normaliseDurationDays(undefined), null);
});

test('a campaign selection is deduped, trimmed and capped', () => {
  assert.deepEqual(normaliseSelection(['a', 'a', ' b ', '', null, 4], 10), ['a', 'b']);
  assert.equal(normaliseSelection(Array.from({ length: 50 }, (_, i) => `p${i}`), MAX_PRODUCTS_PER_CAMPAIGN).length, MAX_PRODUCTS_PER_CAMPAIGN);
  assert.equal(normaliseSelection(['x', 'y', 'z'], MAX_CHANNELS_PER_CAMPAIGN).length, 3);
});

test('captions are trimmed, collapsed and capped', () => {
  assert.equal(normaliseCaption('  hello   world  '), 'hello world');
  assert.equal(normaliseCaption('', 'fallback'), 'fallback');
  assert.equal(normaliseCaption('x'.repeat(400)).length, CAPTION_MAX);

  const caption = defaultCaption({ name: 'Leather bag', price: 2500, currency: 'kes' });
  assert.match(caption, /Leather bag/);
  assert.match(caption, /KES 2,500/);
  assert.equal(defaultCaption({ name: 'Quote item' }), 'Quote item');
});

test('the free gate refuses in the order that matters', () => {
  // A destination that takes no jobs can never be queued, even if configured.
  assert.equal(freeSubmitBlock({ jobEligible: false, configured: true, productEligible: true }), 'not_job_eligible');
  // An ineligible listing is refused before credentials are even considered.
  assert.equal(freeSubmitBlock({ jobEligible: true, configured: true, productEligible: false }), 'not_eligible');
  // A configured listing with no credentials is skipped, never queued at `ready`.
  assert.equal(freeSubmitBlock({ jobEligible: true, configured: false, productEligible: true }), 'not_configured');
  assert.equal(freeSubmitBlock({ jobEligible: true, configured: true, productEligible: true }), null);

  // Every refusal has seller-readable words, and none of them promise indexing.
  for (const reason of ['not_configured', 'not_job_eligible', 'not_owned', 'not_eligible', 'create_failed'] as const) {
    const text = skipReasonText(reason);
    assert.ok(text.length > 10);
    assert.ok(!/indexed|guaranteed/i.test(text));
  }
});

test('the balance gate tolerates a missing stored balance', () => {
  assert.equal(canAfford(500, 300), true);
  assert.equal(canAfford(200, 300), false);
  assert.equal(canAfford(undefined, 100), false);
  assert.equal(canAfford('700', 700), true);

  assert.match(
    String(paidBlockReason({ balance: 0, cost: 300, eligible: true, hasImage: true })),
    /need 300 points/i,
  );
  assert.equal(paidBlockReason({ balance: 5000, cost: 300, eligible: true, hasImage: true }), null);
  assert.ok(paidBlockReason({ balance: 5000, cost: 300, eligible: false, hasImage: true }));
});

test('destinations group into the three seller-facing surfaces', () => {
  assert.equal(destinationGroup('sitemap'), 'vidnov');
  assert.equal(destinationGroup('indexnow'), 'search');
  assert.equal(destinationGroup('bing'), 'search');
  assert.equal(destinationGroup('search_console'), 'search');
  assert.equal(destinationGroup('google'), 'commerce');
  assert.equal(destinationGroup('meta'), 'commerce');
  assert.equal(destinationGroup('tiktok'), 'commerce');
});

test('the growth centre is an orchestrator over the existing engine', () => {
  assert.ok(existsSync(ROUTE), 'the seller growth API must exist');
  assert.ok(existsSync(PAGE), 'the seller growth page must exist');
  assert.ok(existsSync(MOBILE_SCREEN), 'the Android growth screen must exist');
  assert.ok(existsSync(ADMIN_PAGE), 'the admin distribution control centre must still exist');

  const route = readFileSync(ROUTE, 'utf8');

  // Reuses the Core Engine rather than creating a second queue.
  assert.match(route, /createDistributionJob/);
  assert.match(route, /getJobDestinations/);
  assert.match(route, /DISTRIBUTION_JOBS_COLLECTION/);

  // Paid promotion reuses the existing points field and boost collection.
  assert.match(route, /aiPoints/);
  assert.match(route, /boost_requests/);
  assert.match(route, /runTransaction/);

  // It does not open its own collections or a second publishing path.
  assert.ok(!/collection\('growth_campaigns'\)/.test(route));
  assert.ok(!/new Firestore/.test(route));

  // It never returns a credential.
  assert.ok(!/access_token|refresh_token|CLIENT_SECRET/.test(route));
});

test('the Android seller section links to the growth centre', () => {
  const nav = readFileSync(path.join(ROOT, 'mobile/src/components/seller/nav.ts'), 'utf8');
  assert.match(nav, /\/seller\/growth/);
  assert.ok(existsSync(path.join(ROOT, 'mobile/app/seller/growth.tsx')));

  const api = readFileSync(path.join(ROOT, 'mobile/src/lib/api.ts'), 'utf8');
  assert.match(api, /\/api\/seller\/product-growth/);
});
