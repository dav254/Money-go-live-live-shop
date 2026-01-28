'use client';

import { SidebarProvider } from '@/components/ui/sidebar';
import Link from 'next/link';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { Menu, Loader2 } from 'lucide-react';
import { Toaster } from '../ui/toaster';
import { Logo } from '../logo';
import { BuyerSidebar } from '@/components/buyer/buyer-sidebar';
import { BuyerHeader } from '@/components/buyer/buyer-header';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';

export function BuyerLayout({ children, fullWidth = false }: { children: React.ReactNode, fullWidth?: boolean }) {
  const { isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Loading Dashboard...</span>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col bg-background">
        <BuyerHeader />
        <div className="flex flex-1">
          <aside className="hidden w-64 flex-col border-r bg-card md:flex">
            <div className="flex flex-1 flex-col gap-y-4 overflow-y-auto p-4">
              <BuyerSidebar />
            </div>
          </aside>
          <main className={cn("flex-1", !fullWidth && "p-4 sm:p-6 lg:p-8")}>
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
