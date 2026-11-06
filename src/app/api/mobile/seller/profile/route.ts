import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyRequestUser } from '@/lib/media/api-auth';
import { readUserProfile } from '@/lib/auth/profile-ensure';
import { pbUpsertProfile } from '@/lib/pocketbase/profiles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/mobile/seller/profile — the seller's own account details.
 *
 * Only three things are editable here: display name, phone number and bio, plus
 * the avatar (already uploaded through the media pipeline). Email, role and any
 * verification state are server-owned — a phone must not be able to relabel
 * itself as a verified business, and changing the address that receives account
 * mail is an identity operation, not a profile edit.
 */

const MEDIA_OR_HTTPS = /^(\/api\/media\/|https?:\/\/)/i;

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function PATCH(request: Request) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    fullName?: unknown;
    phoneNumber?: unknown;
    bio?: unknown;
    profilePictureUrl?: unknown;
  };

  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (body.fullName !== undefined) {
    const fullName = text(body.fullName, 80);
    if (fullName.length < 2) {
      return NextResponse.json({ error: 'Enter your name (at least 2 characters).' }, { status: 400 });
    }
    patch.fullName = fullName;
  }

  if (body.phoneNumber !== undefined) {
    const phone = text(body.phoneNumber, 24);
    if (phone && !/^\+?[0-9 ()-]{7,20}$/.test(phone)) {
      return NextResponse.json({ error: 'That phone number looks incomplete.' }, { status: 400 });
    }
    patch.phoneNumber = phone;
  }

  if (body.bio !== undefined) {
    patch.bio = text(body.bio, 500);
  }

  if (body.profilePictureUrl !== undefined) {
    const url = text(body.profilePictureUrl, 500);
    if (url && !MEDIA_OR_HTTPS.test(url)) {
      return NextResponse.json({ error: 'That image address is not a Vidnov upload.' }, { status: 400 });
    }
    patch.profilePictureUrl = url;
  }

  let saved = false;
  try {
    await db.collection('userProfiles').doc(user.uid).set(patch, { merge: true });
    saved = true;
  } catch (error) {
    console.error('[mobile/seller/profile] Firestore write failed:', error);
  }

  const mirrored = await pbUpsertProfile(user.uid, {
    ...(typeof patch.fullName === 'string' ? { fullName: patch.fullName } : {}),
    ...(typeof patch.phoneNumber === 'string' ? { phoneNumber: patch.phoneNumber } : {}),
    ...(typeof patch.profilePictureUrl === 'string'
      ? { profilePictureUrl: patch.profilePictureUrl }
      : {}),
  });

  if (!saved && !mirrored) {
    return NextResponse.json(
      { error: 'Could not save your profile. Check your connection and try again.' },
      { status: 503 },
    );
  }

  const profile = await readUserProfile(user.uid);
  return NextResponse.json({ ok: true, profile });
}
