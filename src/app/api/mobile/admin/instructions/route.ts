/**
 * /api/mobile/admin/instructions — the Instruction Desk.
 *
 * POST accepts an instruction, asks the model for a report, stores that report
 * and returns it. It does NOT execute anything; the stored document carries
 * `executed:false` and `proposedOnly:true` written by the server.
 *
 * A model failure still produces a failed report, so the history is truthful
 * about attempts instead of hiding them.
 */
import type { NextRequest } from 'next/server';
import {
  adminAiStoreAvailable,
  getReport,
  listReports,
  saveReport,
} from '@/lib/pocketbase/admin-ai';
import { adminGate, isStoreError, json, readBody } from '@/lib/admin-ai/http';
import { runInstruction } from '@/lib/admin-ai/instructions';
import { summarizeReport } from '@/lib/admin-ai/summary';
import { cleanText, isSafeModelName, MAX_INSTRUCTION_CHARS } from '@/lib/admin-ai/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const gate = await adminGate(request);
  if (gate.response) return gate.response;

  if (!adminAiStoreAvailable()) {
    return json({ reports: [], available: false, error: 'Report history is unavailable on this server.' });
  }

  const id = cleanText(request.nextUrl.searchParams.get('id'), 120);
  try {
    if (!id) {
      const rows = await listReports(gate.uid, 25);
      return json({ reports: rows.map(summarizeReport), available: true });
    }
    const report = await getReport(gate.uid, id);
    if (!report) return json({ error: 'Report not found.' }, 404);
    return json({ report, available: true });
  } catch (error) {
    if (!isStoreError(error)) console.error('[admin-ai/instructions] read failed', error);
    return json({ reports: [], available: false, error: 'Report history could not be read.' });
  }
}

export async function POST(request: NextRequest) {
  const gate = await adminGate(request);
  if (gate.response) return gate.response;

  const body = await readBody(request);
  if (!body) return json({ error: 'Invalid JSON body.' }, 400);

  const instruction = cleanText(body.instruction, MAX_INSTRUCTION_CHARS);
  if (!instruction) return json({ error: 'Write or paste an instruction first.' }, 400);

  const report = await runInstruction({
    instruction,
    ownerId: gate.uid,
    model: isSafeModelName(body.model) ? body.model : null,
  });

  let saved = false;
  if (adminAiStoreAvailable()) {
    try {
      await saveReport(report as unknown as Record<string, unknown>);
      saved = true;
    } catch (error) {
      if (!isStoreError(error)) console.error('[admin-ai/instructions] save failed', error);
    }
  }

  return json({ report, saved }, report.status === 'completed' ? 200 : 200);
}
