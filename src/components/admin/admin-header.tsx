'use client';

import { Button } from '@/components/ui/button';
import { MessageSquare, Menu } from 'lucide-react';
import Link from 'next/link';
import { UserNav } from '../layout/user-nav';
import { Skeleton } from '../ui/skeleton';
import { SidebarTrigger } from '../ui/sidebar';
import { useUser, useUserProfile, useFirestore } from '@/firebase';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { Logo } from '../logo';
import { NotificationsBell } from '@/components/notifications/notifications-bell';
import { AdminSidebar } from './admin-sidebar';


export function AdminHeader() {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const firestore = useFirestore();
 
  const isLoading = isUserLoading || isProfileLoading;

  const adminName = userProfile?.fullName || 'Admin';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2 md:gap-4">
        {/* Mobile Sidebar */}
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
                  <Link href="/dashboard/admin">
                    <Logo className="text-3xl text-primary cursor-pointer" />
                  </Link>
                </SheetTitle>
              </SheetHeader>
              <div className="p-4 pt-0">
                <AdminSidebar />
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
            <Link href="/dashboard/admin">
                <h1 className="text-sm font-semibold">
                  Welcome, <span className="text-primary">{adminName}</span>
                </h1>
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Route check: `/dashboard/admin/notifications` did not exist — the old
            link 404'd. The route now renders the shared inbox inside the admin
            chrome, and the bell carries the live unread badge. */}
        <NotificationsBell
          href="/dashboard/admin/notifications"
          label="Notifications"
          className="flex h-9 w-9"
          iconClassName="h-5 w-5"
        />
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
