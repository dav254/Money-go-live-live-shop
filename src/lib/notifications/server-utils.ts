/**
 * Server-side helpers for auth & communication features.
 * Server-only: imports firebase-admin.
 */

import { NextRequest } from 'next/server';
import { db as firestoreDb, auth as adminAuth } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { createHash, randomBytes } from 'crypto';
import { pbIsAdmin } from '@/lib/pocketbase/admins';
import { pbSetAdmin } from '@/lib/pocketbase/admins';
import { pbGetProfile } from '@/lib/pocketbase/profiles';
import { isAdminByEnv } from '@/lib/server/admin-env';

/** The shared, initialized admin Firestore instance. */
export const db = firestoreDb;

/** Cryptographically random, single-use token. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Tokens are stored hashed — a database leak can't be replayed as a reset.
 * Raw tokens exist only inside the emailed link.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Coarse device label from the User-Agent — never exposes fingerprints. */
export function deviceLabelFromRequest(request: NextRequest): string {
  const ua = request.headers.get('user-agent') ?? '';
  if (/iphone|ipad/i.test(ua)) return 'iOS device';
  if (/android/i.test(ua)) return 'Android device';
  if (/edg\//i.test(ua)) return 'Edge on desktop';
  if (/chrome/i.test(ua)) return 'Chrome on desktop';
  if (/firefox/i.test(ua)) return 'Firefox on desktop';
  if (/safari/i.test(ua)) return 'Safari on desktop';
  return 'Other device';
}

export function requestIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/** Generic error envelope — never reveals whether an email exists. */
export function genericAuthResponse() {
  return {
    ok: true,
    message: 'If an account exists for this email, we have sent instructions.',
  };
}

/**
 * Verifies the caller is an authenticated admin (server-side authorization).
 * Returns the admin uid or null.
 */
export async function verifyAdminUid(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    // 0. ADMIN_EMAILS env allowlist — no database at all. The operator's own
    //    access must not depend on either store being healthy.
    if (isAdminByEnv(decoded.uid, decoded.email)) return decoded.uid;
    // 1. Local (VPS) admin grant — instant and independent of Firestore.
    if ((await pbIsAdmin(decoded.uid)) === true) return decoded.uid;
    // 2. Local (VPS) profile role — the mirrored copy survives a blocked
    //    Firestore, so an admin is never locked out of their own dashboard.
    if ((await pbGetProfile(decoded.uid))?.userRole === 'admin') return decoded.uid;
    // 3. Firestore profile — the legacy source, last because it is the one
    //    that fails when the project is blocked/out of quota.
    try {
      const profile = await firestoreDb.collection('userProfiles').doc(decoded.uid).get();
      if (profile.exists && profile.data()?.userRole === 'admin') {
        // SELF-HEAL: the first successful read mirrors the grant into the
        // local store, so every later request passes even if Firestore
        // blocks again mid-session. Fire-and-forget; mirrors what
        // scripts/promote-admin.ts writes.
        void pbSetAdmin(decoded.uid, true, {
          email: decoded.email ?? undefined,
          name: (profile.data()?.fullName as string | undefined) ?? undefined,
        }).catch(() => undefined);
        return decoded.uid;
      }
    } catch {
      // Blocked Firestore — the two VPS checks above already had their say.
    }
    return null;
  } catch {
    return null;
  }
}

/** Verifies any signed-in user from a Bearer token; returns uid or null. */
export async function verifyUserUid(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

/** Signed-in user context resolved from their profile (role, names). */
export interface UserContext {
  uid: string;
  email?: string;
  name?: string;
  /** Business/shop display name when the user is a seller. */
  businessName?: string;
  role?: string;
  isAdmin: boolean;
}

/**
 * Verifies a signed-in user AND resolves their profile context in one hop.
 * Use this for marketplace APIs that need role/name for authorization.
 */
export async function verifyUserContext(request: NextRequest): Promise<UserContext | null> {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    // Local (VPS) role store first — it decides admin on its own.
    const localAdmin = await pbIsAdmin(decoded.uid);
    // Profile is only for names/role display; a Firestore hiccup must not
    // invalidate a valid local admin grant.
    const profile = await firestoreDb
      .collection('userProfiles')
      .doc(decoded.uid)
      .get()
      .catch(() => null);
    const data = (profile?.data() ?? {}) as {
      email?: string;
      fullName?: string;
      displayName?: string;
      shopName?: string;
      userRole?: string;
      role?: string;
    };
    const role = data.userRole ?? data.role;
    return {
      uid: decoded.uid,
      email: data.email,
      name: data.fullName || data.displayName,
      businessName: data.shopName,
      role,
      isAdmin: localAdmin === true || role === 'admin',
    };
  } catch {
    return null;
  }
}

/** Appends a security event to the audit trail. */
export async function logSecurityEvent(event: {
  userId?: string;
  type: string;
  detail?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  try {
    await firestoreDb.collection('securityEvents').add({
      ...event,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('[security] failed to log event:', error);
  }
}
