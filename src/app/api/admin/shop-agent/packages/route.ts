/**
 * POST /api/admin/shop-agent/packages — draft marketing packages & assets.
 *
 *   • `action: 'generate'`  — build the personalised invitation package for an
 *     eligible candidate and queue its message for human approval
 *     (deterministic ids ⇒ double-clicks are no-ops).
 *   • `action: 'poster'`    — generate the Vidnov-branded poster mockup via
 *     fal.ai. REQUIRES `confirm: true`: paid provider credit is only ever
 *     spent on an explicit, human-confirmed request. Without FAL_KEY the
 *     asset is recorded as `not_configured` and nothing is spent.
 *
 * GET returns a bounded list of packages for the Control Center.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import { getVidnovConfig } from '@/lib/notifications/config';
import { generateOutreachPoster, outreachProviderStatuses } from '@/lib/vidnov-core/shop-agent/providers';
import { packageActionSchema } from '@/lib/vidnov-core/shop-agent/schemas';
import { posterPrompt } from '@/lib/vidnov-core/shop-agent/messages';
import {
  PACKAGES_COLLECTION,
  outreachSecret,
} from '@/lib/vidnov-core/shop-agent/types';
import {
  ShopAgentError,
  createPackage,
  getCandidate,
  recordAsset,
} from '@/lib/vidnov-core/shop-agent/service';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const snap = await db.collection(PACKAGES_COLLECTION).limit(100).get();
    return NextResponse.json({ packages: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch {
    console.error('[shop-agent] package list failed');
    return NextResponse.json({ error: 'Packages unavailable.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const parsed = packageActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const input = parsed.data;

  try {
    if (input.action === 'generate') {
      const result = await createPackage(db, {
        candidateId: input.candidateId,
        actorUid: adminUid,
        secret: outreachSecret(),
        siteOrigin: getVidnovConfig().appUrl.replace(/\/$/, ''),
      });
      return NextResponse.json(result);
    }

    // Poster generation — explicit confirmation gate before any spend.
    if (input.confirm !== true) {
      return NextResponse.json(
        { error: 'Poster generation requires confirm: true — it spends provider credit.' },
        { status: 400 },
      );
    }
    const candidate = await getCandidate(db, input.candidateId);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 });

    const record = await generateOutreachPoster(posterPrompt(candidate), adminUid);
    const packagesSnap = await db
      .collection(PACKAGES_COLLECTION)
      .where('candidateId', '==', candidate.id)
      .limit(1)
      .get();
    const pkg = packagesSnap.docs[0];
    if (!pkg) {
      return NextResponse.json({ error: 'Generate the package before creating a poster.' }, { status: 404 });
    }
    const updated = await recordAsset(db, {
      packageId: pkg.id,
      asset: 'poster',
      record,
      actorUid: adminUid,
    });
    return NextResponse.json({
      poster: record,
      provider: outreachProviderStatuses().poster,
      packageId: updated.id,
    });
  } catch (err) {
    if (err instanceof ShopAgentError) {
      const status = err.code === 'not_found' ? 404 : err.code === 'forbidden' ? 403 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error('[shop-agent] package action failed');
    return NextResponse.json({ error: 'Action could not complete.' }, { status: 500 });
  }
}
