/**
 * /api/admin/ai-headquarters — the founder's Orbit console API.
 *
 *   GET  — model state, departments, agents (no hashes), proposals, audit.
 *   POST — one `action` per request:
 *          `create_agent`       → returns the credential ONCE,
 *          `set_agent_enabled`  → revoke/restore an agent,
 *          `decide_proposal`    → approve/reject against the reviewed digest.
 *
 * Authorisation is the repository's own admin check (`verifyAdminUid`), and
 * every decision is bound to the digest the admin was shown.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import { createAgent, listAgents, setAgentEnabled } from '@/lib/ai-headquarters/agents';
import { decideProposal, listProposals } from '@/lib/ai-headquarters/proposals';
import { listAudit } from '@/lib/ai-headquarters/audit';
import { listAllTaskRuns, summarizeRuns } from '@/lib/ai-headquarters/tasks';
import { modelStatus } from '@/lib/ai-headquarters/model';
import { DEPARTMENTS, HQ_LIMITS, SCOPE_LABELS, SCOPES } from '@/lib/ai-headquarters/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Strips the stored hash before anything reaches a browser. */
function publicAgent(agent: Awaited<ReturnType<typeof listAgents>>[number]) {
  const { tokenHash: _hash, ...rest } = agent;
  return rest;
}

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const [agents, proposals, audit, runs] = await Promise.all([
      listAgents(db),
      listProposals(db, { limit: HQ_LIMITS.listLimit }),
      listAudit(db, 25),
      listAllTaskRuns(db, HQ_LIMITS.taskListLimit),
    ]);

    return NextResponse.json({
      model: modelStatus(process.env),
      departments: DEPARTMENTS,
      scopes: SCOPES.map((id) => ({ id, label: SCOPE_LABELS[id] })),
      agents: agents.map(publicAgent),
      proposals,
      audit,
      // Worker ledger: what actually ran, what failed, and what was produced
      // without a real model. Read from one bounded scan, not a query per agent.
      runs,
      tasks: summarizeRuns(runs),
      limits: HQ_LIMITS,
      generatedAt: new Date().toISOString(),
    });
  } catch {
    console.error('[orbit/admin] overview read failed');
    return NextResponse.json({ error: 'The headquarters overview could not be read.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const action = String(body.action ?? '');

  try {
    if (action === 'create_agent') {
      const { agent, token } = await createAgent(db, {
        name: body.name,
        department: body.department,
        role: body.role,
        scopes: body.scopes,
        actorUid: adminUid,
      });
      return NextResponse.json(
        {
          agent: publicAgent(agent),
          token,
          warning: 'Copy this credential now — it is stored only as a hash and cannot be shown again.',
        },
        { status: 201 },
      );
    }

    if (action === 'set_agent_enabled') {
      const agent = await setAgentEnabled(db, {
        id: String(body.id ?? ''),
        enabled: body.enabled === true,
        actorUid: adminUid,
      });
      return NextResponse.json({ agent: publicAgent(agent) });
    }

    if (action === 'decide_proposal') {
      const proposal = await decideProposal(db, {
        id: String(body.id ?? ''),
        decision: body.decision === 'approve' ? 'approve' : 'reject',
        actorUid: adminUid,
        note: body.note,
        digest: body.digest,
      });
      return NextResponse.json({ proposal });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    const candidate = error as { name?: string; code?: string; message?: string };
    if (
      (candidate?.name === 'AgentError' || candidate?.name === 'ProposalError') &&
      typeof candidate.code === 'string'
    ) {
      return NextResponse.json(
        { error: candidate.code, message: candidate.message },
        { status: candidate.code === 'rate_limited' ? 429 : 400 },
      );
    }
    console.error('[orbit/admin] action failed');
    return NextResponse.json({ error: 'The action could not be completed.' }, { status: 500 });
  }
}
