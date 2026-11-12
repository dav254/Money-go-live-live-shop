/**
 * ORBIT — proposals and approvals (task §G).
 *
 * A proposal is how an agent "recommends" or "prepares" something. It is a
 * request, never an action:
 *   • creation needs the scope the kind demands,
 *   • the exact action + parameters are frozen into a SHA-256 digest,
 *   • a founder/admin approves THAT digest — if anything changed, approval
 *     is refused instead of silently approving something else,
 *   • nobody may approve their own proposal,
 *   • approval records who decided and when, and mints no capability: a human
 *     still runs the action through its existing, already-guarded route.
 */
import type { Firestore, Query } from 'firebase-admin/firestore';
import {
  HQ_LIMITS,
  PROPOSAL_SCOPE,
  isProposalAction,
  isProposalKind,
  type AgentRecord,
  type ProposalAction,
  type ProposalKind,
  type ProposalRecord,
} from './types';
import { digestAction } from './tokens';
import { requireScope } from './agents';
import { writeAudit } from './audit';

export const PROPOSALS_COLLECTION = 'ai_hq_proposals';
const META_COLLECTION = 'ai_hq_meta';

export class ProposalError extends Error {
  constructor(
    readonly code:
      | 'invalid_input'
      | 'forbidden'
      | 'not_found'
      | 'conflict'
      | 'rate_limited'
      | 'integrity',
    message: string,
  ) {
    super(message);
    this.name = 'ProposalError';
  }
}

/** Parameter names that must never be accepted from an agent. */
const SECRETISH_KEY = /(token|secret|password|passwd|api[_-]?key|credential|private[_-]?key)/i;

function cleanText(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Rejects nested secret-looking keys — a proposal is not a credential store. */
function assertNoSecrets(value: unknown, depth = 0): void {
  if (depth > 4 || value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) assertNoSecrets(item, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SECRETISH_KEY.test(key)) {
        throw new ProposalError('invalid_input', `Proposal parameters may not contain "${key}".`);
      }
      assertNoSecrets(item, depth + 1);
    }
  }
}

/**
 * Per-agent slot reservation in ONE document: a cooldown plus a daily cap,
 * without a composite index and without a write on a hot query.
 */
async function reserveSlot(db: Firestore, agentId: string, now: Date): Promise<void> {
  const ref = db.collection(META_COLLECTION).doc(`${agentId}__proposal`);
  const dayKey = now.toISOString().slice(0, 10);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = (snap.exists ? snap.data() : {}) as { lastAt?: number; dayKey?: string; count?: number };
    const lastAt = typeof data.lastAt === 'number' ? data.lastAt : 0;
    const count = data.dayKey === dayKey && typeof data.count === 'number' ? data.count : 0;

    const waited = now.getTime() - lastAt;
    if (waited >= 0 && waited < HQ_LIMITS.proposalCooldownSeconds * 1000) {
      throw new ProposalError(
        'rate_limited',
        `Wait ${HQ_LIMITS.proposalCooldownSeconds}s between proposals.`,
      );
    }
    if (count >= HQ_LIMITS.proposalsPerAgentPerDay) {
      throw new ProposalError(
        'rate_limited',
        `Daily proposal limit (${HQ_LIMITS.proposalsPerAgentPerDay}) reached for this agent.`,
      );
    }

    tx.set(ref, { lastAt: now.getTime(), dayKey, count: count + 1 }, { merge: true });
  });
}

export interface CreateProposalInput {
  kind: unknown;
  title: unknown;
  summary: unknown;
  action: unknown;
  now?: Date;
}

export async function createProposal(
  db: Firestore,
  agent: AgentRecord,
  input: CreateProposalInput,
): Promise<ProposalRecord> {
  if (!isProposalKind(input.kind)) {
    throw new ProposalError('invalid_input', 'Unknown proposal kind.');
  }
  const kind: ProposalKind = input.kind;
  requireScope(agent, PROPOSAL_SCOPE[kind]);

  const title = cleanText(input.title, HQ_LIMITS.titleMax);
  const summary = cleanText(input.summary, HQ_LIMITS.summaryMax);
  if (title.length < 3) throw new ProposalError('invalid_input', 'A proposal needs a short title.');

  const rawAction = (input.action ?? {}) as { type?: unknown; params?: unknown };
  if (!isProposalAction(rawAction.type)) {
    throw new ProposalError('invalid_input', 'Unknown proposal action.');
  }
  const params =
    rawAction.params && typeof rawAction.params === 'object' && !Array.isArray(rawAction.params)
      ? (rawAction.params as Record<string, unknown>)
      : {};
  assertNoSecrets(params);

  const action: ProposalAction = { type: rawAction.type, params };
  if (JSON.stringify(action).length > HQ_LIMITS.actionBytesMax) {
    throw new ProposalError('invalid_input', 'That action is too large — send a brief, not a payload.');
  }

  const now = input.now ?? new Date();
  await reserveSlot(db, agent.id, now);

  const ref = db.collection(PROPOSALS_COLLECTION).doc();
  const record: ProposalRecord = {
    id: ref.id,
    kind,
    title,
    summary,
    action,
    actionDigest: digestAction(action),
    requestedBy: { agentId: agent.id, name: agent.name, department: agent.department },
    status: 'pending',
    createdAt: now.toISOString(),
  };

  await ref.set(record);
  await writeAudit(db, {
    action: 'proposal_created',
    actor: `agent:${agent.id}`,
    agentId: agent.id,
    proposalId: record.id,
    outcome: 'ok',
    note: `${kind}: ${title}`,
  });

  return record;
}

export interface AdminProposalInput {
  uid: string;
  title: unknown;
  summary: unknown;
  action: unknown;
}

/**
 * Founder-authored proposal. Unlike an agent proposal this does not need an
 * agent token, but it still freezes the exact action into a digest and still
 * executes nothing on approval. OpenCode task creation checks the approved
 * digest again before starting a session.
 */
export async function createAdminProposal(
  db: Firestore,
  input: AdminProposalInput,
): Promise<ProposalRecord> {
  const title = cleanText(input.title, HQ_LIMITS.titleMax);
  const summary = cleanText(input.summary, HQ_LIMITS.summaryMax);
  if (title.length < 3) throw new ProposalError('invalid_input', 'A proposal needs a short title.');

  const rawAction = (input.action ?? {}) as { type?: unknown; params?: unknown };
  if (rawAction.type !== 'opencode_task' || !isProposalAction(rawAction.type)) {
    throw new ProposalError('invalid_input', 'Admin proposals may only prepare an OpenCode task.');
  }
  const params =
    rawAction.params && typeof rawAction.params === 'object' && !Array.isArray(rawAction.params)
      ? (rawAction.params as Record<string, unknown>)
      : {};
  assertNoSecrets(params);
  const action: ProposalAction = { type: 'opencode_task', params };
  if (JSON.stringify(action).length > HQ_LIMITS.actionBytesMax) {
    throw new ProposalError('invalid_input', 'That task is too large — shorten the plan or prompt.');
  }

  const now = new Date();
  const ref = db.collection(PROPOSALS_COLLECTION).doc();
  const record: ProposalRecord = {
    id: ref.id,
    kind: 'investigation',
    title,
    summary,
    action,
    actionDigest: digestAction(action),
    requestedBy: {
      agentId: 'vidnov-intelligence',
      name: 'Vidnov Intelligence',
      department: 'engineering',
    },
    status: 'pending',
    createdAt: now.toISOString(),
  };

  await ref.set(record);
  await writeAudit(db, {
    action: 'proposal_created',
    actor: input.uid,
    agentId: 'vidnov-intelligence',
    proposalId: record.id,
    outcome: 'ok',
    note: `opencode task: ${title}`,
  });

  return record;
}

export async function getProposal(db: Firestore, id: string): Promise<ProposalRecord | null> {
  if (!id) return null;
  const snap = await db.collection(PROPOSALS_COLLECTION).doc(id).get();
  return snap.exists ? (snap.data() as ProposalRecord) : null;
}

export async function decideProposal(
  db: Firestore,
  params: {
    id: string;
    decision: 'approve' | 'reject';
    actorUid: string;
    note?: unknown;
    /** The digest the approver saw — proof they approved THIS version. */
    digest?: unknown;
    now?: Date;
  },
): Promise<ProposalRecord> {
  if (params.decision !== 'approve' && params.decision !== 'reject') {
    throw new ProposalError('invalid_input', 'Decision must be approve or reject.');
  }

  const ref = db.collection(PROPOSALS_COLLECTION).doc(String(params.id ?? ''));
  const snap = await ref.get();
  if (!snap.exists) throw new ProposalError('not_found', 'That proposal does not exist.');

  const record = snap.data() as ProposalRecord;
  if (record.status !== 'pending') {
    throw new ProposalError('conflict', `This proposal was already ${record.status}.`);
  }

  // Integrity: the stored action must still hash to the stored digest…
  if (digestAction(record.action) !== record.actionDigest) {
    throw new ProposalError('integrity', 'The stored proposal no longer matches its digest.');
  }
  // …and the approver must be approving exactly that version.
  if (typeof params.digest !== 'string' || params.digest !== record.actionDigest) {
    throw new ProposalError(
      'conflict',
      'The proposal changed since it was displayed — reload and review it again.',
    );
  }

  // Nobody approves their own proposal.
  if (record.requestedBy?.uid && record.requestedBy.uid === params.actorUid) {
    throw new ProposalError('forbidden', 'A proposer may not approve their own proposal.');
  }

  const now = params.now ?? new Date();
  const patch = {
    status: params.decision === 'approve' ? ('approved' as const) : ('rejected' as const),
    decidedAt: now.toISOString(),
    decidedBy: params.actorUid,
    ...(cleanText(params.note, 500) ? { decisionNote: cleanText(params.note, 500) } : {}),
    ...(params.decision === 'approve' ? { approvedDigest: record.actionDigest } : {}),
  };

  await ref.set(patch, { merge: true });
  await writeAudit(db, {
    action: 'proposal_decided',
    actor: params.actorUid,
    agentId: record.requestedBy?.agentId,
    proposalId: record.id,
    outcome: 'ok',
    note: `${params.decision}d: ${record.title}`,
  });

  return { ...record, ...patch };
}

export async function listProposals(
  db: Firestore,
  params: { agentId?: string; limit?: number } = {},
): Promise<ProposalRecord[]> {
  const limit = Math.min(HQ_LIMITS.listLimit, Math.max(1, params.limit ?? HQ_LIMITS.listLimit));
  // A single equality predicate — no composite index required.
  const query: Query = params.agentId
    ? db
        .collection(PROPOSALS_COLLECTION)
        .where('requestedBy.agentId', '==', params.agentId)
        .limit(limit)
    : db.collection(PROPOSALS_COLLECTION).limit(limit);
  const snap = await query.get();
  return snap.docs
    .map((doc) => doc.data() as ProposalRecord)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
