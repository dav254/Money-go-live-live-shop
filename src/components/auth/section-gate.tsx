'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppSections } from '@/hooks/use-app-sections';
import { ROLE_HOME } from '@/lib/auth/roles';

/**
 * APP SECTION GATE — hides what an admin has switched off.
 *
 * Hiding a nav link is not enforcement: the URL can still be typed, bookmarked,
 * or opened from a notification. This guard runs on every navigation and sends
 * the user back to their own home when the section they are inside has been
 * disabled, so the switch takes effect on the route as well as the menu.
 *
 * Scope notes, so the limits are not overstated:
 *  - It governs navigation only. Any API endpoint behind the section still has
 *    to do its own authorization — this is a UI/surface control, not an
 *    authorisation boundary.
 *  - It applies to buyers and sellers. Admins, the landing page and the sign-in
 *    flows are never governed by it, so a mistake here cannot lock an admin out.
 *  - Until the toggles load, everything is treated as enabled, so nobody is
 *    bounced during the initial request.
 */
export function SectionGate({ children }: { children: React.ReactNode }) {
  const { isGoverned, isLoaded, canUse, sectionForPath, role } = useAppSections();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Wait for the toggles so we don't redirect on the pre-load default.
    if (!isGoverned || !isLoaded || !pathname || !role) return;

    const section = sectionForPath(pathname);
    if (!section) return;
    if (canUse(section)) return;

    router.replace(ROLE_HOME[role]);
  }, [isGoverned, isLoaded, pathname, canUse, sectionForPath, role, router]);

  return <>{children}</>;
}