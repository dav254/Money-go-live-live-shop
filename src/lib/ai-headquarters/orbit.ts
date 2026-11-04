/**
 * ORBIT — the single authorisation entry point for agent requests.
 *
 * Every `/api/orbit/*` route calls `authenticateOrbitRequest` first, then
 * checks the scope it needs. There is no route that reads Firestore on behalf
 * of an agent without going through here, and no route that accepts a
 * Firestore credential, a VPS shell or a service account from an agent.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { AgentError, authenticateAgent, requireScope } from './agents';
import type { AgentRecord, Scope } from './types';

/** Reads `Authorization: Bearer orb_…` and resolves the agent behind it. */
export async function authenticateOrbitRequest(
  request: Request,
  db: Firestore,
): Promise<AgentRecord> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new AgentError('unauthorized', 'An agent credential is required.');
  return authenticateAgent(db, token);
}

/** Authenticate AND require a scope in one call — the usual case. */
export async function authorizeOrbitRequest(
  request: Request,
  db: Firestore,
  scope: Scope,
): Promise<AgentRecord> {
  const agent = await authenticateOrbitRequest(request, db);
  requireScope(agent, scope);
  return agent;
}

const STATUS_BY_CODE: Record<string, number> = {
  unauthorized: 401,
  disabled: 403,
  forbidden: 403,
  invalid_input: 400,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  integrity: 409,
};

/**
 * Maps a known domain error to a safe response. Unknown errors become a
 * generic 500 — no message, no stack, no upstream body ever reaches an agent.
 */
export function orbitErrorResponse(error: unknown): NextResponse {
  if (error instanceof AgentError) {
    return NextResponse.json({ error: error.code, message: error.message }, {
      status: STATUS_BY_CODE[error.code] ?? 400,
    });
  }
  // ProposalError / TaskError are structurally identical; duck-typed to avoid
  // import cycles, and accepted only when the code is one this layer knows.
  const candidate = error as { name?: string; code?: string; message?: string };
  if (
    typeof candidate?.name === 'string' &&
    candidate.name.endsWith('Error') &&
    typeof candidate.code === 'string' &&
    candidate.code in STATUS_BY_CODE
  ) {
    return NextResponse.json(
      { error: candidate.code, message: candidate.message },
      { status: STATUS_BY_CODE[candidate.code] },
    );
  }
  console.error('[orbit] request failed');
  return NextResponse.json({ error: 'internal', message: 'The request could not be completed.' }, {
    status: 500,
  });
}
