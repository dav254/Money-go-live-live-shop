/**
 * /api/mobile/admin/opencode — the OpenCode task centre.
 *
 * GET  — real connection status, agents, task history and approved plans.
 * POST — start an approved OpenCode plan. A proposal must be `approved` AND
 *        its approved digest must match the stored action; approval alone is
 *        not a capability.
 * PATCH — abort a running session. No shell/command endpoint is exposed.
 */
import type { NextRequest } from 'next/server';

import { db } from '@/firebase/server';
import { adminGate, json, readBody } from '@/lib/admin-ai/http';
import {
  abortOpenCodeTask,
  findOpenCodeTaskForProposal,
  getOpenCodeTask,
  listOpenCodeTasks,
  probeOpenCode,
  startOpenCodeTask,
  type OpenCodeTaskRecord,
} from '@/lib/admin-ai/opencode';
import { publicError } from '@/lib/admin-ai/validate';
import { writeAudit } from '@/lib/ai-headquarters/audit';
import { getProposal, listProposals } from '@/lib/ai-headquarters/proposals';
import type { ProposalRecord } from '@/lib/ai-headquarters/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function approvedTaskProposal(proposal: ProposalRecord) {
  return proposal.action?.type === 'opencode_task';
}

export async function GET(request: NextRequest) {
  const gate = await adminGate(request);
  if (gate.response) return gate.response;

  const checkedAt = new Date().toISOString();
  const [status, tasks, proposals] = await Promise.all([
    probeOpenCode(),
    listOpenCodeTasks(db, 30),
    listProposals(db, { limit: 50 }).catch(() => [] as ProposalRecord[]),
  ]);

  const approvedProposals = proposals
    .filter((proposal) => proposal.status === 'approved' && approvedTaskProposal(proposal))
    .map((proposal) => ({
      id: proposal.id,
      title: proposal.title,
      summary: proposal.summary,
      actionDigest: proposal.actionDigest,
      approvedDigest: proposal.approvedDigest ?? null,
      decidedAt: proposal.decidedAt ?? null,
      createdAt: proposal.createdAt,
      agent:
        typeof proposal.action.params?.agent === 'string'
          ? proposal.action.params.agent
          : null,
      started: tasks.some((task) => task.proposalId === proposal.id),
    }));

  return json({
    checkedAt,
    status,
    tasks,
    approvedProposals,
  });
}

export async function POST(request: NextRequest) {
  const gate = await adminGate(request);
  if (gate.response) return gate.response;

  const body = await readBody(request);
  if (!body) return json({ error: 'Invalid JSON body.' }, 400);

  const proposalId = typeof body.proposalId === 'string' ? body.proposalId.trim() : '';
  if (!proposalId) return json({ error: 'proposalId is required.' }, 400);

  let proposal: ProposalRecord | null;
  try {
    proposal = await getProposal(db, proposalId);
  } catch (error) {
    console.error('[opencode] proposal read failed', error);
    return json({ error: 'The approved proposal could not be read.' }, 503);
  }

  if (!proposal) return json({ error: 'That proposal does not exist.' }, 404);
  if (proposal.status !== 'approved') {
    return json({ error: 'This proposal has not been approved.' }, 409);
  }
  if (proposal.action?.type !== 'opencode_task') {
    return json({ error: 'This proposal is not an OpenCode task.' }, 409);
  }
  if (!proposal.approvedDigest || proposal.approvedDigest !== proposal.actionDigest) {
    return json({ error: 'The approved digest no longer matches this task.' }, 409);
  }

  const existing = await findOpenCodeTaskForProposal(db, proposal.id).catch(() => null);
  if (existing) {
    return json(
      {
        error: 'This approved plan already has an OpenCode task.',
        task: existing,
      },
      409,
    );
  }

  const params = proposal.action.params ?? {};
  const prompt = typeof params.task === 'string' ? params.task.trim() : '';
  if (!prompt) {
    return json({ error: 'The approved proposal contains no task prompt.' }, 400);
  }
  const agent = typeof params.agent === 'string' ? params.agent : null;
  const title =
    typeof params.title === 'string' && params.title.trim()
      ? params.title.trim()
      : proposal.title;

  try {
    const result = await startOpenCodeTask(db, {
      proposalId: proposal.id,
      title,
      prompt,
      agent,
      createdBy: gate.uid,
    });
    await writeAudit(db, {
      action: 'task_reported',
      actor: gate.uid,
      agentId: 'opencode',
      proposalId: proposal.id,
      taskKey: result.task.id,
      outcome: result.dispatched ? 'ok' : 'failed',
      note: result.dispatched ? 'approved OpenCode task started' : 'approved OpenCode task failed to dispatch',
    });
    return json({
      task: result.task,
      dispatched: result.dispatched,
      error: result.error,
      notice: result.dispatched
        ? 'OpenCode accepted the task. Watch it in the task centre.'
        : 'OpenCode created the session but did not accept the prompt. The task is marked failed.',
    });
  } catch (error) {
    console.error('[opencode] task start failed', error);
    const status = (error as { code?: string })?.code === 'not_configured' ? 503 : 502;
    return json({ error: publicError(error) }, status);
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await adminGate(request);
  if (gate.response) return gate.response;

  const body = await readBody(request);
  if (!body) return json({ error: 'Invalid JSON body.' }, 400);

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return json({ error: 'id is required.' }, 400);

  let task: OpenCodeTaskRecord | null;
  try {
    task = await getOpenCodeTask(db, id);
  } catch (error) {
    console.error('[opencode] task read failed', error);
    return json({ error: 'The task could not be read.' }, 503);
  }
  if (!task) return json({ error: 'Task not found.' }, 404);

  try {
    const updated = await abortOpenCodeTask(db, task);
    await writeAudit(db, {
      action: 'task_reported',
      actor: gate.uid,
      agentId: 'opencode',
      proposalId: updated.proposalId,
      taskKey: updated.id,
      outcome: 'ok',
      note: 'OpenCode task aborted by the founder',
    });
    return json({ task: updated, notice: 'OpenCode accepted the abort.' });
  } catch (error) {
    console.error('[opencode] abort failed', error);
    return json({ error: publicError(error) }, 502);
  }
}
