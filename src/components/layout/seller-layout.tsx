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
import Link from 'next/link';

export function SellerLayout({ children, fullWidth = false }: { children: React.ReactNode, fullWidth?: boolean }) {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !isProfileLoading) {
      if (!user) {
        router.replace('/login');
      } else if (userProfile && userProfile.userRole !== 'seller') {
        router.replace('/');
      }
    }
  }, [user, isUserLoading, userProfile, isProfileLoading, router]);

  if (isUserLoading || isProfileLoading || !user || (userProfile && userProfile.userRole !== 'seller')) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Syncing Merchant Node...</p>
        </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="w-full max-w-full overflow-x-hidden flex min-h-screen">
        <Sidebar side="left" collapsible="icon">
          <SidebarHeader className="border-b bg-card p-4">
            <Link href="/dashboard/seller">
              <Logo className="h-8 w-auto text-primary cursor-pointer" />
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SellerSidebar />
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden">
          <SellerHeader />
          <main className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full",
            fullWidth ? "p-0" : "p-4 md:p-8"
          )}>
            <div className={cn("w-full h-full", !fullWidth && "max-w-7xl mx-auto")}>
              <FirebaseErrorListener />
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}