
'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { SellerSidebar } from '@/components/seller/seller-sidebar';
import { Logo } from '../logo';
import Link from 'next/link';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { Bell, Menu, MessageSquare, Search, Video } from 'lucide-react';
import { Input } from '../ui/input';
import { UserNav } from './user-nav';
import { useUser } from '@/firebase';
import { SellerHeader } from './seller-header';

export function SellerLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Loading Seller Dashboard...</p>
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
          <SellerSidebar />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <SellerHeader />
        <main>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
