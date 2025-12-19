
'use client';

import type { Seller } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '@/components/ui/button';
import { Bell, MessageSquare, Video, Menu } from 'lucide-react';
import Link from 'next/link';
import { UserNav } from '../layout/user-nav';
import { Skeleton } from '../ui/skeleton';
import { SidebarTrigger } from '../ui/sidebar';
import { useUser, useFirestore, useDoc, useMemoFirebase, useUserProfile } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemo } from 'react';
import type { SellerShop, UserProfile } from '@/lib/types';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { SellerSidebar } from './seller-sidebar';
import { Logo } from '../logo';
import { ThemeToggle } from '../theme-toggle';


export function SellerHeader() {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const firestore = useFirestore();

  const sellerShopRef = useMemoFirebase(() => {
    if (!user) return null;
    return firestore ? doc(firestore, `sellerShops/${user.uid}`) : null;
  }, [firestore, user]);
  
  const { data: shopData, isLoading: isShopLoading } = useDoc<SellerShop>(sellerShopRef);

  const sellerName = useMemo(() => {
    return shopData?.shopName || userProfile?.fullName || 'Seller';
  }, [shopData, userProfile]);

  const sellerAvatar = useMemo(() => {
    return shopData?.logoUrl || userProfile?.profilePictureUrl || getPlaceholderImage();
  }, [shopData, userProfile]);
  
  const isLoading = isUserLoading || isProfileLoading || isShopLoading;


  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2">
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
                            <Logo className="h-8 w-auto text-primary" />
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
        <div className="hidden md:flex items-center gap-3">
          {isLoading ? (
            <>
              <Skeleton className="h-5 w-32" />
            </>
          ) : (
            <>
              <span className="text-sm font-semibold">
                Welcome, {sellerName}
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
