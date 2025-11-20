
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { useUser } from '@/firebase';
import { useUserProfile } from '@/firebase/auth/use-user-profile';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !isProfileLoading) {
      if (!user) {
        // Not logged in, redirect to admin login page
        router.replace('/admin-login-net');
      } else if (userProfile && userProfile.userRole !== 'admin') {
        // Logged in, but not an admin, redirect to the admin login page as they are unauthorized
        router.replace('/admin-login-net');
      }
    }
  }, [user, isUserLoading, userProfile, isProfileLoading, router]);

  const isLoading = isUserLoading || isProfileLoading;

  // While loading, show a loading screen to prevent content flash
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Loading Admin Dashboard...</p>
      </div>
    );
  }

  // If the user is confirmed to be an admin, render the layout.
  // Otherwise, render null because a redirect is in progress.
  if (user && userProfile && userProfile.userRole === 'admin') {
    return <MainLayout sidebar={<AdminSidebar />}>{children}</MainLayout>;
  }

  return null;
}
