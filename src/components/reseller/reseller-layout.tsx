'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { ResellerSidebar } from '@/components/reseller/reseller-sidebar';
import { useUser } from '@/firebase';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { FirebaseErrorListener } from '../FirebaseErrorListener';

export function ResellerLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !isProfileLoading) {
      if (!user) {
        // Not logged in, redirect to login page
        router.replace('/login');
      } else if (userProfile && userProfile.userRole !== 'reseller') {
        // Logged in, but not a reseller, redirect to homepage for role-based routing
        router.replace('/');
      }
    }
  }, [user, isUserLoading, userProfile, isProfileLoading, router]);

  const isLoading = isUserLoading || isProfileLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Loading Reseller Dashboard...</p>
      </div>
    );
  }

  // Render nothing if we are about to redirect
  if (!user || (userProfile && userProfile.userRole !== 'reseller')) {
    return null;
  }

  return (
    <MainLayout sidebar={<ResellerSidebar />}>
        <FirebaseErrorListener />
        {children}
    </MainLayout>
  );
}
