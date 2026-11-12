/**
 * POST /api/mobile/admin/intelligence/plan
 *
 * Vidnov Intelligence turns a founder request into an approval proposal for
 * an OpenCode coding task. The model sees bounded project memory (recent
 * reports, decisions and task outcomes), but it still cannot execute anything.
 * Only the approval route can mark the resulting proposal approved, and only
 * the OpenCode start route can create a session.
 */
import type { NextRequest } from 'next/server';

import { db } from '@/firebase/server';
import { adminGate, json, readBody } from '@/lib/admin-ai/http';
import { chatWithOllama } from '@/lib/admin-ai/ollama';
import { projectMemory } from '@/lib/admin-ai/project-memory';
import { cleanLine, cleanText, isSafeModelName, publicError } from '@/lib/admin-ai/validate';
import { createAdminProposal } from '@/lib/ai-headquarters/proposals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_REQUEST = 8_000;

const PLANNER_PROMPT = [
  'You are Vidnov Intelligence, the founder-facing engineering planner inside the Vidnov admin Android app.',
  'Vidnov is a Kenyan online marketplace built with Next.js, Firebase, PocketBase and an Expo Android app.',
  'You cannot read files, run commands, deploy, change databases or execute work. You prepare a plan for OpenCode, a separate coding agent, and the founder must approve it first.',
  'Use the supplied project memory only as context. Do not claim that earlier work was executed unless the memory says it was completed.',
  'Return exactly these headings, in this order, with no preamble:',
  'TITLE: one short line',
  'PLAN: a short numbered plan (maximum 8 steps)',
  'TASK: a self-contained prompt for the coding agent. Include the goal, likely files or areas, constraints, acceptance criteria, tests to run, and the fact that deployment, destructive actions and credential changes are forbidden.',
  'VERIFICATION: the exact checks a human should run after OpenCode finishes.',
  'Do not include secrets, tokens, passwords or internal chain-of-thought. Do not say you performed anything.',
].join('\n');

function section(text: string, label: string, nextLabels: string[]): string {
  const next = nextLabels.length ? `(?=\\n(?:${nextLabels.join('|')}):|$)` : '(?=$)';
  const match = text.match(new RegExp(`(?:^|\\n)${label}:\\s*([\\s\\S]*?)${next}`, 'i'));
  return match?.[1]?.trim() ?? '';
}

export async function POST(request: NextRequest) {
  const gate = await adminGate(request);
  if (gate.response) return gate.response;

  const body = await readBody(request);
  if (!body) return json({ error: 'Invalid JSON body.' }, 400);

  const requestText = cleanText(body.request, MAX_REQUEST);
  if (requestText.length < 8) {
    return json({ error: 'Describe the development request first.' }, 400);
  }
  const requestedTitle = cleanLine(body.title, 120);
  const requestedAgent = typeof body.agent === 'string' ? cleanLine(body.agent, 120) : '';
  const agent =
    requestedAgent && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,120}$/.test(requestedAgent)
      ? requestedAgent
      : null;
  const model = isSafeModelName(body.model) ? body.model : null;

  const memory = await projectMemory(gate.uid);
  let reply;
  try {
    reply = await chatWithOllama({
      model,
      messages: [
        { role: 'system', content: PLANNER_PROMPT },
        {
          role: 'user',
          content: `PROJECT MEMORY\n${memory}\n\nFOUNDER REQUEST\n${requestText}`,
        },
      ],
    });
  } catch (error) {
    console.error('[intelligence/plan] model call failed', error);
    const status = (error as { code?: string })?.code === 'not_configured' ? 503 : 502;
    return json({ error: publicError(error) }, status);
  }

  const planText = cleanText(reply.content, 12_000);
  const title =
    cleanLine(section(planText, 'TITLE', ['PLAN', 'TASK', 'VERIFICATION']), 120) ||
    requestedTitle ||
    cleanLine(requestText, 100) ||
    'Vidnov development task';
  const taskText =
    cleanText(section(planText, 'TASK', ['VERIFICATION']), 3_000) ||
    cleanText(planText, 3_000);
  const plan = cleanText(section(planText, 'PLAN', ['TASK', 'VERIFICATION']), 2_000) || planText.slice(0, 2_000);
  const verification = cleanText(section(planText, 'VERIFICATION', []), 700);

  if (!taskText) {
    return json({ error: 'The planner returned no usable task prompt.' }, 502);
  }

  try {
    const proposal = await createAdminProposal(db, {
      uid: gate.uid,
      title,
      summary: plan,
      action: {
        type: 'opencode_task',
        params: {
          title,
          task: taskText,
          plan,
          verification,
          request: requestText.slice(0, 900),
          ...(agent ? { agent } : {}),
        },
      },
    });

    return json({
      proposal,
      plan: planText,
      task: taskText,
      title,
      model: reply.model,
      latencyMs: reply.latencyMs,
      notice: 'Plan prepared. Approve it in the approval inbox before starting the OpenCode task.',
    });
  } catch (error) {
    console.error('[intelligence/plan] proposal write failed', error);
    return json({ error: publicError(error) }, 500);
  }
}
