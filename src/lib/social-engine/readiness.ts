/**
 * SOCIAL ENGINE — readiness state machine (pure).
 *
 * Env vars existing is NEVER enough: CONFIGURED only says "credentials are
 * present, unverified". Promotion to CONNECTED / TESTED / READY requires a
 * recorded successful test of the matching kind, and READY specifically
 * requires a publish-level test (or the module's intended service, see
 * `ModuleSpec.readyBy`).
 *
 * Precedence (first match wins):
 *
 *   1. NOT_CONFIGURED     — a required env var is absent.
 *   2. CONFIGURED         — account explicitly disconnected (history kept,
 *                           but the module must not look connected).
 *   3. ERROR              — the most recent recorded test failed.
 *   4. APPROVAL_REQUIRED  — provider approval still missing.
 *   5. READY              — publish-level test succeeded.
 *   6. TESTED             — safe diagnostic succeeded.
 *   7. CONNECTED          — auth succeeded, or an OAuth account is linked.
 *   8. CONFIGURED         — credentials present, unverified.
 */
import type {
  ApprovalInfo,
  ConnectionInfo,
  ReadinessState,
  ReadyBy,
  TestKind,
  TestRecord,
  TokenState,
} from './types';

export interface ReadinessInput {
  /** Which recorded test proves this module's intended service (spec.readyBy). */
  readyBy: ReadyBy;
  missingRequiredEnv: string[];
  connection: ConnectionInfo;
  approval: ApprovalInfo;
  /** Recorded tests by kind — strongest wins when successful. */
  tests: Partial<Record<TestKind, TestRecord>>;
  /**
   * Expiry of the stored access token. An EXPIRED token means publishing is
   * not possible right now, no matter how old the last successful test is —
   * showing READY there would be a lie the next scheduled post would discover.
   */
  tokenState?: TokenState;
}

export interface ReadinessResult {
  state: ReadinessState;
  /** The single next step for the administrator. */
  nextStep: string;
}

function mostRecentFailure(tests: Partial<Record<TestKind, TestRecord>>): TestRecord | null {
  let worst: TestRecord | null = null;
  for (const rec of Object.values(tests)) {
    if (rec && !rec.ok && (!worst || rec.at > worst.at)) worst = rec;
  }
  return worst;
}

function latestAt(tests: Partial<Record<TestKind, TestRecord>>): string {
  let at = '';
  for (const rec of Object.values(tests)) if (rec && rec.at > at) at = rec.at;
  return at;
}

/** True when a successful record of `kind` exists and is the newest event. */
function succeeded(tests: Partial<Record<TestKind, TestRecord>>, kind: TestKind): boolean {
  const rec = tests[kind];
  if (!rec || !rec.ok) return false;
  const newest = latestAt(tests);
  // A later failure of any kind outranks an older success.
  const failure = mostRecentFailure(tests);
  if (failure && failure.at > rec.at) return false;
  return rec.at === newest || !failure;
}

/**
 * Computes the readiness state + next step. Pure: same inputs, same output.
 * Every string returned is built from static text and env var NAMES only.
 */
export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const { missingRequiredEnv, connection, approval, tests } = input;

  if (missingRequiredEnv.length > 0) {
    return {
      state: 'NOT_CONFIGURED',
      nextStep: `Set: ${missingRequiredEnv.join(', ')} (names only — values go in the server environment).`,
    };
  }

  if (connection.connected === false && connection.disconnectedAt) {
    return {
      state: 'CONFIGURED',
      nextStep: 'Account was disconnected — reconnect to resume (disconnect stops future publishing).',
    };
  }

  const failure = mostRecentFailure(tests);
  if (failure) {
    return {
      state: 'ERROR',
      nextStep: `Investigate the last failure (${failure.kind} test at ${failure.at}): ${failure.note}`,
    };
  }

  if (input.tokenState === 'expired') {
    return {
      state: 'ERROR',
      nextStep:
        'The stored access token has expired — reconnect the account, then run Test and a publish test again.',
    };
  }

  if (approval.required && !approval.granted) {
    return {
      state: 'APPROVAL_REQUIRED',
      nextStep: approval.note || 'Provider approval/permission is missing.',
    };
  }

  // READY is proven by the module's OWN strongest test (spec.readyBy):
  // publishing platforms need a confirmed publish; infrastructure modules
  // are proven by their diagnostic. Env presence never reaches this branch.
  if (input.readyBy === 'publish' && succeeded(tests, 'publish')) {
    return { state: 'READY', nextStep: 'Live — scheduled publishing may use this module.' };
  }
  if (input.readyBy === 'diagnostic' && succeeded(tests, 'diagnostic')) {
    return { state: 'READY', nextStep: 'Live — the service verified end to end.' };
  }

  if (succeeded(tests, 'diagnostic')) {
    return {
      state: 'TESTED',
      nextStep: 'Run a publish test (neutral message to the configured destination) to reach READY.',
    };
  }

  if (connection.connected || succeeded(tests, 'auth')) {
    return {
      state: 'CONNECTED',
      nextStep: 'Run the safe diagnostic (Test) to verify permissions and destination.',
    };
  }

  return {
    state: 'CONFIGURED',
    nextStep:
      connection.connected === false
        ? 'Credentials present. Connect an account (OAuth) or run Test for server-level credentials.'
        : 'Credentials present, unverified. Run Test to verify authentication.',
  };
}

/** Rank for ordering a dashboard: errors first, then approvals, … */
export const STATE_RANK: Record<ReadinessState, number> = {
  ERROR: 0,
  APPROVAL_REQUIRED: 1,
  NOT_CONFIGURED: 2,
  CONFIGURED: 3,
  CONNECTED: 4,
  TESTED: 5,
  READY: 6,
};
