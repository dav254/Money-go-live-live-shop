/**
 * POST /api/opportunities/{id}/apply — authenticated application.
 *
 * The applicant uid comes from the verified Bearer token; the body carries
 * only an optional note. Applying twice resolves to the SAME application
 * (deterministic id), so a double-tap is a no-op, not a duplicate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { applyToOpportunity, OpportunityError } from '@/lib/vidnov-core/opportunities/service';
import { applyToOpportunitySchema } from '@/lib/vidnov-core/validation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await verifyUserContext(request);
  if (!ctx) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const { id } = await params;
  if (!id || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid opportunity id.' }, { status: 400 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {}; // note is optional — an empty body is fine
  }
  const parsed = applyToOpportunitySchema.safeParse(body ?? {});
  if (!parsed.success) return NextResponse.json({ error: 'Invalid application data.' }, { status: 400 });

  try {
    const result = await applyToOpportunity({
      db,
      opportunityId: id,
      applicantUid: ctx.uid,
      note: parsed.data.note,
    });
    return NextResponse.json(result, { status: result.alreadyApplied ? 200 : 201 });
  } catch (err) {
    if (err instanceof OpportunityError) {
      const status = err.code === 'not_found' ? 404 : err.code === 'forbidden' ? 403 : 409;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error('[core/opportunities] apply failed');
    return NextResponse.json({ error: 'Could not submit the application.' }, { status: 500 });
  }
}
