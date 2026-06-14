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
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import { FirebaseErrorListener } from '../FirebaseErrorListener';
import { Logo } from '../logo';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function BuyerLayout({ children, fullWidth = false, isGuestAllowed = false }: { children: React.ReactNode, fullWidth?: boolean, isGuestAllowed?: boolean }) {
  const { user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // Only redirect to login if user is not logged in AND guest access is NOT allowed
    if (!isLoading && !user && !isGuestAllowed) {
      router.replace('/login');
    }
  }, [user, isLoading, router, isGuestAllowed]);

  return (
    <SidebarProvider>
      <div className="w-full max-w-full overflow-x-hidden flex min-h-screen">
        <Sidebar side="left" collapsible="icon">
          <SidebarHeader className="border-b bg-card p-4">
            <Link href="/buyer/dashboard">
              <Logo className="h-8 w-auto text-primary cursor-pointer" />
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
