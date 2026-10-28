import { getAuth } from 'firebase-admin/auth';
import { db } from '@/firebase/server';
import { resolveRole } from '@/lib/auth/roles';
import { pbIsAdmin } from '@/lib/pocketbase/admins';
import { pbGetProfile } from '@/lib/pocketbase/profiles';
import { isAdminByEnv } from '@/lib/server/admin-env';

/**
 * WHO COUNTS AS AN ADMIN, ON THE SERVER.
 *
 * ## Two places the role lives, and why both are checked
 *
 * `AdminLayout` gates the dashboard on the Firestore profile (`userRole` /
 * `role`), because that is what the client can read. An admin who passes that
 * gate and then gets a 403 from their own API is a broken feature, not a
 * security win — so this checks the same profile.
 *
 * Custom claims are checked too, and first: they are set by a trusted process,
 * cannot be edited from a client, and cost no database read. The profile
 * fallback costs one read and is only paid for by callers who actually fail the
 * claim check.
 *
 * The role string itself is read through `resolveRole()`, the same function the
 * client layouts use, so "is this an admin" has one answer in the codebase
 * instead of a fourth variant of the comparison.
 */
export async function isAdminUid(uid: string | null | undefined): Promise<boolean> {
  if (!uid) return false;

  /*
   * Env allowlist first — no database at all, so an operator's access never
   * depends on either store being healthy.
   */
  if (isAdminByEnv(uid)) return true;

  /*
   * VPS stores first — the local admin grant and the mirrored profile both
   * live on this machine, so an admin keeps access even when Firestore is
   * blocked or out of quota (the reason this migration exists).
   */
  if ((await pbIsAdmin(uid)) === true) return true;
  try {
    if ((await pbGetProfile(uid))?.userRole === 'admin') return true;
  } catch {
    // Local store unreachable — keep going down the chain.
  }

  try {
    const caller = await getAuth().getUser(uid);
    // The allowlist may be keyed by email — the Auth record has it, no
    // Firestore read involved.
    if (isAdminByEnv(uid, caller.email)) return true;
    const claims = caller.customClaims ?? {};
    if (claims.admin === true) return true;
    if (claims.role === 'admin' || claims.role === 'superadmin') return true;
  } catch {
    // No such auth user, or auth is misconfigured. Fall through to the profile —
    // a Firestore admin still deserves to see their own dashboard.
  }

  try {
    const snap = await db.collection('userProfiles').doc(uid).get();
    if (!snap.exists) return false;
    return resolveRole(snap.data()) === 'admin';
  } catch {
    return false;
  }
}