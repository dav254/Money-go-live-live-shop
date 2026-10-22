/**
 * SERVER-SIDE PROFILE ENSURE — the fix for "signed in but no profile".
 *
 * Signup used to create the profile with a CLIENT-side Firestore write. When
 * that write failed, the Auth account existed but `userProfiles/{uid}` did
 * not, so the surface boundary could not tell buyer from seller and showed
 * "We couldn't load your account" forever — two real sellers hit exactly
 * this. Profile creation is now server-side: the admin SDK writes Firestore
 * (bypassing client rules) and the same profile is mirrored to the local
 * PocketBase store on the VPS, so registration survives whatever happens to
 * Firestore.
 *
 * Rules of this module:
 *   • never destructive — an existing profile is only FILLED, never replaced
 *   • each store is written independently — a Firestore failure still leaves
 *     the VPS copy, and vice versa
 */

import { db } from '@/firebase/server';
import { pbGetProfile, pbUpsertProfile } from '@/lib/pocketbase/profiles';

export interface EnsureProfileInput {
  uid: string;
  role?: string;
  name?: string;
  email?: string;
  username?: string;
  phone?: string;
  profilePictureUrl?: string;
}

export interface EnsuredProfile {
  uid: string;
  email?: string;
  fullName?: string;
  username?: string;
  userRole?: string;
  status?: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
  joinDate?: string;
  /** True when this call had to create the profile (it did not exist). */
  created: boolean;
}

const ROLES = new Set(['buyer', 'seller', 'reseller', 'admin']);

/**
 * Ensures a profile exists for `uid` in BOTH stores and returns what the
 * account looks like now. Safe to call on every signup/welcome/repair hit.
 */
export async function ensureUserProfile(input: EnsureProfileInput): Promise<EnsuredProfile | null> {
  const { uid } = input;
  const role = ROLES.has(input.role ?? '') ? input.role! : undefined;
  const now = new Date().toISOString();

  // ---- Firestore: read first so we never clobber existing data. ----------
  let existing: Record<string, unknown> | null = null;
  try {
    const snap = await db.collection('userProfiles').doc(uid).get();
    existing = snap.exists ? (snap.data() ?? {}) : null;
  } catch (error) {
    console.error('[profile-ensure] Firestore read failed:', error);
  }

  const base: Record<string, unknown> = {
    id: uid,
    uid,
    fullName: input.name ?? '',
    username: input.username ?? (input.email ? input.email.split('@')[0] : `user_${uid.slice(0, 5)}`),
    email: input.email ?? existing?.email ?? '',
    joinDate: now,
    userRole: role ?? existing?.userRole ?? 'buyer',
    role: role ?? existing?.role ?? existing?.userRole ?? 'buyer',
    status: 'active',
    profilePictureUrl: input.profilePictureUrl ?? '',
  };
  // The seller welcome bonus — same numbers the signup screen used to write.
  const effectiveRole = String(base.userRole);
  if (effectiveRole === 'seller') {
    base.aiPoints = existing?.aiPoints ?? 1000;
    base.freePointsAwardedAt = existing?.freePointsAwardedAt ?? now;
  }
  if (input.phone) {
    base.phoneNumber = input.phone;
    base.phoneConsentAt = now;
  }

  let created = false;

  if (existing === null) {
    // Missing (or unreadable) → create it server-side.
    try {
      await db.collection('userProfiles').doc(uid).set(base, { merge: true });
      created = true;
    } catch (error) {
      console.error('[profile-ensure] Firestore write failed:', error);
    }
  } else if (
    role &&
    !ROLES.has(String(existing.userRole ?? existing.role ?? '')) &&
    typeof existing.userRole === 'undefined' &&
    typeof existing.role === 'undefined'
  ) {
    // A profile exists but carries no role at all — fill it in.
    try {
      await db
        .collection('userProfiles')
        .doc(uid)
        .set({ userRole: role, role }, { merge: true });
    } catch (error) {
      console.error('[profile-ensure] Firestore role fill failed:', error);
    }
  }

  // ---- PocketBase (VPS): always mirror / create, independent of Firestore.-
  await pbUpsertProfile(uid, {
    email: (base.email as string) || null,
    fullName: (base.fullName as string) || null,
    username: (base.username as string) || null,
    userRole: (base.userRole as string) || null,
    status: 'active',
    phoneNumber: (base.phoneNumber as string | undefined) ?? null,
    profilePictureUrl: (base.profilePictureUrl as string | undefined) ?? null,
    joinDate: now,
  });

  const merged: EnsuredProfile = {
    uid,
    email: (base.email as string) || undefined,
    fullName: (base.fullName as string) || undefined,
    username: (base.username as string) || undefined,
    userRole: (base.userRole as string) || undefined,
    status: 'active',
    phoneNumber: (base.phoneNumber as string | undefined) ?? undefined,
    profilePictureUrl: (base.profilePictureUrl as string | undefined) ?? undefined,
    joinDate: now,
    created,
  };
  return merged;
}

/**
 * Best-read of a profile for the signed-in user: Firestore first, the local
 * VPS store second. Null only when NEITHER store has the account.
 */
export async function readUserProfile(uid: string): Promise<EnsuredProfile | null> {
  try {
    const snap = await db.collection('userProfiles').doc(uid).get();
    if (snap.exists) {
      const data = (snap.data() ?? {}) as Record<string, unknown>;
      return {
        uid,
        email: (data.email as string) || undefined,
        fullName: (data.fullName as string) || undefined,
        username: (data.username as string) || undefined,
        userRole: (data.userRole as string) || (data.role as string) || undefined,
        status: (data.status as string) || 'active',
        phoneNumber: (data.phoneNumber as string) || undefined,
        profilePictureUrl: (data.profilePictureUrl as string) || undefined,
        joinDate: (data.joinDate as string) || undefined,
        created: false,
      };
    }
  } catch (error) {
    console.error('[profile-ensure] Firestore read failed:', error);
  }

  const pb = await pbGetProfile(uid);
  if (!pb) return null;
  return {
    uid,
    email: pb.email,
    fullName: pb.fullName,
    username: pb.username,
    userRole: pb.userRole,
    status: pb.status ?? 'active',
    phoneNumber: pb.phoneNumber,
    profilePictureUrl: pb.profilePictureUrl,
    joinDate: pb.joinDate,
    created: false,
  };
}
