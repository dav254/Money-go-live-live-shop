'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser, useUserProfile } from '@/firebase';
import { ROLE_HOME, canAccessSection, resolveRole, sectionForPath } from '@/lib/auth/roles';

/**
 * Global role boundary.
 *
 * The layouts already lock their own section, but a few routes render without a
 * layout (and shared surfaces deliberately reuse the buyer chrome). This guard
 * runs on every navigation so a seller can never stay on — or be sent back to —
 * a `/buyer/*` page, and a buyer can never stay on a seller/reseller/admin page.
 *
 * It never blocks rendering (no flash, no blank screens): it only redirects.
 */
export function RoleBoundary({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || isProfileLoading) return;
    if (!user) return;
    const role = resolveRole(userProfile);
    // Profile unknown (document missing or not readable yet) — don't guess and
    // don't trap the user; the layout guards handle what they can.
    if (!role) return;
    const section = sectionForPath(pathname);
    if (!section || canAccessSection(role, section)) return;
    router.replace(ROLE_HOME[role]);
  }, [user, isLoading, userProfile, isProfileLoading, pathname, router]);

  return <>{children}</>;
}