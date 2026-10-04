/**
 * VIDNOV ROLE BOUNDARY (single source of truth).
 *
 * Sellers, resellers and buyers each have their own section. Historically each
 * layout re-implemented the check slightly differently (`userRole` vs `role`,
 * redirect to `/` vs a dashboard), which let a signed-in seller land inside the
 * buyer workspace — e.g. by pressing the browser Back button onto a previously
 * visited `/buyer/*` page.
 *
 * Everything (layouts + the global RoleBoundary) now resolves the role through
 * `resolveRole()` and sends the user to `ROLE_HOME[role]`, so the boundary is
 * the same no matter which surface is rendered.
 */

export type AppRole = 'buyer' | 'seller' | 'reseller' | 'admin';

/** Where each role belongs when it is pushed out of a foreign section. */
export const ROLE_HOME: Record<AppRole, string> = {
  seller: '/dashboard/seller',
  reseller: '/dashboard/reseller',
  admin: '/dashboard/admin',
  buyer: '/buyer/dashboard',
};

/** Roles allowed to see a given section. Admins keep oversight everywhere. */
export const ALLOWED_ROLES: Record<AppRole, AppRole[]> = {
  buyer: ['buyer', 'admin'],
  seller: ['seller', 'admin'],
  reseller: ['reseller', 'admin'],
  admin: ['admin'],
};

/**
 * Reads the role from a Firestore user profile. Newer documents use `userRole`,
 * older ones only `role`. Returns null while the profile is still unknown so
 * callers can wait instead of guessing.
 */
export function resolveRole(profile: unknown): AppRole | null {
  const raw = profile as { userRole?: unknown; role?: unknown } | null | undefined;
  if (!raw) return null;
  const candidate = raw.userRole ?? raw.role;
  if (typeof candidate !== 'string') return null;
  const role = candidate.toLowerCase();
  if (role === 'seller' || role === 'reseller' || role === 'admin' || role === 'buyer') {
    return role;
  }
  return null;
}

/** Maps a pathname to the section that owns it (null = shared/public route). */
export function sectionForPath(pathname: string | null): AppRole | null {
  if (!pathname) return null;
  if (pathname.startsWith('/dashboard/seller')) return 'seller';
  if (pathname.startsWith('/dashboard/reseller')) return 'reseller';
  if (pathname.startsWith('/dashboard/admin') || pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/buyer')) return 'buyer';
  return null;
}

/** True when `role` may render inside `section`. */
export function canAccessSection(role: AppRole, section: AppRole): boolean {
  return ALLOWED_ROLES[section].includes(role);
}