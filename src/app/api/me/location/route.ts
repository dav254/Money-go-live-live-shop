import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '@/firebase/server';
import {
  customerLocationFromLabel,
  customerLocationFromPoint,
  customerLocationFromTreeId,
  isValidPoint,
  type CustomerLocation,
} from '@/lib/locations/customer';

/**
 * THE CUSTOMER'S OWN LOCATION.
 *
 * ## Why this is a route and not a client write
 *
 * Two reasons, and the first is the one that matters.
 *
 * A client's coordinates are **untrusted input**. Sending them straight into a
 * `setDoc` would let anyone store `{ lat: 0, lng: 0 }` or `NaN` on their
 * profile, and the result is a customer who silently matches nothing, with no
 * error anywhere. Validating here means the shape is guaranteed on read.
 *
 * The second is that this decides where to write. The uid comes from the
 * verified token and nowhere else — the body has no `uid` field, so there is
 * nothing to tamper with.
 *
 * ## Why it is the user's own document
 *
 * Coarse coordinates are stored so a customer who opens the app tomorrow is
 * still in Westlands. They live on the user's own profile and are never read
 * into a business-facing payload — `publicCustomerLocation` is the only shape
 * that crosses that line.
 */

export const dynamic = 'force-dynamic';

async function readUid(request: Request): Promise<string | null> {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded.uid || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const uid = await readUid(request);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const snap = await db.collection('userProfiles').doc(uid).get();
    const loc = snap.data()?.location as CustomerLocation | undefined;
    return NextResponse.json({ location: loc ?? null });
  } catch (error) {
    console.error('[me] location read failed', error);
    return NextResponse.json({ error: 'Could not read your location' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const uid = await readUid(request);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { mode?: string; lat?: unknown; lng?: unknown; areaOrCityId?: unknown; label?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const mode = String(body?.mode || '');

  let location: CustomerLocation | null = null;

  if (mode === 'gps') {
    const point = { lat: Number(body.lat), lng: Number(body.lng) };
    if (!isValidPoint(point)) {
      return NextResponse.json({ error: 'Those coordinates are not a real point.' }, { status: 422 });
    }
    location = customerLocationFromPoint(point);
  } else if (mode === 'tree') {
    const id = String(body.areaOrCityId || '');
    location = id ? customerLocationFromTreeId(id) : null;
    if (!location) {
      return NextResponse.json({ error: 'Choose a place from the list.' }, { status: 422 });
    }
  } else if (mode === 'label') {
    const label = String(body.label || '');
    const point =
      body.lat !== undefined && body.lat !== null && body.lng !== undefined && body.lng !== null
        ? { lat: Number(body.lat), lng: Number(body.lng) }
        : undefined;
    if (point && !isValidPoint(point)) {
      return NextResponse.json({ error: 'Those coordinates are not a real point.' }, { status: 422 });
    }
    location = customerLocationFromLabel(label, point);
    if (!location) {
      return NextResponse.json({ error: 'Type the name of your area.' }, { status: 422 });
    }
  } else if (mode === 'clear') {
    await db.collection('userProfiles').doc(uid).set(
      { location: FieldValue.delete() },
      { merge: true },
    );
    return NextResponse.json({ location: null });
  } else {
    return NextResponse.json({ error: 'Unknown mode.' }, { status: 400 });
  }

  try {
    await db.collection('userProfiles').doc(uid).set(
      { location: { ...location, updatedAt: new Date().toISOString() } },
      { merge: true },
    );
    return NextResponse.json({ location });
  } catch (error) {
    console.error('[me] location write failed', error);
    return NextResponse.json({ error: 'Could not save your location' }, { status: 500 });
  }
}
