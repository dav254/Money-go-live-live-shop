
'use client';

import type { Seller } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '@/components/ui/button';
import { Bell, MessageSquare, Video } from 'lucide-react';
import Link from 'next/link';
import { UserNav } from '../layout/user-nav';
import { Skeleton } from '../ui/skeleton';
import { SidebarTrigger } from '../ui/sidebar';
import { useUser, useFirestore, useDoc, useMemoFirebase, useUserProfile } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemo } from 'react';
import type { SellerShop, UserProfile } from '@/lib/types';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { ThemeToggle } from '../theme-toggle';


export function AdminHeader() {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
 
  const isLoading = isUserLoading || isProfileLoading;

  const adminName = userProfile?.fullName || 'Admin';
  const adminAvatar = userProfile?.profilePictureUrl || getPlaceholderImage();


  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="hidden md:flex" />
        <div className="flex items-center gap-3">
          {isLoading ? (
            <>
              <Skeleton className="h-5 w-24" />
            </>
          ) : (
            <>
              <span className="hidden text-sm font-semibold sm:inline">
                Welcome, {adminName}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="ghost" size="icon" asChild>
          <Link href="/notifications">
            <Bell />
            <span className="sr-only">Notifications</span>
          </Link>
        </Button>
        <Button variant="ghost" size="icon" asChild>
           <Link href="/dashboard/admin/support/chat-logs">
            <MessageSquare />
            <span className="sr-only">Messages</span>
          </Link>
        </Button>
        <UserNav />
      </div>
    </header>
  );
}
