/**
 * OPPORTUNITIES — service layer (Firestore injected).
 *
 * Collections (server-owned, additive, default-deny for clients):
 *   • `opportunities`         — the funded task itself
 *   • `opportunityApplications` — one per (opportunity, applicant), id is
 *                                 deterministic so applying twice is a no-op
 *
 * Authorization: funder/admin actions take an explicit `isAdmin` flag that the
 * ROUTE verified against the authenticated identity — never a client claim.
 * Applicant identity is the verified uid passed by the route.
 *
 * Money: budgets are stored exactly as validated (integer minor units +
 * currency). Nothing here computes a payable balance; approval of a task
 * records an `opportunity_task_approved` VERIFIED event — the future ledger
 * (trust/ledger.ts) is where a reward would later be entered by a reviewed,
 * server-side process.
 */

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { recordCoreEvent } from '../events/recorder';
import type { CreateOpportunityInput } from '../validation';
import {
  applicationDocId,
  canTransitionApplication,
  type ApplicationState,
  type OpportunityState,
} from './types';

export const OPPORTUNITIES_COLLECTION = 'opportunities';
export const APPLICATIONS_COLLECTION = 'opportunityApplications';

export class OpportunityError extends Error {
  constructor(
    public readonly code: 'not_found' | 'forbidden' | 'invalid_state' | 'window_closed' | 'invalid_transition',
    message: string,
  ) {
    super(message);
    this.name = 'OpportunityError';
  }
}

/** Creates an opportunity. Caller must be an admin/funder (route-verified). */
export async function createOpportunity(
  db: Firestore,
  input: CreateOpportunityInput,
  funderUid: string,
): Promise<{ id: string; state: OpportunityState }> {
  const state: OpportunityState = input.state;
  const ref = await db.collection(OPPORTUNITIES_COLLECTION).add({
    title: input.title,
    description: input.description,
    budget: { amountMinor: input.budget.amountMinor, currency: input.budget.currency },
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    eligibility: input.eligibility ?? null,
    completionCriteria: input.completionCriteria,
    state,
    funderUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id, state };
}

/**
 * Lists opportunities for a caller. `states` is chosen by the ROUTE: public
 * callers get ['open', 'closed'] — drafts and cancelled tasks are funder-only
 * and never reach this function from a public request.
 */
export async function listOpportunities(
  db: Firestore,
  params: { states: readonly OpportunityState[]; limit: number },
): Promise<Array<Record<string, unknown>>> {
  const limit = Math.min(Math.max(params.limit, 1), 50);
  const chunks = await Promise.all(
    // Equality-only queries: no composite index required.
    params.states.map((state) => db.collection(OPPORTUNITIES_COLLECTION).where('state', '==', state).limit(limit).get()),
  );
  const docs = chunks.flatMap((c) => c.docs);
  return docs.slice(0, limit).map((d) => ({ id: d.id, ...toPublic(d.data() ?? {}) }));
}

function toPublic(data: Record<string, unknown>): Record<string, unknown> {
  // Funder uid is not needed by applicants; keep the payload minimal.
  const { funderUid: _omit, ...rest } = data as Record<string, unknown> & { funderUid?: unknown };
  return rest;
}

export interface ApplyParams {
  db: Firestore;
  opportunityId: string;
  applicantUid: string;
  note?: string;
}

/**
 * Applies for an opportunity. Idempotent: the deterministic application id
 * means a double-submit returns the existing application with
 * `alreadyApplied: true` instead of creating a second one.
 */
export async function applyToOpportunity(
  params: ApplyParams,
): Promise<{ applicationId: string; state: ApplicationState; alreadyApplied: boolean }> {
  const { db, opportunityId, applicantUid, note } = params;
  const oppSnap = await db.collection(OPPORTUNITIES_COLLECTION).doc(opportunityId).get();
  if (!oppSnap.exists) throw new OpportunityError('not_found', 'Opportunity not found.');
  const opp = (oppSnap.data() ?? {}) as { state?: OpportunityState; startsAt?: string; endsAt?: string };
  if (opp.state !== 'open') throw new OpportunityError('invalid_state', 'This opportunity is not accepting applications.');
  // The window is enforced on BOTH ends with the server clock: an admin may
  // publish an `open` opportunity whose startsAt is still in the future, and
  // applications must not slip in before it opens.
  const now = Date.now();
  const startsAt = opp.startsAt ? Date.parse(opp.startsAt) : NaN;
  if (Number.isFinite(startsAt) && now < startsAt) {
    throw new OpportunityError('window_closed', 'The application window has not opened yet.');
  }
  const endsAt = opp.endsAt ? Date.parse(opp.endsAt) : NaN;
  if (Number.isFinite(endsAt) && now > endsAt) {
    throw new OpportunityError('window_closed', 'The application window has closed.');
  }

  const applicationId = applicationDocId(opportunityId, applicantUid);
  const ref = db.collection(APPLICATIONS_COLLECTION).doc(applicationId);
  try {
    await ref.create({
      opportunityId,
      applicantUid,
      state: 'submitted' as ApplicationState,
      note: note ?? null,
      reviewState: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { applicationId, state: 'submitted', alreadyApplied: false };
  } catch (err) {
    const code = (err as { code?: number | string })?.code;
    if (code !== 6 && code !== 'already-exists') throw err;
    const existing = await ref.get();
    const ex = (existing.data() ?? {}) as { state?: ApplicationState };
    return { applicationId, state: ex.state ?? 'submitted', alreadyApplied: true };
  }
}

/** What an admin review produced. `eventRecorded:false` means the state
 *  transition COMMITTED but the verified outcome event could not be written —
 *  the caller may report success and should not repeat the decision. */
export interface ReviewResult {
  applicationId: string;
  state: ApplicationState;
  /** False when this was an idempotent re-assert of the same decision. */
  changed: boolean;
  /** False when the (approved) outcome event could not be recorded. */
  eventRecorded: boolean;
}

export interface ReviewParams {
  db: Firestore;
  applicationId: string;
  decision: 'approved' | 'rejected';
  reviewerUid: string;
  reason?: string;
}

/**
 * Reviews an application (admin/funder only — route-verified). The decision,
 * the reviewer and the reason are written inside ONE transaction, so a
 * conflicting concurrent review is rejected by Firestore's transaction
 * isolation and a repeated review of the same decision is a no-op.
 *
 * An approval additionally emits a VERIFIED `opportunity_task_approved`
 * event through the idempotent recorder, keyed on the application id —
 * approving twice records one event. A failure to record that event is
 * surfaced as `eventRecorded: false` instead of failing the call: the
 * decision already committed, and making the caller retry would only
 * re-assert an already-final state. NOTE: this records an outcome, it does
 * NOT move money; the ledger is deliberately not connected (see
 * trust/ledger.ts).
 */
export async function reviewApplication(params: ReviewParams): Promise<ReviewResult> {
  const { db, applicationId, decision, reviewerUid, reason } = params;
  const ref = db.collection(APPLICATIONS_COLLECTION).doc(applicationId);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new OpportunityError('not_found', 'Application not found.');
    const app = (snap.data() ?? {}) as { state?: ApplicationState; opportunityId?: string };

    const from = (app.state ?? 'submitted') as ApplicationState;
    if (from === decision) {
      // Idempotent re-assert: reviewing twice with the same decision changes
      // nothing and records no second event.
      return { state: from, opportunityId: app.opportunityId ?? '', changed: false };
    }
    if (!canTransitionApplication(from, decision)) {
      throw new OpportunityError('invalid_transition', 'Application state change is not allowed.');
    }
    tx.update(ref, {
      state: decision,
      reviewedBy: reviewerUid,
      reviewReason: reason ?? null,
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { state: decision, opportunityId: app.opportunityId ?? '', changed: true };
  });

  // Verified outcome event (idempotent on the application id). Recorded AFTER
  // the committed transition: a recording failure can never undo the decision,
  // and a retry of the same decision will not produce a second event.
  let eventRecorded = true;
  if (result.changed && decision === 'approved' && result.opportunityId) {
    try {
      const recorded = await recordCoreEvent(db, {
        type: 'opportunity_task_approved',
        entityKind: 'application',
        entityId: applicationId,
        origin: 'server',
        actorUid: reviewerUid,
        dedupeKey: `opp-approve:${applicationId}`,
      });
      eventRecorded = recorded.recorded;
    } catch {
      eventRecorded = false;
    }
  }
  return { applicationId, state: result.state, changed: result.changed, eventRecorded };
}

export interface ListApplicationsParams {
  db: Firestore;
  states: readonly ApplicationState[];
  limit: number;
}

/**
 * Lists applications for admin review. Equality-only queries per state with a
 * hard limit (no orderBy ⇒ no composite index requirement), results merged
 * and re-bounded in memory. Admin-facing: the route has already verified the
 * caller; there is no applicant-facing path here (applicants see only their
 * own application id returned by `applyToOpportunity`).
 */
export async function listApplications(params: ListApplicationsParams): Promise<Array<Record<string, unknown>>> {
  const { db, states } = params;
  const limit = Math.min(Math.max(params.limit, 1), 50);
  const chunks = await Promise.all(
    states.map((state) => db.collection(APPLICATIONS_COLLECTION).where('state', '==', state).limit(limit).get()),
  );
  return chunks.flatMap((c) => c.docs).slice(0, limit).map((d) => ({ id: d.id, ...(d.data() ?? {}) }));
}
