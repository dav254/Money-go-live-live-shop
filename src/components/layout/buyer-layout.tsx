
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '../ui/toaster';
import { BuyerSidebar } from '@/components/buyer/buyer-sidebar';
import { BuyerHeader } from '@/components/buyer/buyer-header';
import { useUser, useUserProfile } from '@/firebase';
import { cn } from '@/lib/utils';

export function BuyerLayout({ children, fullWidth = false }: { children: React.ReactNode, fullWidth?: boolean }) {
  const { isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col bg-background">
        <BuyerHeader />
        <div className="flex flex-1 overflow-hidden">
          <aside className="hidden w-64 flex-col border-r bg-card md:flex">
            <div className="flex flex-1 flex-col gap-y-4 overflow-y-auto p-4">
              <BuyerSidebar />
            </div>
          </aside>
          <main className={cn("flex-1 overflow-auto", !fullWidth && "p-4 sm:p-6")}>
            <div className={cn("mx-auto h-full", !fullWidth && "max-w-7xl")}>
              {children}
            </div>
          </main>
        </div>
        <Toaster />
      </div>
    </SidebarProvider>
  );
}
