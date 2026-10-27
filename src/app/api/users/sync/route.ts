import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyRequestUser } from '@/lib/media/api-auth';
import {
  USER_DATA_SUBCOLLECTION,
  pbDeleteUserDoc,
  pbMirrorUserDoc,
  type UserDataKind,
} from '@/lib/pocketbase/user-data';
import { scrubForPocketBase } from '@/lib/pocketbase/server';

export const runtime = 'nodejs';

const KINDS: UserDataKind[] = ['cart', 'paymentMethod', 'payoutMethod'];

/**
 * POST /api/users/sync { kind, id, action?: 'upsert' | 'delete' }
 *
 * Mirrors one document of a per-user subcollection to the VPS store:
 *
 *   cart          → `userProfiles/{uid}/cart/{id}`          (id = productId)
 *   paymentMethod → `userProfiles/{uid}/paymentMethods/{id}`
 *   payoutMethod  → `userProfiles/{uid}/payoutMethods/{id}`
 *
 * Called (fire-and-forget) by the cart, wallet and payout-method screens
 * after every write. Two properties make this safe to expose:
 *
 *   1. The path is ALWAYS built from the verified caller's uid — a request
 *      can name its own document and nothing else, so no caller can read,
 *      mirror or delete another account's cart or payment details. There is
 *      deliberately no "other user" escape hatch, not even for admins.
 *   2. The payload carries only the kind, the document id and the action —
 *      the server reads the authoritative Firestore document itself, so a
 *      tampered request cannot push forged content into the VPS store.
 *
 * Mirror failures never fail the caller's real write: the response is 200
 * once the request is well formed, with `mirrored: false` when the VPS write
 * did not happen.
 */
export async function POST(request: NextRequest) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    kind?: string;
    id?: string;
    action?: string;
  };
  const kind = KINDS.includes(body.kind as UserDataKind) ? (body.kind as UserDataKind) : null;
  if (!kind) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });

  const id = (body.id ?? '').toString();
  if (!id || id.length > 128 || id.includes('/')) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const action = body.action === 'delete' ? 'delete' : 'upsert';

  // Always the caller's own profile — never taken from the body.
  const ref = db
    .collection('userProfiles')
    .doc(user.uid)
    .collection(USER_DATA_SUBCOLLECTION[kind])
    .doc(id);

  if (action === 'delete') {
    // The Firestore doc may already be gone — drop the VPS copy anyway.
    const mirrored = await pbDeleteUserDoc(kind, user.uid, id);
    return NextResponse.json({ ok: true, mirrored });
  }

  const snap = await ref.get().catch(() => null);
  if (!snap) return NextResponse.json({ mirrored: false, reason: 'read-failed' });
  if (!snap.exists) return NextResponse.json({ mirrored: false, reason: 'missing' });

  const data = (snap.data() ?? {}) as Record<string, unknown>;
  const mirrored = await pbMirrorUserDoc(
    kind,
    user.uid,
    id,
    scrubForPocketBase(data) as Record<string, unknown>,
  );
  return NextResponse.json({ ok: true, mirrored });
}
