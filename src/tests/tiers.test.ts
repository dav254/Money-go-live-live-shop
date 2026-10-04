/**
 * ACCOUNT TIERS.
 *
 * These tests pin the numbers that end up on a badge a buyer reads before
 * handing over money, plus the two rules that stop the badge being cheap:
 * a sale means DELIVERED, and a tier only ever goes up.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNT_TIERS,
  BONUS_OPTIONS,
  COUNTED_ORDER_STATUSES,
  TIER_THRESHOLDS,
  activeBenefits,
  benefitsFor,
  highestTier,
  isKnownBonus,
  isTierEligible,
  tierForCompletedTransactions,
  tierMeta,
  tierProgress,
  upcomingBenefits,
  type AccountTier,
} from '../lib/tiers';

const reached = (n: number): AccountTier => tierForCompletedTransactions(n);

describe('tier thresholds', () => {
  it('has no badge below one completed transaction', () => {
    assert.equal(reached(0), 'none');
    assert.equal(reached(-5), 'none');
  });

  it('reaches Bronze on the first real sale', () => {
    assert.equal(reached(1), 'bronze');
  });

  it('reaches Silver at 5 — the user asked for 20 as the headline, not as the first rung', () => {
    assert.equal(reached(4), 'bronze');
    assert.equal(reached(5), 'silver');
  });

  it('reaches Gold at exactly 20', () => {
    assert.equal(reached(19), 'silver');
    assert.equal(reached(20), 'gold');
    assert.equal(reached(21), 'gold');
  });

  it('reaches Premium at 50 and has no ceiling', () => {
    assert.equal(reached(49), 'gold');
    assert.equal(reached(50), 'premium');
    assert.equal(reached(5000), 'premium');
  });

  it('never rounds a count UP into a tier', () => {
    // A float arriving from an aggregate must not carry a seller over a
    // threshold they have not reached: 4.9 is not 5, and 19.99 is not 20.
    assert.equal(reached(4.9), 'bronze');
    assert.equal(reached(5), 'silver');
    assert.equal(reached(19.99), 'silver');
    assert.equal(reached(20), 'gold');
    assert.equal(reached(49.99), 'gold');
    assert.equal(reached(50), 'premium');
  });

  it('degrades nonsense counts to no tier rather than throwing', () => {
    for (const bad of [NaN, Infinity, -Infinity, undefined as unknown as number]) {
      assert.equal(tierForCompletedTransactions(bad), 'none');
    }
  });

  it('orders its thresholds so the ladder can never skip a rung', () => {
    const mins = TIER_THRESHOLDS.map((t) => t.min);
    assert.deepEqual([...mins].sort((a, b) => a - b), mins);
    assert.equal(new Set(TIER_THRESHOLDS.map((t) => t.tier)).size, TIER_THRESHOLDS.length);
  });

  it('lists tiers in ascending order', () => {
    assert.deepEqual(ACCOUNT_TIERS, ['none', 'bronze', 'silver', 'gold', 'premium']);
  });
});

describe('a sale is a delivered order and nothing else', () => {
  it('counts only delivered', () => {
    // Live data: 106 orders, of which 86 were still pending. Counting those
    // would have put a Gold badge on sellers for orders nobody paid for.
    assert.deepEqual([...COUNTED_ORDER_STATUSES], ['delivered']);
  });

  it('does not count pending, processing, shipped, cancelled, disputed or refunded', () => {
    const notSales = ['pending', 'paid', 'processing', 'packed', 'shipped', 'delivery', 'cancelled', 'disputed', 'refunded'];
    for (const status of notSales) {
      assert.equal(
        COUNTED_ORDER_STATUSES.includes(status as 'delivered'),
        false,
        `${status} must not count as a sale`,
      );
    }
  });
});

describe('automatic eligibility', () => {
  it('is a pure function of a count, so no admin is ever in the loop', () => {
    // The rule that makes the feature "automatic": 20 delivered orders gives
    // Gold, every time, with nothing for a person to press. If anything could
    // withhold the badge, the seller would be waiting on a person rather than on
    // their own transactions.
    assert.equal(reached(20), 'gold');
    assert.equal(reached(20), tierForCompletedTransactions(20));
  });

  it('keeps a stored badge only while the counts still justify it', () => {
    // Stored first, earned second: "is what this account shows still true?"
    assert.equal(isTierEligible('gold', 'gold'), true, 'a genuine Gold badge stands');
    assert.equal(isTierEligible('bronze', 'gold'), true, 'having gone past a badge keeps it');
    assert.equal(isTierEligible('gold', 'bronze'), false, 'a Gold badge with no Gold behind it is revoked');
  });

  it('refuses to show a badge for a value it does not recognise', () => {
    assert.equal(isTierEligible('diamond' as AccountTier, 'gold'), false);
    assert.equal(isTierEligible('gold', 'platinum' as AccountTier), false);
  });

  it('is monotonic — a higher tier is never re-granted downward', () => {
    let previous: AccountTier = 'none';
    for (let n = 0; n <= 60; n++) {
      const t = reached(n);
      assert.ok(
        ACCOUNT_TIERS.indexOf(t) >= ACCOUNT_TIERS.indexOf(previous),
        `tier went backwards at ${n}: ${previous} → ${t}`,
      );
      previous = t;
    }
  });
});

describe('tierProgress', () => {
  it('counts what is left rather than rounding a percentage to nothing', () => {
    const p = tierProgress(49);
    assert.equal(p.tier, 'gold');
    assert.equal(p.toNext, 1);
    assert.equal(p.next, 'premium');
  });

  it('measures progress inside the rung, not from zero', () => {
    // 5 sales is the bottom of Silver, so a Silver seller is 0% towards Gold —
    // not 10%, which is what a from-zero calculation would claim.
    assert.equal(tierProgress(5).progress, 0);
    assert.equal(tierProgress(20).progress, 0);
    const mid = tierProgress(12); // halfway 5 → 20
    assert.ok(mid.progress > 0.45 && mid.progress < 0.55, `got ${mid.progress}`);
  });

  it('reports the top tier as complete rather than never finishing', () => {
    const p = tierProgress(200);
    assert.equal(p.tier, 'premium');
    assert.equal(p.toNext, 0);
    assert.equal(p.next, undefined);
    assert.equal(p.progress, 1);
  });

  it('never shows negative progress or a negative number remaining', () => {
    for (const n of [0, 1, 4, 5, 19, 20, 49, 50]) {
      const p = tierProgress(n);
      assert.ok(p.toNext >= 0, `toNext negative at ${n}`);
      assert.ok(p.progress >= 0 && p.progress <= 1, `progress out of range at ${n}`);
    }
  });
});

describe('highestTier', () => {
  it('takes the best of several, because a person is both buyer and seller', () => {
    assert.equal(highestTier('silver', 'gold'), 'gold');
    assert.equal(highestTier('gold', 'silver'), 'gold');
  });

  it('survives missing sides', () => {
    assert.equal(highestTier(undefined, null, 'bronze'), 'bronze');
    assert.equal(highestTier(undefined, null), 'none');
    assert.equal(highestTier(), 'none');
  });

  it('ignores a value it does not recognise', () => {
    assert.equal(highestTier('diamond' as AccountTier, 'gold'), 'gold');
  });
});

describe('benefits', () => {
  it('grows with the tier and never shrinks', () => {
    let previous = 0;
    for (const tier of ['bronze', 'silver', 'gold', 'premium'] as const) {
      const count = benefitsFor(tier).length;
      assert.ok(count >= previous, `${tier} has fewer benefits than the tier below`);
      previous = count;
    }
  });

  it('gives nothing to an account with no tier', () => {
    assert.deepEqual(benefitsFor('none'), []);
  });

  it("never discounts a seller's own pricing", () => {
    // A badge that told buyers "this person cannot set their own price" would
    // be the opposite of a trust signal.
    const all = Object.values(benefitsFor('premium')).map((b) => b.label.toLowerCase());
    for (const label of all) {
      assert.ok(!/discount|%\s*off|price cut/.test(label), `benefit looks like a price cut: ${label}`);
    }
  });

  it('has unique benefit keys within a tier', () => {
    for (const tier of ['bronze', 'silver', 'gold', 'premium'] as const) {
      const keys = benefitsFor(tier).map((b) => b.key);
      assert.equal(new Set(keys).size, keys.length, `${tier} has a duplicate benefit key`);
    }
  });
});

describe('delivered vs declared benefits', () => {
  it('splits a tier into what is live and what is coming', () => {
    // The split exists so the UI cannot present a reduced platform fee as
    // something the seller already has — there is no fee engine yet.
    for (const tier of ['bronze', 'silver', 'gold', 'premium'] as const) {
      const active = activeBenefits(tier);
      const upcoming = upcomingBenefits(tier);
      assert.equal(active.length + upcoming.length, benefitsFor(tier).length, `${tier} lost a benefit`);
      for (const b of active) assert.equal(b.enforced, true, `${b.key} listed as active but not enforced`);
      for (const b of upcoming) assert.equal(b.enforced, false, `${b.key} listed as coming but enforced`);
    }
  });

  it('always has at least the badge itself as a live benefit', () => {
    for (const tier of ['bronze', 'silver', 'gold', 'premium'] as const) {
      const keys = activeBenefits(tier).map((b) => b.key);
      assert.ok(keys.includes(`badge-${tier}`), `${tier} has no live badge benefit`);
    }
  });

  it('marks every fee and credit perk as not yet enforced', () => {
    // If a fee engine ever ships, this test is what makes you come back and
    // decide, rather than silently changing what the badge claims.
    for (const tier of ['silver', 'gold', 'premium'] as const) {
      const declared = benefitsFor(tier).filter((b) => /fee|credit|featured|support|matching/i.test(b.label));
      for (const b of declared) {
        assert.equal(b.enforced, false, `${b.key} claims to be live with no engine behind it`);
      }
    }
  });

  it('has nothing to show for an account with no tier', () => {
    assert.deepEqual(activeBenefits('none'), []);
    assert.deepEqual(upcomingBenefits('none'), []);
  });
});

describe('admin bonuses', () => {
  it('offers only known, named bonuses', () => {
    // Free text here produces "vip" and "good boy", which tell the recipient
    // nothing and an auditor nothing at all.
    for (const b of BONUS_OPTIONS) {
      assert.ok(b.key.length > 0);
      assert.ok(b.label.length > 0);
      assert.ok(b.detail.length > 0);
      assert.equal(isKnownBonus(b.key), true);
    }
    assert.equal(isKnownBonus('vip'), false);
    assert.equal(isKnownBonus(''), false);
  });

  it('cannot grant a tier', () => {
    // There is no entry here that sets a rank, and no field on BonusOption that
    // could carry one. An admin adds value to an account; the rank comes from
    // the delivered order count.
    for (const b of BONUS_OPTIONS) {
      assert.equal((b as unknown as Record<string, unknown>).tier, undefined);
      assert.ok(!/tier|badge|rank/i.test(b.label), `bonus sounds like a rank: ${b.label}`);
    }
  });

  it('has unique keys', () => {
    const keys = BONUS_OPTIONS.map((b) => b.key);
    assert.equal(new Set(keys).size, keys.length);
  });
});

describe('tierMeta', () => {
  it('falls back to New for anything it does not recognise', () => {
    // A corrupted stored value must not blank the badge.
    assert.equal(tierMeta('diamond').label, 'New');
    assert.equal(tierMeta(undefined).label, 'New');
  });

  it('gives every tier a label and a detail', () => {
    for (const tier of ACCOUNT_TIERS) {
      const m = tierMeta(tier);
      assert.ok(m.label.length > 0, `${tier} has no label`);
      assert.ok(m.detail.length > 0, `${tier} has no detail`);
    }
  });
});
