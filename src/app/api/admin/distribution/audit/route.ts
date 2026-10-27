/**
 * GET /api/admin/distribution/audit — the audit history (section 8).
 *
 * Admin-only, bounded limit (≤50), newest first. Entries are written
 * server-side by management actions and are append-only: there is no update
 * or delete path anywhere in the engine. Details are sanitized at write
 * time; actor is the verified admin uid from the token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import { listAudit } from '@/lib/vidnov-core/distribution/audit';
import { listAuditSchema } from '@/lib/vidnov-core/validation';

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const parsed = listAuditSchema.safeParse({
    limit: request.nextUrl.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid limit.' }, { status: 400 });
  }

  try {
    const entries = await listAudit(db, parsed.data.limit);
    return NextResponse.json({ entries, count: entries.length });
  } catch {
    // No error objects in logs — internal details stay server-side only.
    console.error('[core/distribution] audit list failed');
    return NextResponse.json({ error: 'Audit history unavailable.' }, { status: 500 });
  }
}
