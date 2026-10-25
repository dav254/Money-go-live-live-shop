/**
 * AI POINTS — charge planning (pure, store-free).
 *
 * The balance source of truth is `userProfiles/{uid}.aiPoints` in Firestore,
 * mirrored to the VPS PocketBase store (`user_profiles.aiPoints`) by the
 * Firestore → self-hosting migration. When PocketBase is configured and knows
 * the balance, the VPS store decides — going live / generating must depend on
 * this machine, not on Firestore being reachable (Firebase being blocked used
 * to fail the charge and cancel the job).
 *
 * This module deliberately imports NEITHER firebase NOR pocketbase: it only
 * decides which store should take a charge, so the rules are unit-testable
 * without a live database (src/tests/ai-points-vps.test.ts).
 */

export type ChargePlan =
  /** Charge this store. `skip` = free (cost 0): nothing to move anywhere. */
  | { action: 'charge'; store: 'vps' | 'firestore' | 'skip' }
  /** The authoritative balance is lower than the cost. Charge NOTHING. */
  | { action: 'insufficient' }
  /** Balance could not be read anywhere. Charge NOTHING — fail visibly. */
  | { action: 'unreadable' };

export interface ChargePlanInput {
  /** PocketBase configured on this server. */
  pbEnabled: boolean;
  /**
   * Balance known to the VPS store: a number when `user_profiles.aiPoints`
   * exists, null when there is no VPS row or it never recorded a balance —
   * null must fall back to Firestore, never be treated as 0 (0 would lock
   * real balances out of going live).
   */
  vpsBalance: number | null;
  /** Points the operation costs. */
  cost: number;
}

export function planAiPointsCharge(input: ChargePlanInput): ChargePlan {
  const { pbEnabled, vpsBalance, cost } = input;

  if (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0) {
    // A cost we cannot parse must never become a charge of 0.
    return { action: 'unreadable' };
  }
  if (cost === 0) return { action: 'charge', store: 'skip' };

  if (pbEnabled && vpsBalance !== null && Number.isFinite(vpsBalance)) {
    // VPS is authoritative: it decides sufficiency AND takes the charge, so
    // one operation can never deduct from two stores.
    if (vpsBalance < cost) return { action: 'insufficient' };
    return { action: 'charge', store: 'vps' };
  }

  // No usable VPS balance → legacy Firestore transaction (the only store
  // that can answer). The result is then mirrored back to the VPS best-effort.
  return { action: 'charge', store: 'firestore' };
}