
'use client';

import { LivePreview } from '@/components/live/live-preview';
import { MainLayout } from '@/components/layout/main-layout';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Bell, MessageSquare, Search, Video } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { UserNav } from '@/components/layout/user-nav';

export default function HomePage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
       <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
          <div className="flex items-center gap-2 md:gap-4">
            <Link href="/" className="md:block">
              <Logo className="h-8 w-auto text-primary" />
            </Link>
          </div>

          <div className="hidden md:flex flex-1 max-w-lg items-center">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search products, orders..." className="pl-9" />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="hidden md:inline-flex">
              <Bell className="h-5 w-5" />
              <span className="sr-only">Notifications</span>
            </Button>
             <Button variant="ghost" size="icon" className="hidden md:inline-flex" asChild>
                <Link href="/messages">
                    <MessageSquare className="h-5 w-5" />
                    <span className="sr-only">Chat</span>
                </Link>
            </Button>
             <Button variant="ghost" size="icon" className="hidden md:inline-flex" asChild>
                <Link href="/dashboard/live/start">
                    <Video className="h-5 w-5" />
                    <span className="sr-only">Live</span>
                </Link>
            </Button>
            <UserNav />
          </div>
        </header>
      <div className="h-[calc(100vh-4rem)]">
        <LivePreview />
      </div>
    </div>
  );
}
