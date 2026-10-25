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
import { SellerSidebar } from '@/components/seller/seller-sidebar';
import { Logo } from '../logo';
import { useUser } from '@/firebase';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { SellerHeader } from '../seller/seller-header';
import { FirebaseErrorListener } from '../FirebaseErrorListener';
import { cn } from '@/lib/utils';
import { ROLE_HOME, canAccessSection, resolveRole } from '@/lib/auth/roles';
import Link from 'next/link';

export function SellerLayout({ children, fullWidth = false }: { children: React.ReactNode, fullWidth?: boolean }) {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();

  // ROLE LOCK: the merchant workspace belongs to sellers (admins keep oversight
  // access). Buyers and resellers are pushed back to their own section — the
  // same redirect the global RoleBoundary performs.
  const role = resolveRole(userProfile);

  useEffect(() => {
    if (isUserLoading || isProfileLoading) return;
    if (!user) {
      // Not logged in, redirect to login page
      router.replace('/login');
      return;
    }
    if (role && !canAccessSection(role, 'seller')) router.replace(ROLE_HOME[role]);
  }, [user, isUserLoading, isProfileLoading, role, router]);

  const accessDenied = !!role && !canAccessSection(role, 'seller');

  if (isUserLoading || isProfileLoading || !user || accessDenied) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Syncing Merchant Node...</p>
        </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="w-full max-w-full overflow-x-hidden flex min-h-dvh">
        <Sidebar side="left" collapsible="icon" className="vn-seller-sidebar">
          <SidebarHeader className="border-b bg-card p-4">
            <Link href="/dashboard/seller">
              <Logo className="text-3xl text-primary cursor-pointer" />
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SellerSidebar />
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="vn-dashboard-inset flex flex-col flex-1 min-w-0 h-dvh overflow-hidden">
          <SellerHeader />
          <main className={cn(
            "flex-1 flex flex-col w-full max-w-full overflow-hidden",
            fullWidth ? "p-0" : "p-4 md:p-8 overflow-y-auto h-full"
          )}>
            <div className={cn("flex-1 w-full relative h-full", !fullWidth && "max-w-7xl mx-auto")}>
              <FirebaseErrorListener />
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
