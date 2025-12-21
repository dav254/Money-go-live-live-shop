
'use client';

import { useEffect, cloneElement } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarInset,
} from '@/components/ui/sidebar';
import { ResellerSidebar } from '@/components/reseller/reseller-sidebar';
import { useUser } from '@/firebase';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { FirebaseErrorListener } from '../FirebaseErrorListener';
import { Logo } from '../logo';
import { ResellerHeader } from '../reseller/reseller-header';
import React from 'react';

export function ResellerLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !isProfileLoading) {
      if (!user) {
        router.replace('/login');
      } else if (userProfile && userProfile.userRole !== 'reseller') {
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

  if (!user || (userProfile && userProfile.userRole !== 'reseller')) {
    return null;
  }
  
  return (
    <SidebarProvider>
      <Sidebar side="left" collapsible="icon">
        <SidebarHeader>
          <Logo className="h-8 w-auto text-primary" />
        </SidebarHeader>
        <SidebarContent>
          <ResellerSidebar />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <ResellerHeader userProfile={userProfile} isLoading={isLoading} />
        <main>
          <FirebaseErrorListener />
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
