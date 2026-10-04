'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { SellerSidebar } from '@/components/seller/seller-sidebar';
import { Logo } from '../logo';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { SellerHeader } from '../seller/seller-header';
import { doc } from 'firebase/firestore';
import type { Seller, SellerShop, UserProfile } from '@/lib/types';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { FirebaseErrorListener } from '../FirebaseErrorListener';

export function SellerLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();
  const firestore = useFirestore();


  useEffect(() => {
    if (!isUserLoading && !isProfileLoading) {
      if (!user) {
        // Not logged in, redirect to login page
        router.replace('/login');
      } else if (userProfile && userProfile.userRole !== 'seller') {
        // Logged in, but not a seller, redirect to homepage for role-based routing
        router.replace('/');
      }
    }
  }, [user, isUserLoading, userProfile, isProfileLoading, router]);

  const isLoading = isUserLoading || isProfileLoading;

  if (isLoading || !user || (userProfile && userProfile.userRole !== 'seller')) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <p>Loading Seller Dashboard...</p>
        </div>
    );
  }


  return (
    <SidebarProvider>
      <Sidebar side="left" collapsible="icon">
        <SidebarHeader>
          <Logo className="text-3xl text-primary" />
        </SidebarHeader>
        <SidebarContent>
          <SellerSidebar />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <SellerHeader />
        <main>
          <FirebaseErrorListener />
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
