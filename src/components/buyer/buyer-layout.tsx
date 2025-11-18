
'use client';

import { SidebarProvider } from '@/components/ui/sidebar';
import Link from 'next/link';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { Menu } from 'lucide-react';
import { Toaster } from '../ui/toaster';
import { Logo } from '../logo';
import { BuyerSidebar } from '@/components/buyer/buyer-sidebar';
import { BuyerHeader } from '@/components/buyer/buyer-header';
import { useUser } from '@/firebase';

export function BuyerLayout({ children }: { children: React.ReactNode }) {
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
        <div className="flex flex-1">
          <aside className="hidden w-64 flex-col border-r bg-card md:flex">
            <div className="flex flex-1 flex-col gap-y-4 overflow-y-auto p-4">
              <BuyerSidebar />
            </div>
          </aside>
          <main className="flex-1">{children}</main>
        </div>
        <Toaster />
      </div>
    </SidebarProvider>
  );
}
