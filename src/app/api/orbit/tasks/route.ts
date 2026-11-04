/**
 * /api/orbit/tasks — the worker's run ledger.
 *
 *   GET  — the caller's own runs plus a status/usage roll-up,
 *   POST — report one execution of one task (`tasks:report`).
 *
 * This is the Vidnov half of the Paperclip → Hermes → Vidnov chain: Paperclip
 * assigns, Hermes executes, and the worker reports here so the founder has a
 * record that the work actually happened, with what result, and whether a real
 * model produced it. `(taskKey, attempt)` is unique, so a worker that restarts
 * mid-task can retry the same attempt without duplicating history.
 *
 * Reporting a run executes nothing on Vidnov. It writes one ledger row.
 */
import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { authorizeOrbitRequest, orbitErrorResponse } from '@/lib/ai-headquarters/orbit';
import { listTaskRuns, reportTaskRun, summarizeRuns } from '@/lib/ai-headquarters/tasks';
import { HQ_LIMITS } from '@/lib/ai-headquarters/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const agent = await authorizeOrbitRequest(request, db, 'tasks:read');
    const runs = await listTaskRuns(db, { agentId: agent.id, limit: HQ_LIMITS.taskListLimit });
    return NextResponse.json({
      agent: { id: agent.id, name: agent.name, department: agent.department },
      summary: summarizeRuns(runs),
      runs,
    });
  } catch (error) {
    return orbitErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const agent = await authorizeOrbitRequest(request, db, 'tasks:report');

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'invalid_input', message: 'Invalid JSON body.' },
        { status: 400 },
      );
    }

    const input = (body ?? {}) as Record<string, unknown>;
    const { run, duplicate } = await reportTaskRun(db, agent, {
      taskKey: input.taskKey,
      attempt: input.attempt,
      title: input.title,
      status: input.status,
      summary: input.summary,
      result: input.result,
      error: input.error,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationMs: input.durationMs,
      model: input.model,
      mock: input.mock,
    });

    return NextResponse.json(
      {
        run,
        duplicate,
        note: duplicate
          ? 'This attempt was already recorded — history is append-only and was not overwritten.'
          : 'Recorded. Reporting a run does not grant any Vidnov permission.',
      },
      { status: duplicate ? 200 : 201 },
    );
  } catch (error) {
    return orbitErrorResponse(error);
  }
}
