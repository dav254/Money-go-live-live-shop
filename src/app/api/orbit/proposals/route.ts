/**
 * /api/orbit/proposals — an agent's only way to ask for something.
 *
 *   GET  — the caller's own proposals (never anyone else's),
 *   POST — file a proposal. Requires the scope the kind demands, freezes the
 *          action into a digest, and returns a PENDING record.
 *
 * Creating a proposal executes nothing. Publishing a social post still needs
 * a founder decision AND a human running the existing Social Engine route.
 */
import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { authenticateOrbitRequest, orbitErrorResponse } from '@/lib/ai-headquarters/orbit';
import { createProposal, listProposals } from '@/lib/ai-headquarters/proposals';
import { HQ_LIMITS } from '@/lib/ai-headquarters/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const agent = await authenticateOrbitRequest(request, db);
    const proposals = await listProposals(db, { agentId: agent.id, limit: HQ_LIMITS.listLimit });
    return NextResponse.json({
      proposals: proposals.map((p) => ({
        id: p.id,
        kind: p.kind,
        title: p.title,
        status: p.status,
        actionDigest: p.actionDigest,
        createdAt: p.createdAt,
        decidedAt: p.decidedAt,
        decisionNote: p.decisionNote,
      })),
    });
  } catch (error) {
    return orbitErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const agent = await authenticateOrbitRequest(request, db);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'invalid_input', message: 'Invalid JSON body.' }, { status: 400 });
    }

    const input = (body ?? {}) as Record<string, unknown>;
    const proposal = await createProposal(db, agent, {
      kind: input.kind,
      title: input.title,
      summary: input.summary,
      action: input.action,
    });

    return NextResponse.json(
      {
        proposal: {
          id: proposal.id,
          kind: proposal.kind,
          title: proposal.title,
          status: proposal.status,
          actionDigest: proposal.actionDigest,
          createdAt: proposal.createdAt,
        },
        note: 'Pending founder decision. Approval does not execute anything by itself.',
      },
      { status: 201 },
    );
  } catch (error) {
    return orbitErrorResponse(error);
  }
}
