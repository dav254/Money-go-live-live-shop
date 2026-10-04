
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
import { ROLE_HOME, canAccessSection, resolveRole } from '@/lib/auth/roles';

export function ResellerLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();

  // ROLE LOCK: resellers only. Everyone else goes to their own workspace
  // instead of the public landing page.
  const role = resolveRole(userProfile);
  const accessDenied = !!role && !canAccessSection(role, 'reseller');

  useEffect(() => {
    if (isUserLoading || isProfileLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (accessDenied && role) router.replace(ROLE_HOME[role]);
  }, [user, isUserLoading, isProfileLoading, accessDenied, role, router]);

  if (accessDenied) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Returning to your workspace...</p>
      </div>
    );
  }

  // Blocking loading screen removed to open direct.

  return (
    <SidebarProvider>
      <Sidebar side="left" collapsible="icon">
        <SidebarHeader className="border-b bg-card p-4">
          <Link href="/dashboard/reseller">
            <Logo className="text-3xl text-primary cursor-pointer" />
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <ResellerSidebar />
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="flex flex-col h-screen overflow-hidden">
        <ResellerHeader userProfile={userProfile} isLoading={isProfileLoading} />
        <main className="flex-1 overflow-y-auto">
          <FirebaseErrorListener />
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
