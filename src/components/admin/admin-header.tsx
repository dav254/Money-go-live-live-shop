'use client';

import { Button } from '@/components/ui/button';
import { Bell, MessageSquare, Menu } from 'lucide-react';
import Link from 'next/link';
import { UserNav } from '../layout/user-nav';
import { Skeleton } from '../ui/skeleton';
import { SidebarTrigger } from '../ui/sidebar';
import { useUser, useUserProfile } from '@/firebase';
import { ThemeToggle } from '../theme-toggle';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { Logo } from '../logo';
import { AdminSidebar } from './admin-sidebar';


export function AdminHeader() {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
 
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
                    <Logo className="h-8 w-auto text-primary cursor-pointer" />
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
            <h1 className="text-sm font-semibold">
              Welcome, <span className="text-primary">{adminName}</span>
            </h1>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/admin/notifications">
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
