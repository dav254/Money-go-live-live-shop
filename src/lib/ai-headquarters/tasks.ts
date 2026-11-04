/**
 * ORBIT — the worker run ledger (`ai_hq_tasks`).
 *
 * Paperclip assigns work; Hermes executes it. This ledger is the third thing,
 * and the one Vidnov needs: a record that a specific machine identity actually
 * executed a specific task, what came back, under which permission, with which
 * model (or with none), and whether the record survived a restart.
 *
 * Three rules shape the implementation:
 *
 *  1. **Append-only and idempotent.** A run is keyed by `(taskKey, attempt)`.
 *     Inside one attempt the row may progress (`running` → `completed`), but a
 *     terminal state is final: a worker that crashes and retries a finished
 *     attempt gets the stored row back with `duplicate: true` instead of a
 *     second result. Resuming after a failure is a new attempt, so history is
 *     appended, never overwritten.
 *  2. **Own rows only.** An agent may report and read its own runs. There is
 *     no parameter for "whose run" — the identity comes from the credential.
 *  3. **Honest accounting.** `mock` is recorded, not inferred, and the console
 *     shows it next to every run. Token and cost figures are `null`/`undefined`
 *     unless the worker measured them; nothing is estimated.
 */
import type { Firestore, Query } from 'firebase-admin/firestore';
import { requireScope } from './agents';
import { writeAudit } from './audit';
import {
  HQ_LIMITS,
  isTaskStatus,
  type AgentRecord,
  type TaskRunRecord,
  type TaskStatus,
  type TaskSummary,
} from './types';

export const TASKS_COLLECTION = 'ai_hq_tasks';
const META_COLLECTION = 'ai_hq_meta';

export class TaskError extends Error {
  constructor(
    readonly code: 'invalid_input' | 'conflict' | 'rate_limited' | 'not_found',
    message: string,
  ) {
    super(message);
    this.name = 'TaskError';
  }
}

const SECRETISH_KEY = /(token|secret|password|passwd|api[_-]?key|credential|private[_-]?key)/i;
/** Task keys come from Paperclip; keep them to a safe, indexable charset. */
const TASK_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,39}$/;

function cleanText(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Rejects nested secret-looking keys — a result is not a credential store. */
function assertNoSecrets(value: unknown, depth = 0): void {
  if (depth > 4 || value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) assertNoSecrets(item, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SECRETISH_KEY.test(key)) {
        throw new TaskError('invalid_input', `Task results may not contain "${key}".`);
      }
      assertNoSecrets(item, depth + 1);
    }
  }
}

function nonNegativeInt(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.min(Math.round(n), 100_000_000);
}

function nonNegativeNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.min(n, 1_000_000);
}

function isoOrUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return undefined;
  return new Date(t).toISOString();
}

/** Firestore document ids cannot contain `/` and dislike odd characters. */
function runDocId(taskKey: string, attempt: number): string {
  return `${taskKey.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100)}__${attempt}`;
}

function normalizeModel(value: unknown): TaskRunRecord['model'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const provider = cleanText(raw.provider, 40);
  const name = cleanText(raw.name, 40);
  if (!provider || !name) return undefined;
  if (!MODEL_ID.test(provider) || !MODEL_ID.test(name)) {
    throw new TaskError('invalid_input', 'Model provider and name must be plain identifiers.');
  }
  const tokensIn = nonNegativeInt(raw.tokensIn);
  const tokensOut = nonNegativeInt(raw.tokensOut);
  const costUsd = nonNegativeNumber(raw.costUsd);
  return {
    provider,
    name,
    ...(tokensIn !== undefined ? { tokensIn } : {}),
    ...(tokensOut !== undefined ? { tokensOut } : {}),
    ...(costUsd !== undefined ? { costUsd } : {}),
  };
}

/**
 * Daily cap on reported runs. A worker in a crash loop must not fill the
 * ledger; the cap is generous (400/day) and only ever refuses NEW attempts —
 * a retry of an existing `(taskKey, attempt)` is served from the row itself.
 */
async function reserveRunSlot(db: Firestore, agentId: string, now: Date): Promise<void> {
  const ref = db.collection(META_COLLECTION).doc(`${agentId}__task`);
  const dayKey = now.toISOString().slice(0, 10);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = (snap.exists ? snap.data() : {}) as { dayKey?: string; count?: number };
    const count = data.dayKey === dayKey && typeof data.count === 'number' ? data.count : 0;
    if (count >= HQ_LIMITS.taskRunsPerAgentPerDay) {
      throw new TaskError(
        'rate_limited',
        `Daily task-run limit (${HQ_LIMITS.taskRunsPerAgentPerDay}) reached for this agent.`,
      );
    }
    tx.set(ref, { dayKey, count: count + 1 }, { merge: true });
  });
}

export interface ReportTaskInput {
  taskKey: unknown;
  attempt?: unknown;
  title: unknown;
  status: unknown;
  summary?: unknown;
  result?: unknown;
  error?: unknown;
  startedAt?: unknown;
  endedAt?: unknown;
  durationMs?: unknown;
  model?: unknown;
  mock?: unknown;
  now?: Date;
}

export interface ReportTaskResult {
  run: TaskRunRecord;
  /** True when this exact (taskKey, attempt) was already recorded. */
  duplicate: boolean;
}

/**
 * Records one run. Requires `tasks:report`, and always writes for the
 * authenticated agent — the caller cannot name another agent.
 */
export async function reportTaskRun(
  db: Firestore,
  agent: AgentRecord,
  input: ReportTaskInput,
): Promise<ReportTaskResult> {
  requireScope(agent, 'tasks:report');

  const taskKey = cleanText(input.taskKey, 120);
  if (!TASK_KEY.test(taskKey)) {
    throw new TaskError('invalid_input', 'A taskKey is required (letters, digits, . : _ -).');
  }

  const attemptRaw = nonNegativeInt(input.attempt ?? 1);
  const attempt = attemptRaw && attemptRaw >= 1 ? Math.min(attemptRaw, 1_000) : 1;

  const ref = db.collection(TASKS_COLLECTION).doc(runDocId(taskKey, attempt));
  const existing = await ref.get();
  const previous = existing.exists ? (existing.data() as TaskRunRecord) : null;

  // A finished attempt is final. A retry of it is answered from the row, so a
  // post-restart replay can never rewrite a result that was already reported.
  if (previous && isTerminal(previous.status)) {
    return { run: previous, duplicate: true };
  }

  if (!isTaskStatus(input.status)) {
    throw new TaskError('invalid_input', 'Unknown task status.');
  }
  const status: TaskStatus = input.status;

  const title = cleanText(input.title, HQ_LIMITS.titleMax);
  if (title.length < 3) throw new TaskError('invalid_input', 'A task run needs a short title.');

  const summary = cleanText(input.summary, HQ_LIMITS.summaryMax);

  let result: Record<string, unknown> | undefined;
  if (input.result && typeof input.result === 'object' && !Array.isArray(input.result)) {
    const candidate = input.result as Record<string, unknown>;
    assertNoSecrets(candidate);
    if (JSON.stringify(candidate).length > HQ_LIMITS.resultBytesMax) {
      throw new TaskError('invalid_input', 'That result is too large — return a summary and ids.');
    }
    result = candidate;
  } else if (input.result !== undefined && input.result !== null) {
    throw new TaskError('invalid_input', 'A task result must be an object.');
  }

  let error: TaskRunRecord['error'];
  if (input.error && typeof input.error === 'object' && !Array.isArray(input.error)) {
    const raw = input.error as Record<string, unknown>;
    const code = cleanText(raw.code, 60) || 'error';
    const message = cleanText(raw.message, 500);
    if (!message) throw new TaskError('invalid_input', 'A task error needs a message.');
    error = { code, message };
  }
  if (status === 'failed' && !error) {
    throw new TaskError('invalid_input', 'A failed run must include an error code and message.');
  }

  const now = input.now ?? new Date();
  const createdAt = previous?.createdAt ?? now.toISOString();
  const startedAt = isoOrUndefined(input.startedAt) ?? previous?.startedAt ?? now.toISOString();
  const endedAt = isoOrUndefined(input.endedAt);
  const measured =
    endedAt && Date.parse(endedAt) >= Date.parse(startedAt)
      ? Date.parse(endedAt) - Date.parse(startedAt)
      : undefined;
  const durationMs = measured ?? nonNegativeInt(input.durationMs);

  // Only a NEW attempt consumes the daily slot; progressing one does not.
  if (!previous) await reserveRunSlot(db, agent.id, now);

  const model = normalizeModel(input.model) ?? previous?.model;
  // Progressing one attempt must not erase what it already produced; only a
  // terminal state ends it.
  const keptSummary = summary || previous?.summary || '';
  const keptResult = result ?? previous?.result;
  const keptError = error ?? (status === 'delayed' ? previous?.error : undefined);

  const record: TaskRunRecord = {
    id: ref.id,
    taskKey,
    attempt,
    agentId: agent.id,
    agentName: agent.name,
    department: agent.department,
    title,
    status,
    ...(keptSummary ? { summary: keptSummary } : {}),
    ...(keptResult ? { result: keptResult } : {}),
    ...(keptError ? { error: keptError } : {}),
    startedAt,
    ...(endedAt && status !== 'running' ? { endedAt } : {}),
    ...(durationMs !== undefined && status !== 'running' ? { durationMs } : {}),
    ...(model ? { model } : {}),
    // Declared, not inferred. A run with no model is never presented as AI.
    mock: input.mock === undefined ? (previous?.mock ?? true) : input.mock === true,
    createdAt,
  };

  await ref.set(record);

  await writeAudit(db, {
    action: 'task_reported',
    actor: `agent:${agent.id}`,
    agentId: agent.id,
    taskKey,
    outcome: status === 'failed' ? 'failed' : 'ok',
    note: `${status}${record.mock ? ' (mock)' : ''} attempt ${attempt}: ${title}`,
  });

  return { run: record, duplicate: false };
}

const TERMINAL: ReadonlySet<TaskStatus> = new Set<TaskStatus>([
  'completed',
  'failed',
  'cancelled',
]);

function isTerminal(status: TaskStatus | undefined): boolean {
  return Boolean(status && TERMINAL.has(status));
}

/** This agent's own runs, newest first. */
export async function listTaskRuns(
  db: Firestore,
  params: { agentId: string; limit?: number },
): Promise<TaskRunRecord[]> {
  const limit = Math.min(
    HQ_LIMITS.taskListLimit,
    Math.max(1, params.limit ?? HQ_LIMITS.taskListLimit),
  );
  const query: Query = db
    .collection(TASKS_COLLECTION)
    .where('agentId', '==', params.agentId)
    .limit(limit);
  const snap = await query.get();
  return snap.docs
    .map((doc) => doc.data() as TaskRunRecord)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Founder view: every run, newest first. */
export async function listAllTaskRuns(db: Firestore, limit = 20): Promise<TaskRunRecord[]> {
  const snap = await db
    .collection(TASKS_COLLECTION)
    .limit(Math.min(HQ_LIMITS.taskListLimit, Math.max(1, limit)))
    .get();
  return snap.docs
    .map((doc) => doc.data() as TaskRunRecord)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Status counts plus measured usage. Token and cost totals are `null` when no
 * run reported them — never zero, because zero would claim "no cost measured
 * and none incurred".
 */
export function summarizeRuns(runs: TaskRunRecord[]): TaskSummary {
  const summary: TaskSummary = {
    total: runs.length,
    running: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    cancelled: 0,
    mockRuns: 0,
    tokensIn: null,
    tokensOut: null,
    costUsd: null,
  };

  let sawTokensIn = false;
  let sawTokensOut = false;
  let sawCost = false;

  for (const run of runs) {
    switch (run.status) {
      case 'running':
        summary.running += 1;
        break;
      case 'completed':
        summary.completed += 1;
        break;
      case 'failed':
        summary.failed += 1;
        break;
      case 'delayed':
        summary.delayed += 1;
        break;
      case 'cancelled':
        summary.cancelled += 1;
        break;
    }
    if (run.mock) summary.mockRuns += 1;

    if (typeof run.model?.tokensIn === 'number') {
      summary.tokensIn = (summary.tokensIn ?? 0) + run.model.tokensIn;
      sawTokensIn = true;
    }
    if (typeof run.model?.tokensOut === 'number') {
      summary.tokensOut = (summary.tokensOut ?? 0) + run.model.tokensOut;
      sawTokensOut = true;
    }
    if (typeof run.model?.costUsd === 'number') {
      summary.costUsd = (summary.costUsd ?? 0) + run.model.costUsd;
      sawCost = true;
    }
  }

  if (!sawTokensIn) summary.tokensIn = null;
  if (!sawTokensOut) summary.tokensOut = null;
  if (!sawCost) summary.costUsd = null;
  if (summary.costUsd !== null) summary.costUsd = Math.round(summary.costUsd * 1e6) / 1e6;

  return summary;
}

/** Re-exported so the console API can map errors without importing AgentError. */
export function isTaskError(error: unknown): error is TaskError {
  return error instanceof TaskError;
}
