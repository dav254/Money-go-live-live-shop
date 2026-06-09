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
import { Loader2 } from 'lucide-react';
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

  const isLoading = isUserLoading || isProfileLoading;

  if (isLoading || !user || (userProfile && userProfile.userRole !== 'seller')) {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-black">
            <div className="relative">
                <div className="absolute inset-[-10px] bg-red-600/20 rounded-full animate-pulse blur-lg" />
                <div className="absolute inset-0 bg-red-600/20 rounded-full animate-ping" />
                <Loader2 className="h-10 w-10 animate-spin text-red-600 relative z-10" />
            </div>
            <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-red-600 animate-pulse">Syncing Studio</p>
                <p className="text-[8px] font-bold uppercase tracking-widest text-neutral-600 mt-1">Connecting Merchant Node</p>
            </div>
        </div>
    );
  }

  return (
    <SidebarProvider>
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
      <SidebarInset className="flex flex-col h-screen overflow-hidden">
        <SellerHeader />
        <main className={cn("flex-1 overflow-y-auto", fullWidth && "p-0")}>
          <FirebaseErrorListener />
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}