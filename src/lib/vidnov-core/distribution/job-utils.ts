/**
 * DISTRIBUTION HUB — pure job helpers (no Firestore, no I/O).
 *
 * Kept separate from service.ts so the rules that matter — deterministic job
 * ids, error sanitisation, classification, retry limits — are unit-testable
 * without a database or credentials.
 */

import { createHash } from 'crypto';
import type { ChannelId, ErrorClass, JobStatus, SafeJobError } from '../types';
import { canTransition, MAX_JOB_ATTEMPTS, RETRYABLE_ERROR_CLASSES } from '../types';
import { PAYLOAD_VERSION } from './channels';

export const DISTRIBUTION_JOBS_COLLECTION = 'distributionJobs';

/**
 * Deterministic job document id.
 *
 * • No key given ⇒ derived from (productId, channel, payloadVersion): a
 *   double-clicked "prepare" resolves to the SAME document — never two jobs.
 * • Explicit `idempotencyKey` ⇒ derived from the key alone, so a retried
 *   submission reuses its record.
 */
export function distributionJobId(input: {
  productId: string;
  channel: ChannelId;
  payloadVersion?: string;
  idempotencyKey?: string;
}): string {
  const base = input.idempotencyKey
    ? `idem:${input.idempotencyKey}`
    : `auto:${input.productId}:${input.channel}:${input.payloadVersion ?? PAYLOAD_VERSION}`;
  return `dj_${createHash('sha256').update(base).digest('hex').slice(0, 40)}`;
}

/** Patterns that must never survive into a stored/logged error message. */
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]'],
  // Covers `?key=`, `?apikey=`, `?api_key=`, `&token=`, `?access_token=`…
  [/([?&](?:api[_-]?key|key|token|secret|password|signature|access_token|assertion)=)[^&\s]+/gi, '$1[redacted]'],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[email]'],
];

/**
 * Short, single-line, credential-free error message (≤200 chars).
 * Raw upstream response bodies are never passed in by callers — only
 * `Error.message`, which this still scrubs.
 */
export function sanitizeErrorMessage(raw: unknown): string {
  const base = raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : 'Unexpected error.';
  let out = base.replace(/\s+/g, ' ').trim();
  for (const [pattern, replacement] of SECRET_PATTERNS) out = out.replace(pattern, replacement);
  return out.slice(0, 200) || 'Unexpected error.';
}

/** Maps an unknown failure onto the safe, bounded error taxonomy. */
export function classifyError(err: unknown): ErrorClass {
  const msg = (err instanceof Error ? err.message : typeof err === 'string' ? err : '').toLowerCase();
  if (!msg) return 'unknown';
  if (/(rate ?limit|too many|quota|429)/.test(msg)) return 'rate_limited';
  if (/(unauthor|forbidden|401|403|credential|api key)/.test(msg)) return 'auth';
  if (/(invalid|must be|missing field|422|400|validation)/.test(msg)) return 'validation';
  if (/(timeout|timed out|econnreset|econnrefused|unavailable|502|503|504|network)/.test(msg)) return 'transient';
  if (/(not[_ ]configured|missing credentials|credentials are not)/.test(msg)) return 'not_configured';
  return 'unknown';
}

/** Builds the stored error record — message already scrubbed and bounded. */
export function safeJobError(err: unknown, attempt: number): SafeJobError {
  return {
    class: classifyError(err),
    message: sanitizeErrorMessage(err),
    attempt,
    at: new Date().toISOString(),
  };
}

/** Status transition guard used by every writer (also asserted in tests). */
export function nextStatus(from: JobStatus, to: JobStatus): JobStatus | null {
  return canTransition(from, to) ? to : null;
}

/**
 * States only a REAL, connected integration may ever set.
 *
 * No API route may move a job into one of these: `processing` and `submitted`
 * describe work an adapter actually performed, and `live` is a claim about
 * the outside world. A future submit path calls the service directly after a
 * real upstream response — this guard is what keeps a client (or an admin
 * UI) from asserting success it cannot prove.
 */
export const ADAPTER_ONLY_STATES: readonly JobStatus[] = ['processing', 'submitted', 'live'];

export type TransitionRefusal = 'reserved' | 'invalid_transition' | 'not_configured' | 'retry_not_allowed';

export interface TransitionDecision {
  allowed: boolean;
  refusal?: TransitionRefusal;
  /** Short, static, credential-free message — safe to return to a caller. */
  message?: string;
}

/** Static refusal copy. Never built from upstream or user input. */
export const REFUSAL_MESSAGES: Record<TransitionRefusal, string> = {
  reserved: 'Only a connected channel integration can report this state.',
  invalid_transition: 'Job state change is not allowed.',
  not_configured: 'This channel is not configured yet.',
  retry_not_allowed: 'This job must be retried through the retry action.',
};

/**
 * Pure policy for one requested status change (routes are thin wrappers).
 *
 * Checked in order:
 *   1. same state ⇒ idempotent re-assert, always allowed;
 *   2. adapter-only targets ⇒ refused, no exceptions (honesty invariant);
 *   3. the shared state machine (`canTransition`);
 *   4. `failed → queued` is a RETRY and may only come from the retry action,
 *      which enforces `canRetry` (retryable class + attempt cap);
 *   5. the channel must actually be able to reach the state — an
 *      unconfigured channel can never leave
 *      `not_configured | ready | failed | needs_attention`.
 */
export function evaluateTransition(input: {
  from: JobStatus;
  to: JobStatus;
  /** `ChannelDefinition.reachableStates` for the job's channel. */
  reachable: readonly JobStatus[];
  /** True only when the caller is the retry action (step 4 bypass). */
  allowRetry?: boolean;
}): TransitionDecision {
  const { from, to, reachable, allowRetry } = input;
  if (from === to) return { allowed: true };
  if (ADAPTER_ONLY_STATES.includes(to)) {
    return { allowed: false, refusal: 'reserved', message: REFUSAL_MESSAGES.reserved };
  }
  if (!canTransition(from, to)) {
    return { allowed: false, refusal: 'invalid_transition', message: REFUSAL_MESSAGES.invalid_transition };
  }
  if (from === 'failed' && to === 'queued' && !allowRetry) {
    return { allowed: false, refusal: 'retry_not_allowed', message: REFUSAL_MESSAGES.retry_not_allowed };
  }
  if (!reachable.includes(to)) {
    return { allowed: false, refusal: 'not_configured', message: REFUSAL_MESSAGES.not_configured };
  }
  return { allowed: true };
}

/**
 * Automatic retry is allowed only when:
 *   • attempts are below MAX_JOB_ATTEMPTS, and
 *   • the last failure was a retryable class (rate limit / transient) or the
 *     job never actually failed.
 * Auth/validation/not-configured failures need a human or a config change —
 * retrying them would just burn attempts.
 */
export function canRetry(job: { status: JobStatus; attempts: number; lastError?: SafeJobError | null }): boolean {
  if (job.attempts >= MAX_JOB_ATTEMPTS) return false;
  if (job.status !== 'failed') return false;
  if (!job.lastError) return true;
  return RETRYABLE_ERROR_CLASSES.includes(job.lastError.class);
}
