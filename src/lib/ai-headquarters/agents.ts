/**
 * ORBIT — the agent registry.
 *
 * An agent is a row in `ai_hq_agents`: a name, a department, a fixed scope
 * list and the hash of its credential. Paperclip owns the org chart; this
 * registry is Vidnov's own record of "which machine identity may call Orbit,
 * with which scopes", because a permission system may not trust the caller's
 * self-description.
 */
import type { Firestore } from 'firebase-admin/firestore';
import {
  HQ_LIMITS,
  isDepartmentId,
  isScope,
  type AgentRecord,
  type DepartmentId,
  type Scope,
} from './types';
import { hashSecret, issueToken, newAgentId, parseToken, safeEqualHex } from './tokens';
import { writeAudit } from './audit';

export const AGENTS_COLLECTION = 'ai_hq_agents';

export class AgentError extends Error {
  constructor(
    readonly code: 'invalid_input' | 'not_found' | 'disabled' | 'unauthorized' | 'forbidden',
    message: string,
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export interface CreateAgentInput {
  name: unknown;
  department: unknown;
  role: unknown;
  scopes: unknown;
  actorUid: string;
}

export interface CreateAgentResult {
  agent: AgentRecord;
  /** Returned ONCE. Only its hash is stored. */
  token: string;
}

function normalizeName(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function normalizeRole(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

/** Scopes are deduped, validated one by one, and cannot be empty. */
export function normalizeScopes(value: unknown): Scope[] {
  const list = Array.isArray(value) ? value : [];
  const out: Scope[] = [];
  for (const item of list) {
    if (!isScope(item)) {
      throw new AgentError('invalid_input', `Unknown scope: ${String(item).slice(0, 40)}.`);
    }
    if (!out.includes(item)) out.push(item);
  }
  if (out.length === 0) throw new AgentError('invalid_input', 'Pick at least one scope.');
  return out;
}

export async function createAgent(db: Firestore, input: CreateAgentInput): Promise<CreateAgentResult> {
  const name = normalizeName(input.name);
  if (!name) throw new AgentError('invalid_input', 'The agent needs a name.');
  if (!isDepartmentId(input.department)) {
    throw new AgentError('invalid_input', 'Pick a department from the registry.');
  }
  const department: DepartmentId = input.department;
  const role = normalizeRole(input.role);
  const scopes = normalizeScopes(input.scopes);

  const id = newAgentId();
  const issued = issueToken(id);
  const now = new Date().toISOString();

  const record: AgentRecord = {
    id,
    name,
    department,
    role,
    scopes,
    tokenHash: issued.tokenHash,
    tokenPrefix: issued.tokenPrefix,
    enabled: true,
    createdAt: now,
    createdBy: input.actorUid,
  };

  await db.collection(AGENTS_COLLECTION).doc(id).set(record);
  await writeAudit(db, {
    action: 'agent_created',
    actor: input.actorUid,
    agentId: id,
    outcome: 'ok',
    note: `${name} (${department})`,
  });

  return { agent: record, token: issued.token };
}

export async function listAgents(db: Firestore): Promise<AgentRecord[]> {
  const snap = await db.collection(AGENTS_COLLECTION).limit(HQ_LIMITS.listLimit).get();
  return snap.docs
    .map((doc) => doc.data() as AgentRecord)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function setAgentEnabled(
  db: Firestore,
  params: { id: string; enabled: boolean; actorUid: string },
): Promise<AgentRecord> {
  const ref = db.collection(AGENTS_COLLECTION).doc(String(params.id ?? ''));
  const snap = await ref.get();
  if (!snap.exists) throw new AgentError('not_found', 'That agent does not exist.');

  const patch = params.enabled
    ? { enabled: true, disabledAt: null }
    : { enabled: false, disabledAt: new Date().toISOString() };
  await ref.set(patch, { merge: true });

  await writeAudit(db, {
    action: params.enabled ? 'agent_enabled' : 'agent_disabled',
    actor: params.actorUid,
    agentId: params.id,
    outcome: 'ok',
  });

  const updated = await ref.get();
  return updated.data() as AgentRecord;
}

/**
 * Verifies a presented credential.
 *
 * Order matters: parse → load → constant-time hash compare → enabled check.
 * A disabled agent is rejected AFTER the hash check, so a wrong secret can
 * never learn whether an id exists.
 */
export async function authenticateAgent(db: Firestore, token: string): Promise<AgentRecord> {
  const parsed = parseToken(token);
  if (!parsed) throw new AgentError('unauthorized', 'Malformed agent credential.');

  const snap = await db.collection(AGENTS_COLLECTION).doc(parsed.agentId).get();
  if (!snap.exists) throw new AgentError('unauthorized', 'Unknown agent credential.');

  const record = snap.data() as AgentRecord;
  if (!safeEqualHex(record.tokenHash, hashSecret(parsed.secret))) {
    throw new AgentError('unauthorized', 'Unknown agent credential.');
  }
  if (!record.enabled) throw new AgentError('disabled', 'This agent has been disabled.');

  // Best-effort presence stamp — never blocks the request.
  try {
    await db.collection(AGENTS_COLLECTION).doc(record.id).set(
      { lastSeenAt: new Date().toISOString() },
      { merge: true },
    );
  } catch {
    /* presence is diagnostics, not authorization */
  }

  return record;
}

/** Throws unless the agent holds the scope. Deny by default. */
export function requireScope(agent: AgentRecord, scope: Scope): void {
  if (!Array.isArray(agent.scopes) || !agent.scopes.includes(scope)) {
    throw new AgentError('forbidden', `This agent does not hold the ${scope} scope.`);
  }
}
