/**
 * PATCH /api/admin/shop-agent/candidates/{id} — review & funnel actions.
 *
 * Actions (all admin-gated server-side, all schema-validated):
 *   • `approve` / `reject` — human review. Approval RE-runs the server-side
 *     rubric and is refused unless the rubric says `eligible`; scores from a
 *     request body are never read.
 *   • `analyze`      — recompute and persist the eligibility snapshot.
 *   • `link`         — link a registered Vidnov uid after verifying the
 *                      account actually exists.
 *   • `advance`      — funnel progression. `registered` / `shop_published` /
 *                      `product_published` are EVIDENCE-GATED: this route
 *                      verifies the claim against real profile / shop /
 *                      product documents before the service may move stage.
 *   • `suppress`     — add to the suppression list (cancels open messages).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import { isVisiblyHidden } from '@/lib/vidnov-core/distribution/eligibility';
import { candidatePatchSchema } from '@/lib/vidnov-core/shop-agent/schemas';
import {
  ShopAgentError,
  advanceStage,
  analyzeCandidate,
  evidenceSatisfied,
  getCandidate,
  reviewCandidate,
  suppressContact,
} from '@/lib/vidnov-core/shop-agent/service';

export const runtime = 'nodejs';

function errorStatus(code: ShopAgentError['code']): number {
  if (code === 'not_found') return 404;
  if (code === 'forbidden') return 403;
  return 400;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = candidatePatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const input = parsed.data;

  try {
    if (input.action === 'approve' || input.action === 'reject') {
      const candidate = await reviewCandidate(db, {
        candidateId: id,
        decision: input.action,
        actorUid: adminUid,
        note: input.note,
      });
      return NextResponse.json({ candidate });
    }

    if (input.action === 'analyze') {
      const candidate = await analyzeCandidate(db, id);
      return NextResponse.json({ candidate });
    }

    if (input.action === 'suppress') {
      const result = await suppressContact(db, {
        candidateId: id,
        reason: input.reason ?? 'manual',
        source: 'admin',
        actorUid: adminUid,
      });
      return NextResponse.json(result);
    }

    if (input.action === 'link') {
      if (!input.uid) return NextResponse.json({ error: 'A uid is required to link.' }, { status: 400 });
      const profile = await db.collection('userProfiles').doc(input.uid).get();
      if (!profile.exists) {
        return NextResponse.json({ error: 'No Vidnov account exists for that uid.' }, { status: 404 });
      }
      const nowIso = new Date().toISOString();
      await db.collection('shopAgentCandidates').doc(id).set(
        { linkedUid: input.uid, updatedAt: nowIso },
        { merge: true },
      );
      return NextResponse.json({ linkedUid: input.uid });
    }

    if (input.action === 'advance') {
      if (!input.stage) return NextResponse.json({ error: 'A target stage is required.' }, { status: 400 });
      const candidate = await getCandidate(db, id);
      if (!candidate) return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 });

      const uid = input.uid ?? candidate.linkedUid;
      const evidence = { uidExists: false, shopExists: false, visibleProductCount: 0 };
      if (uid) {
        const [profile, shop, products] = await Promise.all([
          db.collection('userProfiles').doc(uid).get(),
          db.collection('sellerShops').doc(uid).get(),
          db.collection('products').where('sellerId', '==', uid).limit(50).get(),
        ]);
        evidence.uidExists = profile.exists;
        evidence.shopExists = shop.exists;
        evidence.visibleProductCount = products.docs.filter(
          (d) => !isVisiblyHidden(d.data() as Record<string, unknown>),
        ).length;
        if (input.uid && profile.exists && candidate.linkedUid !== input.uid) {
          await db.collection('shopAgentCandidates').doc(id).set(
            { linkedUid: input.uid, updatedAt: new Date().toISOString() },
            { merge: true },
          );
        }
      }

      const updated = await advanceStage(db, {
        candidateId: id,
        to: input.stage,
        actorUid: adminUid,
        evidenceOk: evidenceSatisfied(input.stage, evidence),
      });
      return NextResponse.json({ candidate: updated });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    if (err instanceof ShopAgentError) {
      return NextResponse.json({ error: err.message }, { status: errorStatus(err.code) });
    }
    console.error('[shop-agent] candidate action failed');
    return NextResponse.json({ error: 'Action could not complete.' }, { status: 500 });
  }
}
