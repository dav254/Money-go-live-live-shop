/**
 * /api/admin/opportunities — admin-only application review.
 *
 * GET  → list applications awaiting review (bounded, equality-only queries).
 * PUT  → explicit approve/reject transition for ONE application.
 *
 * Authorization: `verifyAdminUid` — the same admin definition every other
 * admin route uses (Bearer token; local role store first, then profile role).
 * The reviewer uid is ALWAYS the verified identity; the body cannot supply it.
 *
 * Review safety:
 *   • the decision is schema-validated (`.strict()` — no extra keys);
 *   • state transitions go through `canTransitionApplication`, so
 *     `approved → rejected` and `rejected → anything` are refused (409);
 *   • re-sending the same decision is an idempotent no-op (200, `changed:false`)
 *     and never records a second outcome event;
 *   • the transition runs inside a Firestore transaction, so two conflicting
 *     concurrent reviews cannot both win;
 *   • every applied review is written to the `securityEvents` audit trail.
 *
 * Approval records an outcome EVENT ONLY. It does not move money, does not
 * touch any wallet/balance and does not create ledger entries — the ledger is
 * design-only (src/lib/vidnov-core/trust/ledger.ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { logSecurityEvent, verifyAdminUid } from '@/lib/notifications/server-utils';
import {
  APPLICATIONS_COLLECTION,
  listApplications,
  reviewApplication,
  OpportunityError,
} from '@/lib/vidnov-core/opportunities/service';
import {
  pbListOpportunityApplications,
  pbMirrorOpportunityApplication,
} from '@/lib/pocketbase/opportunities';
import { APPLICATION_STATES } from '@/lib/vidnov-core/opportunities/types';
import { listApplicationsSchema, reviewApplicationRequestSchema } from '@/lib/vidnov-core/validation';

/** OpportunityError code → HTTP status. Everything unknown is a conflict. */
function statusFor(code: string): number {
  if (code === 'not_found') return 404;
  if (code === 'forbidden') return 403;
  return 409;
}

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const params = request.nextUrl.searchParams;
    const parsed = listApplicationsSchema.safeParse({
      state: params.get('state') ?? undefined,
      limit: params.get('limit') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query.' }, { status: 400 });
    }

    // Default view is the review queue; a caller may narrow to one state but
    // can never name an arbitrary field/value pair.
    const states = parsed.data.state ? [parsed.data.state] : APPLICATION_STATES;
    try {
      const items = await listApplications({ db, states, limit: parsed.data.limit });
      return NextResponse.json({ items, count: items.length, source: 'firestore' });
    } catch {
      // Firestore blocked/unreachable → the VPS mirror answers instead of an
      // error page. Reviews still require Firestore (transactional state
      // machine), but the queue stays visible.
      console.error('[core/opportunities] Firestore list failed — trying the VPS mirror');
      const mirrored = await pbListOpportunityApplications(states, parsed.data.limit);
      if (mirrored) {
        return NextResponse.json({ items: mirrored, count: mirrored.length, source: 'vps' });
      }
      throw new Error('unavailable');
    }
  } catch {
    console.error('[core/opportunities] admin list failed');
    return NextResponse.json({ error: 'Applications are temporarily unavailable.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const parsed = reviewApplicationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid review data.' }, { status: 400 });
  }

  const { applicationId, decision, reason } = parsed.data;

  try {
    const result = await reviewApplication({
      db,
      applicationId,
      decision,
      reviewerUid: adminUid,
      reason,
    });

    // Keep the VPS mirror in step with the decision — best-effort read-back
    // of the reviewed document, never fails the review itself.
    void db
      .collection(APPLICATIONS_COLLECTION)
      .doc(applicationId)
      .get()
      .then(async (snap) => {
        if (snap.exists) {
          await pbMirrorOpportunityApplication(
            applicationId,
            (snap.data() ?? {}) as Record<string, unknown>,
          );
        }
      })
      .catch(() => {});

    // Audit trail: who reviewed what, and whether anything actually changed.
    await logSecurityEvent({
      userId: adminUid,
      type: 'opportunity_application_reviewed',
      detail: { applicationId, decision, changed: result.changed },
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof OpportunityError) {
      return NextResponse.json({ error: err.message }, { status: statusFor(err.code) });
    }
    // No error objects in logs — internal details stay server-side only.
    console.error('[core/opportunities] review failed');
    return NextResponse.json({ error: 'Could not record the review.' }, { status: 500 });
  }
}
