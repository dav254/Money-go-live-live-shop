
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar, SidebarContent, SidebarHeader, SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Toaster } from '../ui/toaster';
import { BuyerSidebar } from '@/components/buyer/buyer-sidebar';
import { BuyerHeader } from '@/components/buyer/buyer-header';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import { Logo } from '../logo';

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
      <Sidebar side="left" collapsible="icon">
        <SidebarHeader>
            <Logo className="h-8 w-auto text-primary" />
        </SidebarHeader>
        <SidebarContent>
          <BuyerSidebar />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <BuyerHeader />
        <main className={cn("flex-1", !fullWidth && "p-4 sm:p-6")}>
            <div className={cn("mx-auto h-full", !fullWidth && "max-w-7xl")}>
            {children}
            </div>
        </main>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
