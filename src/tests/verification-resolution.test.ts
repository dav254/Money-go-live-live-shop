/**
 * WHICH VERIFICATION THE BADGE SHOWS.
 *
 * This pins the rule that closes a silently broken loop: the admin queue
 * approves the ACCOUNT's status, the badge used to read the BUSINESS's, and
 * nobody noticed because an approval that never appears is not an error — it is
 * the absence of a tick, which looks exactly like "not verified yet".
 *
 * The cases that matter are the ones where the two DISAGREE. When they agree,
 * almost any implementation is right.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveEffectiveVerification, verificationMeta } from '../lib/verification';

describe('resolveEffectiveVerification', () => {
  it('reads the account when the business has nothing — the loop closer', () => {
    const r = resolveEffectiveVerification(undefined, 'verified');
    assert.equal(r.status, 'verified');
    assert.equal(r.source, 'account');
  });

  it('shows an account approval as Documents submitted, not a tick', () => {
    const r = resolveEffectiveVerification(null, 'pending');
    assert.equal(r.status, 'pending');
    assert.equal(verificationMeta(r.status).tone, 'pending',
      'a submitted badge must not read as approved');
  });

  it('prefers the business when it holds a real decision', () => {
    const r = resolveEffectiveVerification('verified', 'rejected');
    assert.equal(r.status, 'verified');
    assert.equal(r.source, 'business');
  });

  it('lets a business REJECTED override a verified account', () => {
    // `rejected` can only have been written by an admin who looked, so it is a
    // real decision and it wins.
    const r = resolveEffectiveVerification('rejected', 'verified');
    assert.equal(r.status, 'rejected');
    assert.equal(r.source, 'business');
  });

  it('lets a business PENDING override a stale account approval', () => {
    const r = resolveEffectiveVerification('pending', 'verified');
    assert.equal(r.status, 'pending');
    assert.equal(r.source, 'business');
  });

  it('does NOT treat a business `unverified` as a decision', () => {
    // This is the one that is easy to get backwards. Nothing in the product
    // ever DECIDES a business is unverified — a backfill writes that value as a
    // placeholder for "nobody has looked yet". Reading it as a decision throws
    // away an admin approval that really happened, and the seller waits forever
    // for a tick that the system already granted them.
    const r = resolveEffectiveVerification('unverified', 'verified');
    assert.equal(r.status, 'verified');
    assert.equal(r.source, 'account');
  });

  it('honours a business `unverified` when the account has nothing either', () => {
    const r = resolveEffectiveVerification('unverified', undefined);
    assert.equal(r.status, 'unverified');
    assert.equal(r.source, 'none');
  });

  it('reports nothing when neither side says anything', () => {
    const r = resolveEffectiveVerification(undefined, undefined);
    assert.equal(r.status, 'unverified');
    assert.equal(r.source, 'none');
  });

  it('does not invent a status from a value it does not recognise', () => {
    // A profile written by some older code path with a value we do not model
    // must degrade to unverified, never to something that reads as a tick.
    for (const bogus of ['submitted', 'approved', '', 1, true, {}]) {
      const r = resolveEffectiveVerification(bogus, bogus);
      assert.equal(r.status, 'unverified', `${JSON.stringify(bogus)} leaked through`);
      assert.equal(r.source, 'none');
    }
  });

  it('never returns a status that renders as approved from account data alone', () => {
    // Only an admin may produce 'verified'. A business field claiming it
    // without an admin having touched it is honoured (an admin writes it when
    // migrating), but a nonsense account value must not.
    const r = resolveEffectiveVerification(undefined, 'VERIFIED');
    assert.notEqual(r.status, 'verified');
  });

  it('is safe to call with both sides missing', () => {
    assert.doesNotThrow(() => resolveEffectiveVerification(undefined, undefined));
    assert.doesNotThrow(() => resolveEffectiveVerification(null, null));
  });
});
