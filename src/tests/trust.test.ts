/**
 * TRUST — reviews and verification, asserted where they are cheap to assert.
 *
 * The bugs these guard against are not crashes. They are a marketplace that
 * quietly loses trust: a rating that counts a removed review, a seller who can
 * approve themselves, a "Documents submitted" tick that behaves like a tick.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const {
  averageRating, reviewerSide, isReviewableStatus, validateReviewInput,
  isValidRating, REVIEW_TEXT_MAX, REVIEWABLE_ORDER_STATUSES,
} = require('../lib/reviews.ts');

const {
  verificationMeta, allowedSellerTransition, isVerificationStatus, publicVerification,
} = require('../lib/verification.ts');

/* ------------------------------------------------------------- reviews */

test('only a finished order can be reviewed', () => {
  assert.equal(isReviewableStatus('delivered'), true);
  // Paid and shipped are NOT enough: a buyer who paid and never got the thing
  // has every right to say so.
  assert.equal(isReviewableStatus('paid'), false);
  assert.equal(isReviewableStatus('shipped'), false);
  assert.equal(isReviewableStatus('processing'), false);
  assert.equal(isReviewableStatus(null), false);
  assert.equal(isReviewableStatus(undefined), false);
});

test('the reviewable set only names statuses that can actually occur', () => {
  const orderStatuses = [
    'pending', 'paid', 'processing', 'packed', 'shipped',
    'delivery', 'delivered', 'cancelled', 'disputed', 'refunded',
  ];
  /*
   * 'completed' is deliberately NOT in the Order union — but documents written
   * before the union was tightened may still carry it, and Firestore types are
   * compile-time only, so it can exist in the database today.
   *
   * Dropping it from the reviewable set would make those historical orders
   * permanently unreviewable, which is worse than accepting a status the type
   * no longer names. So it is allowed, and this test says so out loud rather
   * than quietly pretending it is part of the type.
   */
  const LEGACY = ['completed'];
  for (const s of REVIEWABLE_ORDER_STATUSES) {
    assert.ok(
      orderStatuses.includes(s) || LEGACY.includes(s),
      `'${s}' is neither a current Order status nor a documented legacy one`,
    );
  }
  assert.ok(LEGACY.includes('completed'), 'the legacy allowance must stay documented');
});

test('ratings are 1-5 integers and nothing else', () => {
  for (const r of [1, 2, 3, 4, 5]) assert.equal(isValidRating(r), true);
  for (const r of [0, 6, 2.5, -1, '5', null, undefined, NaN]) assert.equal(isValidRating(r), false);
});

test('a review must have real words and a length', () => {
  assert.equal(validateReviewInput('great work', 5), null);
  assert.ok(validateReviewInput('', 5), 'empty text must be refused');
  assert.ok(validateReviewInput('a', 5), 'one character must be refused');
  assert.ok(validateReviewInput('x'.repeat(REVIEW_TEXT_MAX + 1), 5), 'over-long must be refused');
  assert.ok(validateReviewInput('good', 9), 'an invalid rating must be refused');
});

test('only the two parties to an order can review it', () => {
  assert.equal(reviewerSide('buyer-1', 'buyer-1', 'seller-1'), 'customer');
  assert.equal(reviewerSide('seller-1', 'buyer-1', 'seller-1'), 'seller');
  // A bystander must be null — that null is what hides the review form.
  assert.equal(reviewerSide('someone-else', 'buyer-1', 'seller-1'), null);
  assert.equal(reviewerSide(null, 'buyer-1', 'seller-1'), null);
});

test('a removed or flagged review does not move the average', () => {
  const all = [{ rating: 5 }, { rating: 1 }];
  assert.deepEqual(averageRating(all), { average: 3, count: 2 });
  // Otherwise mass-reporting a review would be a way to change a score.
  assert.deepEqual(averageRating([{ rating: 5 }, { rating: 1, status: 'removed' }]), { average: 5, count: 1 });
  assert.deepEqual(averageRating([{ rating: 5 }, { rating: 1, status: 'flagged' }]), { average: 5, count: 1 });
  assert.deepEqual(averageRating([]), { average: 0, count: 0 });
});

/* -------------------------------------------------------- verification */

test('an absent status reads as unverified, never as approved', () => {
  assert.equal(verificationMeta(undefined).label, 'Unverified');
  assert.equal(verificationMeta(null).label, 'Unverified');
  assert.equal(verificationMeta('nonsense').label, 'Unverified');
  assert.equal(verificationMeta(undefined).tone, 'neutral');
});

test('documents-submitted must not look like an approval', () => {
  const pending = verificationMeta('pending');
  assert.equal(pending.label, 'Documents submitted');
  // The whole value of the badge dies if this reads as a tick.
  assert.notEqual(pending.tone, 'good');
  assert.ok(pending.detail.toLowerCase().includes('waiting'));
});

test('only the approved state is a good tone', () => {
  assert.equal(verificationMeta('verified').tone, 'good');
  assert.equal(verificationMeta('verified').label, 'Verified business');
  assert.equal(verificationMeta('rejected').tone, 'bad');
});

test('a seller can submit but can never approve themselves', () => {
  assert.equal(allowedSellerTransition('unverified', 'pending'), true);
  assert.equal(allowedSellerTransition('rejected', 'pending'), true, 'a rejection must be retryable');
  // These are the whole point. `verified` is admin-only, server-side.
  assert.equal(allowedSellerTransition('pending', 'verified'), false);
  assert.equal(allowedSellerTransition('unverified', 'verified'), false);
  assert.equal(allowedSellerTransition('rejected', 'verified'), false);
  assert.equal(allowedSellerTransition('unverified', 'rejected'), false);
});

test('a seller cannot revoke their own approval', () => {
  assert.equal(allowedSellerTransition('verified', 'pending'), false);
  assert.equal(allowedSellerTransition('verified', 'unverified'), false);
  assert.equal(allowedSellerTransition('verified', 'verified'), false, 'no-op is not a transition');
});

test('the public view never leaks a state the badge does not know', () => {
  assert.deepEqual(publicVerification(undefined), {
    status: 'unverified',
    label: 'Unverified',
    detail: verificationMeta(undefined).detail,
  });
  assert.equal(isVerificationStatus('pending'), true);
  assert.equal(isVerificationStatus('submitted'), false, 'the old invented value must not be accepted');
});
