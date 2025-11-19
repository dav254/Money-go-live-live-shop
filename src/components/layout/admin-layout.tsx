
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
        // Logged in, but not an admin, redirect to homepage for role-based routing
        router.replace('/');
      }
    }
  }, [user, isUserLoading, userProfile, isProfileLoading, router]);

  const isLoading = isUserLoading || isProfileLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Loading Admin Dashboard...</p>
      </div>
    );
  }

  // Render nothing if we are about to redirect
  if (!user || (userProfile && userProfile.userRole !== 'admin')) {
    return null;
  }
  
  return <MainLayout sidebar={<AdminSidebar />}>{children}</MainLayout>;
}
