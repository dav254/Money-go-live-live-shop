/**
 * GET /api/orbit/status — what an agent may know about itself and the system.
 *
 * Returns the agent's own identity and scopes, the honest model state
 * (`MODEL_NOT_CONFIGURED` until a real key exists), and a platform-level
 * summary of the Social Engine. It never returns a connection token, an env
 * value, a customer record or a business total.
 */
import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { readSocialSummary } from '@/lib/ai-headquarters/aggregates';
import { modelStatus } from '@/lib/ai-headquarters/model';
import { authorizeOrbitRequest, orbitErrorResponse } from '@/lib/ai-headquarters/orbit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const agent = await authorizeOrbitRequest(request, db, 'status:read');
    const social = await readSocialSummary(process.env).catch(() => null);

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        department: agent.department,
        role: agent.role,
        scopes: agent.scopes,
      },
      model: modelStatus(process.env),
      social: social
        ? {
            generatedAt: social.generatedAt,
            ready: social.ready,
            approvalRequired: social.approvalRequired,
            notConfigured: social.notConfigured,
            platformCount: social.platforms.length,
          }
        : { note: 'Social Engine status is unavailable right now.' },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return orbitErrorResponse(error);
  }
}
