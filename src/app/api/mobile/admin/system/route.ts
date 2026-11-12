/**
 * GET /api/mobile/admin/system
 *
 * Every signal is probed on this request and carries its own `checkedAt`.
 * Services without configuration report UNKNOWN instead of being drawn green.
 */
import type { NextRequest } from 'next/server';
import { adminGate, json } from '@/lib/admin-ai/http';
import { collectSystemSignals } from '@/lib/admin-ai/status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const gate = await adminGate(request);
  if (gate.response) return gate.response;

  const snapshot = await collectSystemSignals();
  return json(snapshot);
}
