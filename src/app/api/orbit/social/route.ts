/**
 * GET /api/orbit/social — Social Engine readiness for agents.
 *
 * This is a READ of the existing engine: per-platform state, which env-var
 * NAMES are missing, approval state and the last recorded test. It exposes no
 * token, no connection secret and no upstream error body, and it cannot
 * publish: publishing stays on `/api/social-engine/*`, which requires an
 * admin session plus explicit confirmation.
 */
import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { readSocialSummary } from '@/lib/ai-headquarters/aggregates';
import { authorizeOrbitRequest, orbitErrorResponse } from '@/lib/ai-headquarters/orbit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await authorizeOrbitRequest(request, db, 'social:read');
    const summary = await readSocialSummary(process.env);
    return NextResponse.json({
      ...summary,
      note: 'Read-only. Publishing requires a founder-approved proposal and an admin session.',
    });
  } catch (error) {
    return orbitErrorResponse(error);
  }
}
