/**
 * SOCIAL ENGINE — readiness aggregator (server-only).
 *
 * Reads the three durable documents that make a module's state honest:
 *
 *   social_engine_tests/{module}__platform — one TestRecord per TestKind
 *       (auth / diagnostic / publish), overwriting the previous record of
 *       that kind (idempotent re-test, no duplicate documents).
 *   social_engine_meta/{module}__{uid}    — approval attestation (an admin
 *       marks the provider approval as obtained) and the rate-limit stamp.
 *   social_engine_audit                   — append-only trail for every
 *       state-changing action (diagnostic / publish_test / connect /
 *       disconnect / status_view / handoff / approval).
 *
 * These collections are written ONLY through the Firebase Admin SDK and are
 * deliberately absent from `firestore.rules`, so the default-deny at the end
 * of the rules file keeps every browser out of them. No token, env value or
 * upstream error body is ever written to any of them: notes are produced by
 * diagnostics/publishing (static text, status codes, account labels) and
 * sanitized once more here.
 *
 * READY is never inferred from configuration: `computeReadiness()` promotes a
 * module only after a recorded publish-level (or diagnostic) test succeeded.
 */
import { db } from '@/firebase/server';
import { sanitizeErrorMessage } from '@/lib/vidnov-core/distribution/job-utils';
import {
  MODULE_IDS,
  type ApprovalInfo,
  type AuditEntry,
  type AttributionEvent,
  type ConnectionInfo,
  type EnvVarStatus,
  type ModuleId,
  type ModuleReadiness,
  type TestKind,
  type TestRecord,
} from './types';
import { MODULE_SPECS } from './modules';
import { STATE_RANK, computeReadiness } from './readiness';
import { connectionId, disconnectConnection, getConnection, toConnectionInfo } from './connections';
import { runDiagnostics, testRecordFromStep, type DiagnosticStep } from './diagnostics';
import { publishTest } from './publishing';

export const TESTS_COLLECTION = 'social_engine_tests';
export const META_COLLECTION = 'social_engine_meta';
export const AUDIT_COLLECTION = 'social_engine_audit';

/** One document: the latest record of each TestKind (overwrites same-kind). */
export interface ModuleTestDoc {
  auth?: TestRecord;
  diagnostic?: TestRecord;
  publish?: TestRecord;
  /** A handoff prepared but never published — kept separately from publish. */
  handoffAt?: string;
  handoffNote?: string;
  updatedAt: string;
}

export interface EngineCaller {
  uid: string;
  isAdmin: boolean;
}

export interface ReadinessContext {
  /** The real `process.env` — only presence is ever inspected. */
  env: Record<string, string | undefined>;
  caller: EngineCaller;
}

const TEST_KINDS: TestKind[] = ['auth', 'diagnostic', 'publish'];

function nowIso(): string {
  return new Date().toISOString();
}

function platformDocId(module: ModuleId): string {
  // `connectionId` is the single id builder in this feature (and sanitizes
  // the owner segment). 'platform' marks engine-wide test records.
  return connectionId(module, 'platform');
}

/** Coerces one stored value into a TestRecord, dropping anything unexpected. */
function asTestRecord(value: unknown): TestRecord | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.kind !== 'string' || !(TEST_KINDS as string[]).includes(raw.kind)) return undefined;
  if (typeof raw.at !== 'string' || typeof raw.note !== 'string') return undefined;
  const record: TestRecord = {
    kind: raw.kind as TestKind,
    ok: raw.ok === true,
    at: raw.at,
    note: raw.note,
  };
  if (typeof raw.remoteId === 'string') record.remoteId = raw.remoteId;
  if (typeof raw.accountLabel === 'string') record.accountLabel = raw.accountLabel;
  if (Array.isArray(raw.scopes)) record.scopes = raw.scopes.filter((s): s is string => typeof s === 'string');
  const permissions = raw.permissions as { granted?: unknown; note?: unknown } | undefined;
  if (permissions && typeof permissions.note === 'string') {
    record.permissions = { granted: permissions.granted === true, note: permissions.note };
  }
  return record;
}

/**
 * Reads the module's real test document.
 *
 * This used to be a stub that returned `{}` — readiness could therefore never
 * leave CONFIGURED no matter how many successful tests were recorded. It now
 * performs the actual Firestore read (a missing document is simply "no tests
 * recorded yet").
 */
export async function readTestDoc(module: ModuleId): Promise<ModuleTestDoc> {
  try {
    const snap = await db.collection(TESTS_COLLECTION).doc(platformDocId(module)).get();
    if (!snap.exists) return { updatedAt: '' };
    const data = (snap.data() ?? {}) as Record<string, unknown>;
    const doc: ModuleTestDoc = { updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '' };
    for (const kind of TEST_KINDS) {
      const record = asTestRecord(data[kind]);
      if (record) doc[kind] = record;
    }
    if (typeof data.handoffAt === 'string') doc.handoffAt = data.handoffAt;
    if (typeof data.handoffNote === 'string') doc.handoffNote = data.handoffNote;
    return doc;
  } catch {
    // A read failure must not fabricate a state — the caller sees "no tests",
    // which keeps the module below READY rather than claiming readiness.
    return { updatedAt: '' };
  }
}

/** Records one test outcome, overwriting the previous record of that kind. */
export async function recordTest(module: ModuleId, kind: TestKind, record: TestRecord): Promise<void> {
  if (!(TEST_KINDS as string[]).includes(kind)) return;
  const safe: TestRecord = {
    kind,
    ok: record.ok === true,
    at: record.at || nowIso(),
    note: sanitizeErrorMessage(record.note),
  };
  // remoteId only when the provider confirmed success (publishing.ts already
  // enforces this; the guard here keeps the store honest regardless).
  if (safe.ok && record.remoteId) safe.remoteId = record.remoteId;
  if (record.accountLabel) safe.accountLabel = record.accountLabel;
  if (record.scopes && record.scopes.length > 0) safe.scopes = record.scopes;
  if (record.permissions) {
    safe.permissions = { granted: record.permissions.granted === true, note: sanitizeErrorMessage(record.permissions.note) };
  }

  await db
    .collection(TESTS_COLLECTION)
    .doc(platformDocId(module))
    .set({ [kind]: safe, updatedAt: nowIso() }, { merge: true });
}

/** Records a handoff that was prepared but never published. */
export async function recordHandoff(module: ModuleId, note: string): Promise<void> {
  await db
    .collection(TESTS_COLLECTION)
    .doc(platformDocId(module))
    .set(
      {
        handoffAt: nowIso(),
        handoffNote: sanitizeErrorMessage(note),
        updatedAt: nowIso(),
      },
      { merge: true },
    );
}

/** Appends one audit entry (server-side only, append-only). */
export async function recordAudit(entry: {
  module: ModuleId | 'engine';
  action: AuditEntry['action'];
  actorUid: string;
  outcome: AuditEntry['outcome'];
  note?: string;
  event?: AttributionEvent;
}): Promise<void> {
  const doc: Record<string, unknown> = {
    module: entry.module,
    action: entry.action,
    actorUid: entry.actorUid,
    outcome: entry.outcome,
    at: nowIso(),
  };
  if (entry.note) doc.note = sanitizeErrorMessage(entry.note);
  if (entry.event) doc.event = entry.event;
  try {
    await db.collection(AUDIT_COLLECTION).add(doc);
  } catch {
    // Auditing must never break the operation it describes; the admin error
    // log already captures Firestore failures.
  }
}

/** Approval flags for one module — merged from the spec and the attestation. */
export async function getApproval(module: ModuleId, ownerId: string): Promise<ApprovalInfo> {
  const spec = MODULE_SPECS[module];
  const required = spec.approval?.required === true;
  if (!required) return { required: false, granted: true, note: '' };

  const note = spec.approval?.note ?? 'Provider approval is required.';
  try {
    const snap = await db.collection(META_COLLECTION).doc(connectionId(module, ownerId)).get();
    const granted = snap.exists && (snap.data() as { granted?: unknown } | undefined)?.granted === true;
    return { required: true, granted, note };
  } catch {
    return { required: true, granted: false, note };
  }
}

/** Records an administrator attestation that the provider approval exists. */
export async function setApproval(params: {
  module: ModuleId;
  ownerId: string;
  granted: boolean;
  note?: string;
  actorUid: string;
}): Promise<ApprovalInfo> {
  const spec = MODULE_SPECS[params.module];
  if (spec.approval?.required !== true) {
    return { required: false, granted: true, note: '' };
  }
  await db
    .collection(META_COLLECTION)
    .doc(connectionId(params.module, params.ownerId))
    .set(
      {
        module: params.module,
        ownerId: params.ownerId,
        granted: params.granted,
        note: params.granted ? sanitizeErrorMessage(params.note || 'Provider approval attested by admin.') : '',
        attestedBy: params.actorUid,
        updatedAt: nowIso(),
      },
      { merge: true },
    );
  return getApproval(params.module, params.ownerId);
}

/* ── Rate limiting (sensitive operations) ───────────────────────────────── */

/**
 * Fixed-window cooldown for sensitive admin operations.
 *
 * No Redis, no new infrastructure: the stamp rides in the same meta document
 * the approval attestation uses, so one server-side read decides the gate.
 * Returns the remaining seconds when the caller must wait.
 */
export async function actionCooldownSeconds(
  module: ModuleId,
  uid: string,
  action: 'diagnostic' | 'publish_test',
  windowMs: number,
): Promise<number> {
  const field = `${action}At`;
  try {
    const ref = db.collection(META_COLLECTION).doc(`${connectionId(module, uid)}__rate`);
    const snap = await ref.get();
    const last = snap.exists ? (snap.data() as Record<string, unknown> | undefined)?.[field] : undefined;
    const lastMs = typeof last === 'string' ? Date.parse(last) : NaN;
    const remaining = Number.isFinite(lastMs) ? lastMs + windowMs - Date.now() : 0;
    if (remaining > 0) return Math.ceil(remaining / 1000);
    await ref.set({ [field]: nowIso(), updatedAt: nowIso() }, { merge: true });
    return 0;
  } catch {
    // If the stamp cannot be read/written, prefer the operation over an
    // invented refusal — the routes are already admin-gated and audited.
    return 0;
  }
}

/* ── Readiness ──────────────────────────────────────────────────────────── */

function envStatuses(module: ModuleId, env: Record<string, string | undefined>): EnvVarStatus[] {
  return MODULE_SPECS[module].env.map((spec) => ({
    name: spec.name,
    present: Boolean((env[spec.name] ?? '').trim()),
    role: spec.role,
    required: spec.required,
  }));
}

/** The newest failing record across all kinds, if any. */
function latestFailure(tests: ModuleTestDoc): TestRecord | null {
  let worst: TestRecord | null = null;
  for (const kind of TEST_KINDS) {
    const record = tests[kind];
    if (record && !record.ok && (!worst || record.at > worst.at)) worst = record;
  }
  return worst;
}

/** Permission verdict captured with the newest successful test. */
function permissionVerdict(tests: ModuleTestDoc): { granted: boolean; note: string } {
  const candidates = [tests.diagnostic, tests.auth].filter((r): r is TestRecord => Boolean(r?.permissions));
  if (candidates.length === 0) return { granted: false, note: 'Not verified yet.' };
  const newest = candidates.sort((a, b) => (a.at < b.at ? 1 : -1))[0];
  return newest.permissions ?? { granted: false, note: 'Not verified yet.' };
}

/**
 * Full readiness view for one module.
 *
 * Env values are never read into the result — only presence booleans — so a
 * secret cannot reach the browser even if the route serialized this object
 * verbatim.
 */
export async function getModuleReadiness(module: ModuleId, ctx: ReadinessContext): Promise<ModuleReadiness> {
  const spec = MODULE_SPECS[module];
  const env = envStatuses(module, ctx.env);
  const missingEnvVars = env.filter((e) => e.required && !e.present).map((e) => e.name);

  const connectionRecord = await getConnection(module, ctx.caller.uid, ctx.caller);
  const connection: ConnectionInfo = toConnectionInfo(connectionRecord);
  const approval = await getApproval(module, ctx.caller.uid);
  const tests = await readTestDoc(module);

  const readiness = computeReadiness({
    readyBy: spec.readyBy,
    missingRequiredEnv: missingEnvVars,
    connection,
    approval,
    tests,
  });

  const failure = latestFailure(tests);
  const result: ModuleReadiness = {
    id: module,
    label: spec.label,
    purpose: spec.purpose,
    state: readiness.state,
    requiredEnvVars: env.filter((e) => e.required).map((e) => e.name),
    missingEnvVars,
    env,
    connection,
    approval,
    permissions: permissionVerdict(tests),
    nextStep: readiness.nextStep,
    activation: spec.activation,
  };
  if (tests.auth) result.lastAuthTest = tests.auth;
  if (tests.diagnostic) result.lastDiagnostic = tests.diagnostic;
  if (tests.publish) result.lastPublishTest = tests.publish;
  if (failure) result.lastError = { at: failure.at, note: failure.note };
  if (tests.handoffAt) {
    result.lastHandoff = { at: tests.handoffAt, note: tests.handoffNote ?? 'Handoff prepared, not published.' };
  }
  return result;
}

/** Every module's readiness, problems first (that is why STATE_RANK exists). */
export async function getAllReadiness(ctx: ReadinessContext): Promise<ModuleReadiness[]> {
  const modules = await Promise.all(MODULE_IDS.map((module) => getModuleReadiness(module, ctx)));
  return modules.sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state]);
}

/* ── Operations the routes call ─────────────────────────────────────────── */

const DIAGNOSTIC_COOLDOWN_MS = 5_000;
const PUBLISH_COOLDOWN_MS = 60_000;

export interface TestRunResult {
  /** Set when the request was refused before running (never a fake success). */
  refused?: string;
  rateLimited?: boolean;
  steps: DiagnosticStep[];
  readiness?: ModuleReadiness;
}

/**
 * Runs the safe diagnostic for one module, records every step and audits the
 * outcome. The caller must already be an authenticated admin.
 */
export async function runModuleTest(module: ModuleId, ctx: ReadinessContext): Promise<TestRunResult> {
  const wait = await actionCooldownSeconds(module, ctx.caller.uid, 'diagnostic', DIAGNOSTIC_COOLDOWN_MS);
  if (wait > 0) {
    return {
      refused: `A diagnostic for ${module} just ran — retry in ${wait}s.`,
      rateLimited: true,
      steps: [],
    };
  }

  const outcome = await runDiagnostics(module, {
    env: ctx.env,
    ownerId: ctx.caller.uid,
    caller: ctx.caller,
  });

  const steps = outcome.steps ?? [];

  if (outcome.refuse) {
    await recordAudit({
      module,
      action: 'diagnostic',
      actorUid: ctx.caller.uid,
      outcome: 'refused',
      note: outcome.refuse,
    });
    return { refused: sanitizeErrorMessage(outcome.refuse), steps: [], readiness: await getModuleReadiness(module, ctx) };
  }

  // Keep the LAST record of each kind — a module can emit several steps.
  const byKind = new Map<TestKind, TestRecord>();
  for (const step of steps) {
    if (!(TEST_KINDS as string[]).includes(step.kind)) continue;
    byKind.set(step.kind, testRecordFromStep(step));
  }
  for (const [kind, record] of byKind) {
    await recordTest(module, kind, record);
  }

  const failed = steps.some((s) => !s.ok);
  await recordAudit({
    module,
    action: 'diagnostic',
    actorUid: ctx.caller.uid,
    outcome: failed ? 'failed' : 'ok',
    note: steps[steps.length - 1]?.note ?? 'Diagnostic ran.',
  });

  return { steps, readiness: await getModuleReadiness(module, ctx) };
}

export interface PublishTestRunResult {
  refused?: string;
  rateLimited?: boolean;
  ok: boolean;
  note: string;
  remoteId?: string;
  handoffUrl?: string;
  readiness?: ModuleReadiness;
}

/**
 * Runs a neutral publish test.
 *
 * Two independent gates, both server-side:
 *   • `confirm === true` — the explicit administrator confirmation,
 *   • the module's own provider approval (Meta App Review / TikTok
 *     video.publish) when the spec declares one.
 *
 * A handoff is recorded as a handoff and NEVER as a published post.
 */
export async function runModulePublishTest(
  module: ModuleId,
  ctx: ReadinessContext & { confirm: boolean; videoUrl?: string; pageId?: string },
): Promise<PublishTestRunResult> {
  if (ctx.confirm !== true) {
    await recordAudit({
      module,
      action: 'publish_test',
      actorUid: ctx.caller.uid,
      outcome: 'refused',
      note: 'Publish test refused: no explicit confirmation.',
    });
    return {
      ok: false,
      refused: 'Not confirmed — an administrator must confirm before any publish test.',
      note: 'Not confirmed — an administrator must confirm before any publish test.',
    };
  }

  const spec = MODULE_SPECS[module];
  if (spec.approval?.required === true) {
    const approval = await getApproval(module, ctx.caller.uid);
    if (!approval.granted) {
      await recordAudit({
        module,
        action: 'publish_test',
        actorUid: ctx.caller.uid,
        outcome: 'refused',
        note: 'Publish test refused: provider approval not attested.',
      });
      return {
        ok: false,
        refused: approval.note || 'Provider approval has not been attested for this module.',
        note: approval.note || 'Provider approval has not been attested for this module.',
      };
    }
  }

  const wait = await actionCooldownSeconds(module, ctx.caller.uid, 'publish_test', PUBLISH_COOLDOWN_MS);
  if (wait > 0) {
    return {
      ok: false,
      refused: `A publish test for ${module} just ran — retry in ${wait}s.`,
      rateLimited: true,
      note: `A publish test for ${module} just ran — retry in ${wait}s.`,
    };
  }

  let outcome;
  try {
    outcome = await publishTest(module, {
      module,
      ownerId: ctx.caller.uid,
      caller: ctx.caller,
      env: ctx.env,
      confirm: ctx.confirm,
      videoUrl: ctx.videoUrl,
      pageId: ctx.pageId,
    });
  } catch (error) {
    const note = `Publish test failed: ${sanitizeErrorMessage(error)}`;
    await recordAudit({ module, action: 'publish_test', actorUid: ctx.caller.uid, outcome: 'failed', note });
    return { ok: false, note, readiness: await getModuleReadiness(module, ctx) };
  }

  if (outcome.handoffUrl) {
    const note = sanitizeErrorMessage(outcome.note);
    await recordHandoff(module, `${note} ${outcome.handoffUrl}`);
    await recordAudit({
      module,
      action: 'handoff',
      actorUid: ctx.caller.uid,
      outcome: 'ok',
      note,
      event: 'share_handoff_initiated',
    });
    return { ok: false, handoffUrl: outcome.handoffUrl, note, readiness: await getModuleReadiness(module, ctx) };
  }

  // A publishing integration must return the provider's own id; a built-in
  // module (media preparation) has no provider to name, so the absence of an
  // id there is expected rather than a failure.
  const needsRemoteId = spec.connectionKind !== 'builtin';
  if (outcome.ok && (outcome.remoteId || !needsRemoteId)) {
    const note = sanitizeErrorMessage(outcome.note);
    const record: TestRecord = { kind: 'publish', ok: true, at: nowIso(), note };
    if (outcome.remoteId) record.remoteId = outcome.remoteId;
    await recordTest(module, 'publish', record);
    await recordAudit({
      module,
      action: outcome.remoteId ? 'publish_test' : 'diagnostic',
      actorUid: ctx.caller.uid,
      outcome: 'ok',
      note,
      ...(outcome.remoteId ? { event: 'post_confirmed_published' as const } : {}),
    });
    return { ok: true, note, remoteId: outcome.remoteId, readiness: await getModuleReadiness(module, ctx) };
  }

  // `ok` without an id on a publishing module is NOT a publish — the honesty
  // contract in publishing.ts guarantees this branch is a failure.
  const note = sanitizeErrorMessage(
    outcome.ok ? 'The provider accepted the request but returned no id — not recorded as published.' : outcome.note,
  );
  await recordAudit({ module, action: 'publish_test', actorUid: ctx.caller.uid, outcome: 'failed', note });
  return { ok: false, note, readiness: await getModuleReadiness(module, ctx) };
}

/** Marks the caller's connection disconnected and audits it. */
export async function disconnectModule(module: ModuleId, ctx: ReadinessContext): Promise<boolean> {
  const ok = await disconnectConnection(module, ctx.caller.uid, ctx.caller);
  await recordAudit({
    module,
    action: 'disconnect',
    actorUid: ctx.caller.uid,
    outcome: ok ? 'ok' : 'refused',
    note: ok
      ? 'Account disconnected — the engine stops using this connection for future publishing.'
      : 'No connection to disconnect.',
  });
  return ok;
}
