'use client';

import { useEffect } from 'react';
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
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

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
      <div className="flex h-screen w-full items-center justify-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Loading Reseller Dashboard...</span>
      </div>
    );
  }

  if (!user || (userProfile && userProfile.userRole !== 'reseller')) {
    return null;
  }
  
  return (
    <SidebarProvider>
      <Sidebar side="left" collapsible="icon">
        <SidebarHeader className="border-b bg-card p-4">
          <Link href="/dashboard/reseller">
            <Logo className="h-8 w-auto text-primary cursor-pointer" />
          </Link>
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
