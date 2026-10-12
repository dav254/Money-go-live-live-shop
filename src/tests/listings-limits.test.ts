/**
 * LISTING RULES — the numbers a seller is actually held to.
 *
 * These are pure functions with no dependencies on Firestore, so they can be
 * asserted exactly. That matters because the duration and the item counts are
 * promises the UI makes in copy; if a refactor quietly changes the constant,
 * the copy starts lying and nobody notices until a seller is rejected.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const {
  MAX_VIDEO_SECONDS,
  SELLER_MEDIA_QUOTA_FREE,
  MAX_IMAGES_PER_LISTING,
  MAX_VIDEOS_PER_LISTING,
  MIN_IMAGES_PER_LISTING,
  SERVICE_CATEGORIES,
  PRICE_MODES,
  BONUS_TIERS,
  bonusForListing,
  mediaItemCount,
  quotaSummary,
  serviceCategoryLabel,
  priceModeLabel,
} = require('../lib/listings/limits.ts');

test('video is not rationed to a token limit', () => {
  /*
   * CHANGED deliberately. This used to assert 120 (two minutes), back when a
   * short video was framed as a guard-rail. Video is the thing this marketplace
   * SELLS, so rationing it penalises exactly the sellers we want.
   *
   * What is asserted now is the intent: generous enough that no ordinary seller
   * hits it, small enough that ffmpeg on one small VPS stays reliable. If the
   * ceiling is ever dropped back to something a real seller would notice, this
   * fails.
   */
  assert.ok(
    MAX_VIDEO_SECONDS >= 600,
    `${MAX_VIDEO_SECONDS}s is tight enough that ordinary sellers will hit it`,
  );
});

test('a seller gets 80 media items free', () => {
  assert.equal(SELLER_MEDIA_QUOTA_FREE, 80);
});

test('per-listing media caps follow the product rules', () => {
  // CHANGED deliberately with the product rules: a listing carries up to
  // EIGHT photos (the buyer's evidence — the more angles the better) and ONE
  // hero video, and cannot publish without at least one photo. If a refactor
  // silently raises the video cap or drops the photo minimum, the copy in the
  // upload form starts lying and a seller gets rejected by rules they cannot
  // see — which is exactly what this file exists to prevent.
  assert.ok(MAX_IMAGES_PER_LISTING >= 8, 'too few photos per listing');
  assert.equal(MAX_VIDEOS_PER_LISTING, 1, 'a listing carries exactly one hero video');
  assert.equal(MIN_IMAGES_PER_LISTING, 1, 'a listing needs at least one photo');
  assert.ok(MIN_IMAGES_PER_LISTING <= MAX_IMAGES_PER_LISTING, 'the photo window must be reachable');
});

test('service categories end with an open door', () => {
  // Being unable to trade because the platform has not heard of a job is the
  // failure this whole feature exists to remove.
  const last = SERVICE_CATEGORIES[SERVICE_CATEGORIES.length - 1];
  assert.equal(last.key, 'other');
  assert.ok(SERVICE_CATEGORIES.length >= 10);
});

test('every service has a price mode, and one of them is a quote', () => {
  const found = PRICE_MODES.some((m: { key: string }) => m.key === 'quote');
  assert.ok(found);
  const hasHourly = PRICE_MODES.some((m: { key: string }) => m.key === 'hourly');
  assert.ok(hasHourly);
  const hasFixed = PRICE_MODES.some((m: { key: string }) => m.key === 'fixed');
  assert.ok(hasFixed);
});

test('unknown categories and price modes fall back instead of rendering blank', () => {
  assert.equal(serviceCategoryLabel('plumbing'), 'Plumbing');
  assert.equal(serviceCategoryLabel('blacksmithing'), 'Services');
  assert.equal(priceModeLabel('quote'), 'Get a quote');
  assert.equal(priceModeLabel(undefined), 'Fixed price');
});

test('bonus tiers ascend in both views and likes', () => {
  for (let i = 1; i < BONUS_TIERS.length; i++) {
    assert.ok(BONUS_TIERS[i].views > BONUS_TIERS[i - 1].views, `views must rise at tier ${i}`);
    assert.ok(BONUS_TIERS[i].likes > BONUS_TIERS[i - 1].likes, `likes must rise at tier ${i}`);
    assert.ok(BONUS_TIERS[i].points > BONUS_TIERS[i - 1].points, `points must rise at tier ${i}`);
  }
});

test('no bonus below the first tier', () => {
  const { points, tier } = bonusForListing(99, 4);
  assert.equal(points, 0);
  assert.equal(tier, null);
});

test('reaching a tier pays exactly that tier, once', () => {
  const { points } = bonusForListing(100, 5);
  assert.equal(points, 50);
  // Lifetime totals, not a rolling window: more views do not re-pay the tier.
  const later = bonusForListing(5000, 300);
  assert.ok(later.points > points);
  assert.equal(bonusForListing(5000, 300).points, later.points);
});

test('views alone do not qualify — likes are required too', () => {
  const { points } = bonusForListing(1_000_000, 0);
  assert.equal(points, 0, 'a listing with no likes must pay nothing');
});

test('the top tier is the ceiling', () => {
  const { points, nextTier } = bonusForListing(10_000_000, 1_000_000);
  assert.equal(nextTier, null);
  const total = BONUS_TIERS.reduce((s: number, t: { points: number }) => s + t.points, 0);
  assert.equal(points, total);
});

test('nonsense totals do not crash or pay', () => {
  assert.equal(bonusForListing(-5, -5).points, 0);
  assert.equal(bonusForListing(Number.NaN, Number.NaN).points, 0);
});

test('media is counted once, not twice', () => {
  // `videoUrl` is the legacy mirror of `videoUrls[0]`; counting both would
  // charge the seller twice for one clip and make the quota mean nothing.
  assert.equal(mediaItemCount({ imageUrls: ['a', 'b'], videoUrls: ['v'], videoUrl: 'v' }), 3);
  assert.equal(mediaItemCount({ imageUrls: ['a', 'b'], videoUrls: ['v'], videoUrl: 'v' }),
    mediaItemCount({ imageUrls: ['a', 'b'], videoUrls: ['v'] }));
  assert.equal(mediaItemCount({ videoUrl: 'legacy-only' }), 1);
  assert.equal(mediaItemCount({}), 0);
  assert.equal(mediaItemCount(null), 0);
});

test('the quota line never shows a negative remainder', () => {
  assert.match(quotaSummary(48), /48 of 80/);
  assert.match(quotaSummary(200), /0 left/);
});
