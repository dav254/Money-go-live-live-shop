/**
 * ADMIN AI — instruction engine.
 *
 * An instruction is a REQUEST FOR A REPORT, not a task runner. There is no
 * code path here that writes a file, touches a database, restarts anything or
 * runs a shell command — and the stored report says so in every field that
 * could otherwise be misread:
 *
 *   executed: false
 *   proposedOnly: true
 *   filesInspected / filesChanged: []
 *   verification: "Not run …"
 *
 * The model is asked for findings and proposed actions only. If the founder
 * wants an action performed, it must be proposed, reviewed and approved by a
 * human — Phase 2's approval ledger is where that will land.
 */

import { chatWithOllama } from './ollama';
import {
  buildReport,
  cleanText,
  MAX_INSTRUCTION_CHARS,
  publicError,
  titleFromMessage,
  type CheckState,
  type ReportDraft,
} from './validate';

export const CHAT_SYSTEM_PROMPT = [
  'You are the Vidnov engineering assistant, speaking to the founder inside the Vidnov admin Android app.',
  'Vidnov is a Kenyan online marketplace (Next.js + Firebase + PocketBase backend, Expo Android app).',
  'You have NO ability to read files, run commands, change databases, deploy or modify anything.',
  'You may use the supplied project memory to explain what was already approved, completed or failed. You may prepare a plan; the founder approves it, and only then can OpenCode run an approved coding task in its isolated workspace.',
  'Never claim or imply that you performed an action, started OpenCode or saw a test result that is not in the supplied memory. You may analyse, explain, draft code and propose steps.',
  'Answer for a phone screen: short paragraphs, concrete file or endpoint names only when you are confident.',
  'If you are uncertain or lack information, say so plainly instead of inventing it.',
].join(' ');

export const INSTRUCTION_SYSTEM_PROMPT = [
  'You are the Vidnov technical analyst for the founder.',
  'You are READ-ONLY: you cannot access the repository, run commands, edit files, change databases, deploy or restart services.',
  'Produce a structured technical report using exactly these headings:',
  'SUMMARY, FINDINGS, PROPOSED ACTIONS, RISKS, VERIFICATION PLAN, NEXT STEP.',
  'Under PROPOSED ACTIONS, list concrete changes as proposals only. Do not state that anything was done.',
  'Under VERIFICATION PLAN, say what a human should run or check to prove the change works.',
  'Under NEXT STEP, give one sentence starting with "Next step:".',
  'If the instruction requires information you do not have, list it as an open question rather than guessing.',
].join('\n');

export interface InstructionReport extends ReportDraft {
  ownerId: string;
}

function newReportId(): string {
  return `ai_report_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Runs one instruction and always returns a report — including when the model
 * is unreachable. A failed task must be visible in the report history, not
 * swallowed into a toast the founder will never see again.
 */
export async function runInstruction(input: {
  instruction: string;
  ownerId: string;
  env?: Record<string, string | undefined>;
  model?: string | null;
}): Promise<InstructionReport> {
  const instruction = cleanText(input.instruction, MAX_INSTRUCTION_CHARS);
  const id = newReportId();
  const startedAt = new Date().toISOString();

  if (!instruction) {
    return {
      ...buildReport({
        id,
        title: 'Empty instruction',
        instruction: '',
        model: input.model ?? 'unknown',
        status: 'failed',
        result: '',
        error: 'No instruction was provided.',
        startedAt,
        completedAt: new Date().toISOString(),
      }),
      ownerId: input.ownerId,
    };
  }

  try {
    const reply = await chatWithOllama({
      env: input.env,
      model: input.model,
      messages: [
        { role: 'system', content: INSTRUCTION_SYSTEM_PROMPT },
        { role: 'user', content: instruction },
      ],
    });

    return {
      ...buildReport({
        id,
        title: titleFromMessage(instruction),
        instruction,
        model: reply.model,
        status: 'completed',
        result: reply.content,
        startedAt,
        completedAt: new Date().toISOString(),
        latencyMs: reply.latencyMs,
      }),
      ownerId: input.ownerId,
    };
  } catch (error) {
    return {
      ...buildReport({
        id,
        title: titleFromMessage(instruction),
        instruction,
        model: input.model ?? 'unknown',
        status: 'failed',
        result: '',
        error: publicError(error),
        startedAt,
        completedAt: new Date().toISOString(),
      }),
      ownerId: input.ownerId,
    };
  }
}

/** The status colour the app shows for a model probe. Kept next to the rules. */
export function stateLabel(state: CheckState): string {
  if (state === 'online') return 'ONLINE';
  if (state === 'degraded') return 'DEGRADED';
  if (state === 'offline') return 'OFFLINE';
  return 'UNKNOWN';
}
