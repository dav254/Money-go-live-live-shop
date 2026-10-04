'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useUserProfile } from '@/firebase';
import { resolveRole } from '@/lib/auth/roles';
import { AppSkeleton } from '@/components/app/app-skeleton';
import { AppHome } from '@/components/app/app-home';

/**
 * APP ENTRY — a turnstile that opens on the homepage.
 *
 * The homepage is a branded entry page: the logo, the two sections as two
 * plates, and the account journey. It replaces the old sign-in wall that used
 * to serve as the app home — which is what made each role share one screen and
 * one route.
 *
 * Signed-in visitors are never shown this screen: the section router runs at
 * the entry, so the homepage only ever reads for someone who has not signed in
 * yet.
 *
 * Admin accounts never get this far: `SurfaceBoundary` signs them out on the app
 * surface before any section is reached (see `APP_ALLOWED_ROLES` in
 * `src/lib/auth/surface.ts`), so nobody is shipped to a route that does not
 * exist.
 */
export default function AppEntryPage() {
  const { user, isLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();

  const role = resolveRole(userProfile);

  useEffect(() => {
    if (isLoading || isProfileLoading) return;
    if (!user) return;
    // Each role goes to the section built for it. Admins have no app section —
    // `SurfaceBoundary` signs them out above this point — so they are left for
    // the boundary rather than sent to a route that does not exist.
    if (role === 'buyer') {
      router.replace('/app/buyer');
      return;
    }
    if (role === 'seller' || role === 'reseller') {
      router.replace('/app/seller');
      return;
    }
    // `role === null` means the profile could not be read. Guessing "seller"
    // here used to dump an unresolved account into the seller section, which
    // then refused it — so we stay put and let `SurfaceBoundary` deal with the
    // unreadable profile instead of inventing a section for it.
  }, [user, isLoading, isProfileLoading, role, router]);

  if (isLoading || isProfileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <AppSkeleton className="h-10 w-10 rounded-full" />
      </div>
    );
  }

  // Signed out: the app opens on its own homepage, not a sign-in wall. The
  // section home renders once the account is known, so the visitor lands on
  // something that explains what the app is before they type a password.
  if (!user) return <AppHome />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <AppSkeleton className="h-10 w-10 rounded-full" />
    </div>
  );
}
