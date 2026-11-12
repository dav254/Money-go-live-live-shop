/**
 * GET /api/mobile/admin/overview
 *
 * The Admin Home payload: the three connection signals the founder asked for
 * (assistant/Ollama, Paperclip, Vidnov), pending approvals and recent reports.
 *
 * Every value is probed at request time. A failed sub-probe degrades that card
 * only — the home screen still loads, and the card says what actually happened.
 */
import type { NextRequest } from 'next/server';
import { db } from '@/firebase/server';
import { listProposals } from '@/lib/ai-headquarters/proposals';
import { listReports, adminAiStoreAvailable } from '@/lib/pocketbase/admin-ai';
import { adminGate, isStoreError, json } from '@/lib/admin-ai/http';
import { publicOllamaConfig, publicPaperclipConfig } from '@/lib/admin-ai/config';
import { lastOllamaSuccess, ollamaSignal, opencodeSignal, paperclipSignal, vidnovSignal } from '@/lib/admin-ai/status';
import { summarizeReport } from '@/lib/admin-ai/summary';
import { publicError } from '@/lib/admin-ai/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const gate = await adminGate(request);
  if (gate.response) return gate.response;

  const [ollama, paperclip, opencode] = await Promise.all([
    ollamaSignal(),
    paperclipSignal(),
    opencodeSignal(),
  ]);

  let pending = 0;
  let approvalsAvailable = true;
  let approvalsError: string | null = null;
  try {
    const proposals = await listProposals(db, { limit: 50 });
    pending = proposals.filter((proposal) => proposal.status === 'pending').length;
  } catch (error) {
    approvalsAvailable = false;
    approvalsError = publicError(error);
    console.error('[admin-ai/overview] proposals read failed', error);
  }

  let reports: ReturnType<typeof summarizeReport>[] = [];
  let reportsAvailable = adminAiStoreAvailable();
  if (reportsAvailable) {
    try {
      const rows = await listReports(gate.uid, 5);
      reports = rows.map(summarizeReport);
    } catch (error) {
      reportsAvailable = false;
      if (!isStoreError(error)) console.error('[admin-ai/overview] reports read failed', error);
    }
  }

  const lastOkAt = await lastOllamaSuccess().catch(() => null);

  return json({
    admin: { uid: gate.uid },
    generatedAt: new Date().toISOString(),
    assistant: {
      state: ollama.state,
      model: publicOllamaConfig().model,
      detail: ollama.detail,
      lastOkAt,
    },
    checks: [ollama, paperclip, opencode, vidnovSignal()],
    configuration: {
      ollama: publicOllamaConfig(),
      paperclip: publicPaperclipConfig(),
      historyStore: adminAiStoreAvailable(),
    },
    approvals: {
      pending,
      available: approvalsAvailable,
      error: approvalsError,
    },
    reports: {
      items: reports,
      available: reportsAvailable,
    },
  });
}
