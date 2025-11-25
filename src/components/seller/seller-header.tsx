

'use client';

import type { Seller } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '@/components/ui/button';
import { Bell, MessageSquare, Video } from 'lucide-react';
import Link from 'next/link';
import { UserNav } from '../layout/user-nav';
import { Skeleton } from '../ui/skeleton';
import { SidebarTrigger } from '../ui/sidebar';

interface SellerHeaderProps {
  seller: Seller | null;
  isLoading: boolean;
}


export function SellerHeader({ seller, isLoading }: SellerHeaderProps) {

  if (isLoading || !seller) {
      return (
           <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
                <div className="flex items-center gap-2">
                    <SidebarTrigger className="md:hidden"/>
                    <Skeleton className="h-8 w-32" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                </div>
            </header>
      )
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="hidden md:flex" />
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={seller.avatar.imageUrl} />
            <AvatarFallback>{seller.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-semibold">{seller.name}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/notifications">
            <Bell />
            <span className="sr-only">Notifications</span>
          </Link>
        </Button>
        <Button variant="ghost" size="icon" asChild>
           <Link href="/dashboard/seller/messages">
            <MessageSquare />
            <span className="sr-only">Messages</span>
          </Link>
        </Button>
        <Button variant="destructive" size="sm" asChild>
          <Link href="/dashboard/seller/studio">
            <Video className="mr-2 h-4 w-4" /> Go Live
          </Link>
        </Button>
        <UserNav />
      </div>
    </header>
  );
}
