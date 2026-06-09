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
import { Loader2 } from 'lucide-react';
import { FirebaseErrorListener } from '../FirebaseErrorListener';
import { Logo } from '../logo';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function BuyerLayout({ children, fullWidth = false }: { children: React.ReactNode, fullWidth?: boolean }) {
  const { user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      // Direct redirect if the user logs out or attempts to access dashboard without a session
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-black">
        <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
            <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/60">Verifying Identity</p>
      </div>
    );
  }

  // Prevent rendering if the user is being redirected
  if (!user) return null;

  return (
    <SidebarProvider>
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
      <SidebarInset className="flex flex-col h-screen overflow-hidden">
        <BuyerHeader />
        <main className={cn("flex-1 overflow-y-auto", !fullWidth && "p-4 sm:p-6 lg:p-8")}>
          <div className={cn("mx-auto h-full relative", !fullWidth && "max-w-7xl")}>
            <FirebaseErrorListener />
            {children}
          </div>
        </main>
        <Toaster />
      </SidebarInset>
    </SidebarProvider>
  );
}
