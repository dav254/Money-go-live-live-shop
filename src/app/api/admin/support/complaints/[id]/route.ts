import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * PUT  /api/admin/support/complaints/{id} — { status } (open | investigating | resolved | dismissed)
 * DELETE /api/admin/support/complaints/{id} — remove a report entirely.
 *
 * Both Admin-SDK only (see the list route for why moderation deliberately
 * does not depend on the deployed client rules).
 */

const VALID_STATUSES = ['open', 'investigating', 'resolved', 'dismissed'];

async function requireAdmin(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const { uid } = await auth.verifyIdToken(authHeader.split('Bearer ')[1]);
    const profile = await db.collection('userProfiles').doc(uid).get();
    if (profile.data()?.userRole !== 'admin') return null;
    return uid;
  } catch {
    return null;
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUid = await requireAdmin(request);
  if (!adminUid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Complaint ID is required' }, { status: 400 });
  }

  const { status } = (await request.json().catch(() => ({}))) as { status?: string };
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status provided' }, { status: 400 });
  }

  try {
    const ref = db.collection('complaints').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    await ref.update({
      status,
      resolvedAt: FieldValue.serverTimestamp(),
      reviewedBy: adminUid,
    });
    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error(`Error updating complaint ${id}:`, error);
    return NextResponse.json({ error: 'Could not update the complaint' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUid = await requireAdmin(request);
  if (!adminUid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Complaint ID is required' }, { status: 400 });
  }

  try {
    const ref = db.collection('complaints').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error deleting complaint ${id}:`, error);
    return NextResponse.json({ error: 'Could not delete the complaint' }, { status: 500 });
  }
}
