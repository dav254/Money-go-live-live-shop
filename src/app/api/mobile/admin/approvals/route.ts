/**
 * /api/mobile/admin/approvals — the human approval gate.
 *
 * This is the existing Orbit proposal ledger (`ai_hq_proposals`), not a second
 * queue. Approving records the founder's decision against the exact digest
 * they reviewed; the proposal is still NOT executed here. Execution stays a
 * separate, already-guarded human action.
 *
 * GET  — pending proposals plus the policy the app displays.
 * POST — approve/reject one proposal, bound to the digest the phone showed.
 */
import type { NextRequest } from 'next/server';
import { db } from '@/firebase/server';
import { decideProposal, listProposals, ProposalError } from '@/lib/ai-headquarters/proposals';
import type { ProposalRecord } from '@/lib/ai-headquarters/types';
import { adminGate, json, readBody } from '@/lib/admin-ai/http';
import { cleanText } from '@/lib/admin-ai/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const APPROVAL_POLICY = {
  statement: 'Every action that modifies code, files, databases or production services needs the founder\'s approval.',
  noAutonomousExecution: true,
  allowedWithoutApproval: [
    'Read-only status and connection checks',
    'Reading agent, report and proposal records',
    'Generating text reports that change nothing',
  ],
  neverAutomatic: [
    'Delete files',
    'Modify production configuration',
    'Change database records',
    'Install software',
    'Restart services',
    'Deploy',
    'Commit or push code',
    'Execute arbitrary shell commands',
  ],
  approvalMustShow: ['Exact proposed action', 'Affected resources', 'Risk', 'Verification', 'Rollback plan'],
} as const;

function publicProposal(proposal: ProposalRecord) {
  return {
    id: proposal.id,
    kind: proposal.kind,
    title: proposal.title,
    summary: proposal.summary,
    action: proposal.action,
    actionDigest: proposal.actionDigest,
    requestedBy: proposal.requestedBy,
    status: proposal.status,
    createdAt: proposal.createdAt,
    decidedAt: proposal.decidedAt ?? null,
    decidedBy: proposal.decidedBy ?? null,
    decisionNote: proposal.decisionNote ?? null,
  };
}

export async function GET(request: NextRequest) {
  const gate = await adminGate(request);
  if (gate.response) return gate.response;

  try {
    const proposals = await listProposals(db, { limit: 50 });
    return json({
      pending: proposals.filter((proposal) => proposal.status === 'pending').map(publicProposal),
      policy: APPROVAL_POLICY,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[admin-ai/approvals] read failed', error);
    return json(
      {
        pending: [],
        policy: APPROVAL_POLICY,
        checkedAt: new Date().toISOString(),
        error: 'Approvals could not be read from Firestore.',
      },
      200,
    );
  }
}

export async function POST(request: NextRequest) {
  const gate = await adminGate(request);
  if (gate.response) return gate.response;

  const body = await readBody(request);
  if (!body) return json({ error: 'Invalid JSON body.' }, 400);

  const id = cleanText(body.id, 120);
  const decision = body.decision === 'approve' || body.decision === 'reject' ? body.decision : null;
  const digest = cleanText(body.digest, 128);
  if (!id || !decision) return json({ error: 'A proposal id and decision are required.' }, 400);
  if (decision === 'approve' && !digest) {
    return json({ error: 'The reviewed digest is required to approve a proposal.' }, 400);
  }

  try {
    const proposal = await decideProposal(db, {
      id,
      decision,
      actorUid: gate.uid,
      digest,
      note: body.note,
    });
    return json({
      proposal: publicProposal(proposal),
      // Stated explicitly so the app never shows "approved" as "done".
      executed: false,
      message:
        decision === 'approve'
          ? 'Approval recorded. The action itself has not been run — it still requires a human to execute it.'
          : 'Rejection recorded. Nothing was run.',
    });
  } catch (error) {
    if (error instanceof ProposalError) {
      const status =
        error.code === 'invalid_input'
          ? 400
          : error.code === 'forbidden'
            ? 403
            : error.code === 'not_found'
              ? 404
              : error.code === 'rate_limited'
                ? 429
                : 409;
      return json({ error: error.message }, status);
    }
    console.error('[admin-ai/approvals] decision failed', error);
    return json({ error: 'The decision could not be recorded.' }, 500);
  }
}
