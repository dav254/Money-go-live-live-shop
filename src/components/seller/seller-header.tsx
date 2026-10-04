'use client';

import { Button } from '@/components/ui/button';
import { Bell, Menu, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { UserNav } from '../layout/user-nav';
import { Skeleton } from '../ui/skeleton';
import { SidebarTrigger } from '../ui/sidebar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { SellerSidebar } from './seller-sidebar';
import { Logo } from '../logo';
import { useUser, useUserProfile, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { usePathname } from 'next/navigation';
import { collection, query, where } from 'firebase/firestore';

export function SellerHeader() {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const pathname = usePathname();

  const isLoading = isUserLoading || isProfileLoading;
  const sellerName = userProfile?.shopName || userProfile?.fullName || 'Seller';
  
  // Custom behavior: Hide specific UI elements in the immersive live view
  const isLiveFeed = pathname === '/dashboard/seller/live-feed';

  // Live unread count for the bell badge (works with both new + legacy docs).
  const notifQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'notifications'), where('userId', '==', user.uid));
  }, [user, firestore]);
  const { data: notifs } = useCollection<{ isRead?: boolean; status?: string; createdAt?: unknown; timestamp?: unknown }>(notifQuery);
  const unreadCount = (notifs ?? []).filter(n =>
    n.status ? n.status === 'unread' : !n.isRead,
  ).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2 md:gap-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0">
            <div className="flex h-full flex-col gap-y-4 overflow-y-auto bg-card">
              <SheetHeader className="sticky top-0 z-10 border-b bg-card p-4">
                <SheetTitle asChild>
                  <Link href="/dashboard/seller">
                    <Logo className="text-3xl text-primary cursor-pointer" />
                  </Link>
                </SheetTitle>
              </SheetHeader>
              <div className="p-4 pt-0">
                <SellerSidebar />
              </div>
            </div>
          </SheetContent>
        </Sheet>
        
        {/* Desktop Sidebar Trigger */}
        <SidebarTrigger className="hidden md:flex" />

        <div className="hidden md:block">
          {isLoading ? (
            <Skeleton className="h-6 w-40" />
          ) : (
            <Link href="/dashboard/seller">
                <h1 className="text-lg font-semibold">
                  Welcome, <span className="text-primary">{sellerName}</span>
                </h1>
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!isLiveFeed && (
            <>
                <Button variant="ghost" size="icon" asChild>
                <Link href="/dashboard/seller/notifications" className="relative">
                    <Bell />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                    <span className="sr-only">Notifications</span>
                </Link>
                </Button>
                <Button variant="ghost" size="icon" asChild>
                <Link href="/messages">
                    <MessageSquare />
                    <span className="sr-only">Messages</span>
                </Link>
                </Button>
            </>
        )}
        <UserNav />
      </div>
    </header>
  );
}
