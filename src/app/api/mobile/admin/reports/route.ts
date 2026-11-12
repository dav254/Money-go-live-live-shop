/**
 * GET /api/mobile/admin/reports — Task Reports.
 *
 * ?id= returns one complete report; without it, a bounded list of summaries.
 * Lists never include the full model output: a report can be long and the
 * history screen does not need it.
 */
import type { NextRequest } from 'next/server';
import { adminAiStoreAvailable, getReport, listReports } from '@/lib/pocketbase/admin-ai';
import { adminGate, isStoreError, json } from '@/lib/admin-ai/http';
import { summarizeReport } from '@/lib/admin-ai/summary';
import { cleanText } from '@/lib/admin-ai/validate';

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
      const rows = await listReports(gate.uid, 30);
      return json({ reports: rows.map(summarizeReport), available: true });
    }
    const report = await getReport(gate.uid, id);
    if (!report) return json({ error: 'Report not found.' }, 404);
    return json({ report, available: true });
  } catch (error) {
    if (!isStoreError(error)) console.error('[admin-ai/reports] read failed', error);
    return json({ reports: [], available: false, error: 'Report history could not be read.' });
  }
}
