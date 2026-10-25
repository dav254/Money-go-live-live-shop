/**
 * AI points → VPS migration (Section 1): the charge must be decided by the
 * VPS PocketBase store whenever it knows the balance, must never deduct from
 * both stores for one operation, and must never invent a balance it cannot
 * read. Run: npx tsx --test src/tests/ai-points-vps.test.ts
 *
 * The planner is a pure module (no firebase / pocketbase imports), so these
 * tests run without a live database; the source assertions keep the gateway
 * actually wired to the planner and to the VPS store.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const { planAiPointsCharge } = require(join(ROOT, 'src', 'lib', 'ai', 'points-plan.ts')) as {
  planAiPointsCharge: (i: {
    pbEnabled: boolean;
    vpsBalance: number | null;
    cost: number;
  }) => { action: string; store?: string };
};

describe('planAiPointsCharge — VPS-first charge decisions', () => {
  it('charges the VPS store when PocketBase knows a sufficient balance', () => {
    const plan = planAiPointsCharge({ pbEnabled: true, vpsBalance: 500, cost: 100 });
    assert.deepEqual(plan, { action: 'charge', store: 'vps' });
  });

  it('reports insufficient WITHOUT charging Firestore when the VPS balance is too low', () => {
    const plan = planAiPointsCharge({ pbEnabled: true, vpsBalance: 40, cost: 100 });
    assert.deepEqual(plan, { action: 'insufficient' });
    assert.notEqual(plan.store, 'firestore', 'must never fall through to a second store');
  });

  it('falls back to Firestore when the VPS has no balance row (never treats it as 0)', () => {
    const plan = planAiPointsCharge({ pbEnabled: true, vpsBalance: null, cost: 100 });
    assert.deepEqual(plan, { action: 'charge', store: 'firestore' });
  });

  it('uses Firestore when PocketBase is not configured', () => {
    const plan = planAiPointsCharge({ pbEnabled: false, vpsBalance: 500, cost: 100 });
    assert.deepEqual(plan, { action: 'charge', store: 'firestore' });
  });

  it('charges nothing for a free (zero-cost) operation', () => {
    const plan = planAiPointsCharge({ pbEnabled: true, vpsBalance: 0, cost: 0 });
    assert.deepEqual(plan, { action: 'charge', store: 'skip' });
  });

  it('refuses an unparseable cost instead of charging 0', () => {
    for (const cost of [Number.NaN, Number.POSITIVE_INFINITY, -5, undefined as unknown as number]) {
      const plan = planAiPointsCharge({ pbEnabled: false, vpsBalance: null, cost });
      assert.equal(plan.action, 'unreadable', `cost ${cost} must not become a charge`);
    }
  });

  it('exactly-one-store invariant: every plan names at most one store', () => {
    const combos: Array<{ pbEnabled: boolean; vpsBalance: number | null; cost: number }> = [];
    for (const pbEnabled of [true, false]) {
      for (const vpsBalance of [null, 0, 50, 500]) {
        for (const cost of [0, 50, 100]) combos.push({ pbEnabled, vpsBalance, cost });
      }
    }
    for (const input of combos) {
      const plan = planAiPointsCharge(input);
      if (plan.action === 'charge') {
        assert.ok(
          ['vps', 'firestore', 'skip'].includes(plan.store ?? ''),
          `plan must name exactly one store, got ${JSON.stringify(plan)}`,
        );
      } else {
        assert.equal(plan.store, undefined, 'non-charge plans must not name a store');
      }
    }
  });
});

describe('gateway wiring (source-level guards)', () => {
  const gateway = readFileSync(join(ROOT, 'src', 'lib', 'ai', 'gateway.ts'), 'utf8');

  it('gateway charges through the planner + VPS store, not a bare Firestore transaction', () => {
    assert.match(gateway, /planAiPointsCharge\(/);
    assert.match(gateway, /pbAdjustAiPoints\(uid, -cost\)/);
    assert.match(gateway, /chargeAiPoints\(params\.userId, entry\.points\)/);
  });

  it('failure and cancellation refunds go through refundAiPoints (VPS + Firestore)', () => {
    assert.match(gateway, /await refundAiPoints\(ctx\.userId, ctx\.creditsUsed\)/);
    assert.match(gateway, /await refundAiPoints\(userId, job\.creditsUsed\)/);
    // The old direct Firestore-only refund calls must be gone.
    assert.doesNotMatch(gateway, /\.doc\(ctx\.userId\)\s*\n?\s*\.update\(\{ aiPoints: FieldValue\.increment\(ctx\.creditsUsed\)/);
  });

  it('a balance read failure surfaces as STORE_UNREACHABLE, not as "not enough points"', () => {
    assert.match(gateway, /'STORE_UNREACHABLE'/);
    const generate = readFileSync(join(ROOT, 'src', 'app', 'api', 'ai', 'generate', 'route.ts'), 'utf8');
    assert.match(generate, /STORE_UNREACHABLE'[\s\S]{0,40}\?\s*503/);
  });

  it('go-live keeps its VPS-first charge (regression guard)', () => {
    const live = readFileSync(join(ROOT, 'src', 'app', 'api', 'live-session', 'route.ts'), 'utf8');
    assert.match(live, /pbAdjustAiPoints\(sellerId, -GO_LIVE_COST\)/);
  });
});