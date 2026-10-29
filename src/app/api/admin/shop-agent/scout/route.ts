/**
 * POST /api/admin/shop-agent/scout — run one bounded discovery pass.
 *
 * `action: 'places'`   — official Google Places API (New) Nearby Search for
 *                        the configured pilot area (no key ⇒ honest
 *                        `not_configured`, zero network calls).
 * `action: 'manual'`   — ingest an admin-supplied lead with an attested
 *                        contact basis.
 *
 * Ingest is deduplicated structurally (deterministic candidate ids), source
 * attribution and retention deadlines are stamped server-side, and raw
 * provider payloads are never stored.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import { normalizeManualLead, runPlacesScout, toCandidateRecord } from '@/lib/vidnov-core/shop-agent/scout';
import { ingestCandidates } from '@/lib/vidnov-core/shop-agent/service';
import { scoutRequestSchema } from '@/lib/vidnov-core/shop-agent/schemas';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const parsed = scoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid scout request.' }, { status: 400 });
  }
  const input = parsed.data;

  try {
    if (input.action === 'manual') {
      if (!input.lead) return NextResponse.json({ error: 'A lead is required for manual entry.' }, { status: 400 });
      const record = toCandidateRecord(normalizeManualLead(input.lead));
      const result = await ingestCandidates(db, [record], adminUid);
      return NextResponse.json({ status: 'ok', ...result });
    }

    const run = await runPlacesScout(input);
    if (run.status !== 'ok') {
      // not_configured / error are honest outcomes, not exceptions: the body
      // says exactly what happened and no candidates were stored.
      return NextResponse.json({
        status: run.status,
        message: run.message,
        added: 0,
        duplicates: 0,
      });
    }

    const records = run.candidates.map((candidate) => toCandidateRecord(candidate));
    const result = await ingestCandidates(db, records, adminUid);
    return NextResponse.json({ status: 'ok', found: run.found, ...result });
  } catch {
    console.error('[shop-agent] scout run failed');
    return NextResponse.json({ error: 'Scout run failed.' }, { status: 500 });
  }
}
