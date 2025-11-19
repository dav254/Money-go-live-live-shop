
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Bell, MessageSquare, Video, Search } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Input } from '@/components/ui/input';
import { UserNav } from '@/components/layout/user-nav';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function SellerHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <Link href="/dashboard/seller" className="hidden md:block">
          <Logo className="h-8 w-auto text-primary" />
        </Link>
      </div>
      <div className="hidden md:flex flex-1 max-w-lg items-center">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products, orders..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex relative"
          asChild
        >
          <Link href="/notifications">
            <Bell className="h-5 w-5" />
            <span className="sr-only">Notifications</span>
            <span className="absolute top-1 right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex"
          asChild
        >
          <Link href="/dashboard/seller/messages">
            <MessageSquare className="h-5 w-5" />
            <span className="sr-only">Chat</span>
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex"
          asChild
        >
          <Link href="/dashboard/seller/live">
            <Video className="h-5 w-5" />
            <span className="sr-only">Go Live</span>
          </Link>
        </Button>
        <UserNav />
      </div>
    </header>
  );
}
