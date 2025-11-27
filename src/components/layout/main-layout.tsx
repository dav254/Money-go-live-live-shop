
'use client';

import { SidebarProvider } from '@/components/ui/sidebar';
import Link from 'next/link';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { Menu, Bell, MessageSquare, Video, Search } from 'lucide-react';
import { Toaster } from '../ui/toaster';
import { Logo } from '../logo';
import { Input } from '../ui/input';
import { UserNav } from './user-nav';
import { FirebaseErrorListener } from '../FirebaseErrorListener';

export function MainLayout({ children, sidebar }: { children: React.ReactNode, sidebar?: React.ReactNode }) {
  // This layout is now simplified, primarily for public pages like product details or the main feed.
  // Role-specific layouts (AdminLayout, SellerLayout, etc.) will provide their own headers and sidebars.

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {!sidebar && ( // Only show this header if a specific sidebar isn't provided
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
          <Link href="/" className="md:block">
            <Logo className="h-8 w-auto text-primary" />
          </Link>
          <div className="hidden md:flex flex-1 max-w-lg items-center">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search products, orders..." className="pl-9" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <UserNav />
          </div>
        </header>
      )}
      <main className="flex-1">
        <FirebaseErrorListener />
        {children}
      </main>
      <Toaster />
    </div>
  );
}
