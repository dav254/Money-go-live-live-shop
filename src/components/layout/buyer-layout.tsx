'use client';

import { 
  Sidebar, 
  SidebarContent, 
  SidebarProvider, 
  SidebarInset,
  SidebarHeader 
} from '@/components/ui/sidebar';
import { Toaster } from '../ui/toaster';
import { BuyerSidebar } from '@/components/buyer/buyer-sidebar';
import { BuyerHeader } from '@/components/buyer/buyer-header';
import { useUser, useUserProfile } from '@/firebase';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ROLE_HOME, canAccessSection, resolveRole } from '@/lib/auth/roles';
import { FirebaseErrorListener } from '../FirebaseErrorListener';
import { Logo } from '../logo';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function BuyerLayout({ children, fullWidth = false, isGuestAllowed = false }: { children: React.ReactNode, fullWidth?: boolean, isGuestAllowed?: boolean }) {
  const { user, isLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();
  const pathname = usePathname();

  // ROLE LOCK: the buyer workspace belongs to buyers. Sellers, resellers and
  // admins are pushed back to their own dashboard — never rendered in buyer
  // chrome, whatever route they arrive on (including Back button history).
  const role = resolveRole(userProfile);
  const isBuyerArea = !!pathname && pathname.startsWith('/buyer');
  const wrongSection = !!user && !!role && isBuyerArea && !canAccessSection(role, 'buyer');

  useEffect(() => {
    if (isLoading || isProfileLoading) return;
    if (!user && !isGuestAllowed) {
      router.replace('/login');
      return;
    }
    if (wrongSection && role) router.replace(ROLE_HOME[role]);
  }, [user, isLoading, isProfileLoading, router, wrongSection, role, isGuestAllowed]);

  // Hold the chrome only once auth has settled, so the buyer sidebar never
  // paints for someone who is about to be redirected out of this section.
  const authSettled = !isLoading && !isProfileLoading;
  if (authSettled && !wrongSection && !user && !isGuestAllowed) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Redirecting...</p>
      </div>
    );
  }

  if (wrongSection) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Returning to your workspace...</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="w-full max-w-full overflow-x-hidden flex min-h-screen">
        <Sidebar side="left" collapsible="icon">
          <SidebarHeader className="border-b bg-card p-4">
            <Link href="/buyer/dashboard">
              <Logo className="text-3xl text-primary cursor-pointer" />
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <BuyerSidebar />
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden">
          <BuyerHeader />
          <main className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full",
            fullWidth ? "p-0" : "p-4 md:p-6 lg:p-8"
          )}>
            <div className={cn("h-full relative w-full", !fullWidth && "max-w-7xl mx-auto")}>
              <FirebaseErrorListener />
              {children}
            </div>
          </main>
          <Toaster />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
