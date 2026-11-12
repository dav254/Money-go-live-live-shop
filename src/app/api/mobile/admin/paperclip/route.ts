/**
 * GET /api/mobile/admin/paperclip
 *
 * Returns what Paperclip actually reports, and nothing more. `agentsAvailable`
 * is false unless a real agent array was parsed; `activityAvailable`,
 * `reportsAvailable` and `pendingAvailable` stay false in Phase 1 because no
 * Paperclip endpoint for those has been verified.
 */
import type { NextRequest } from 'next/server';
import { adminGate, json } from '@/lib/admin-ai/http';
import { probePaperclip } from '@/lib/admin-ai/paperclip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const gate = await adminGate(request);
  if (gate.response) return gate.response;

  const status = await probePaperclip();
  return json(status);
}
