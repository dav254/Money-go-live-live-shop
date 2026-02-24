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
import { ThemeToggle } from '../theme-toggle';
import { useUser, useUserProfile } from '@/firebase';

export function SellerHeader() {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);

  const isLoading = isUserLoading || isProfileLoading;
  const sellerName = userProfile?.shopName || userProfile?.fullName || 'Seller';

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
                    <Logo className="h-8 w-auto text-primary cursor-pointer" />
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
            <h1 className="text-lg font-semibold">
              Welcome, <span className="text-primary">{sellerName}</span>
            </h1>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/seller/notifications">
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
