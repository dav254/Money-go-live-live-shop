
'use client';

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '@/components/ui/button';
import { Bell, MessageSquare, Video } from 'lucide-react';
import Link from 'next/link';
import { UserNav } from '../layout/user-nav';
import { Skeleton } from '../ui/skeleton';
import { SidebarTrigger } from '../ui/sidebar';
import { useUser, useUserProfile } from '@/firebase';

export function ResellerHeader() {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
 
  const isLoading = isUserLoading || isProfileLoading;

  const resellerName = userProfile?.fullName || 'Reseller';
  const resellerAvatar = userProfile?.profilePictureUrl || `https://picsum.photos/seed/${user?.uid}/100`;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="hidden md:flex" />
        <div className="flex items-center gap-3">
          {isLoading ? (
            <>
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-5 w-24" />
            </>
          ) : (
            <>
              <Avatar className="h-8 w-8">
                <AvatarImage src={resellerAvatar} />
                <AvatarFallback>{resellerName.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-semibold">{resellerName}</span>
            </>
          )}
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
           <Link href="/messages">
            <MessageSquare />
            <span className="sr-only">Messages</span>
          </Link>
        </Button>
        <UserNav />
      </div>
    </header>
  );
}
