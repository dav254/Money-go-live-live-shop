import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '@/firebase/server';
import { buildBusinessLocation, type LocationDraft } from '@/lib/business/location';
import { canManage } from '@/lib/business/types';
import { resolveFreeTextPlace } from '@/lib/locations/match';

/**
 * SET THE BUSINESS'S PRIMARY LOCATION.
 *
 * This is the step that makes Nearby possible: until a business says where it
 * is, nothing can be ranked by distance and nothing can be matched to a
 * request in an area. Six businesses, none with a location, is the state the
 * measurement script found — so this is deliberately a small, first-class form
 * rather than an optional extra.
 *
 * ## What the server checks, not the client
 *
 *   - the caller is an owner or manager (`canManage`). Staff cannot move the
 *     shop's operating area, which is the whole point of a role distinction.
 *   - the area really is inside the chosen city — a mismatched pair is
 *     rejected rather than silently corrected, because a wrong pin on a map is
 *     worse than no pin.
 *   - coordinates are dropped for home-based and service businesses. The
 *     client is not asked to remember that; it cannot get it wrong.
 */

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    uid = decoded.uid || '';
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const businessId = String(id || '');
  if (!businessId) return NextResponse.json({ error: 'Business id is required' }, { status: 400 });

  let body: LocationDraft & { freeText?: { area?: string; subCounty?: string; cityTown?: string; county?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  try {
    const ref = db.collection('businesses').doc(businessId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const business = snap.data() as { members?: any[]; kind?: string };
    if (!canManage(business.members, uid)) {
      return NextResponse.json(
        { error: 'Only an owner or manager can change where this business works.' },
        { status: 403 },
      );
    }

    // Free text from the shop form is a fallback for sellers who have not
    // picked from the tree yet. It resolves to ids or to nothing — never to a
    // guess.
    const resolved = body.freeText ? resolveFreeTextPlace(body.freeText) : {};

    const { location, error } = buildBusinessLocation(
      { ...body, kind: (business.kind as LocationDraft['kind']) ?? null },
      resolved,
    );
    if (error || !location) {
      return NextResponse.json({ error: error || 'Could not build that location' }, { status: 422 });
    }

    await ref.set(
      { primaryLocation: location, locationCount: 1, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    return NextResponse.json({ location });
  } catch (err) {
    console.error('[business] location update failed', err);
    return NextResponse.json({ error: 'Could not save that location' }, { status: 500 });
  }
}
