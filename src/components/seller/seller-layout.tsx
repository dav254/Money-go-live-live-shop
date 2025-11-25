
'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { SellerSidebar } from '@/components/seller/seller-sidebar';
import { Logo } from '../logo';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { SellerHeader } from '../seller/seller-header';
import { doc } from 'firebase/firestore';
import type { Seller, SellerShop, UserProfile } from '@/lib/types';
import { getPlaceholderImage } from '@/lib/placeholder-images';

export function SellerLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();
  const firestore = useFirestore();

  const sellerShopRef = useMemoFirebase(() => {
    if (!user) return null;
    return firestore ? doc(firestore, `sellerShops/${user.uid}`) : null;
  }, [firestore, user]);
  
  const { data: shopData, isLoading: isShopLoading } = useDoc<SellerShop>(sellerShopRef);

  const sellerData: Seller | null = useMemo(() => {
    if (!user || !userProfile || !shopData) return null;
    return {
      id: user.uid,
      sellerId: user.uid,
      name: shopData.shopName || userProfile.fullName,
      description: shopData.description || 'Welcome to my shop!',
      avatar: {
        id: 'avatar',
        imageUrl: shopData.logoUrl || userProfile.profilePictureUrl || getPlaceholderImage(),
        description: 'Seller avatar',
        imageHint: 'seller avatar'
      },
      banner: {
        id: 'banner',
        imageUrl: shopData.bannerUrl || getPlaceholderImage(),
        description: 'Seller banner',
        imageHint: 'store banner'
      },
      isVerified: true, // Placeholder
      rating: 4.8, // Placeholder
      reviewsCount: shopData.reviewsCount || 0,
      followers: shopData.followers || 0,
      location: shopData.location || userProfile.location || 'Online',
      joinedDate: userProfile.joinDate,
      bio: shopData.description || userProfile.bio || 'Welcome!',
    };
  }, [user, userProfile, shopData]);


  useEffect(() => {
    if (!isUserLoading && !isProfileLoading) {
      if (!user) {
        // Not logged in, redirect to login page
        router.replace('/login');
      } else if (userProfile && userProfile.userRole !== 'seller') {
        // Logged in, but not a seller, redirect to homepage for role-based routing
        router.replace('/');
      }
    }
  }, [user, isUserLoading, userProfile, isProfileLoading, router]);

  const isLoading = isUserLoading || isProfileLoading || isShopLoading;

  if (!user || (userProfile && userProfile.userRole !== 'seller')) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <p>Loading Seller Dashboard...</p>
        </div>
    );
  }


  return (
    <SidebarProvider>
      <Sidebar side="left" collapsible="icon">
        <SidebarHeader>
          <Logo className="h-8 w-auto text-primary" />
        </SidebarHeader>
        <SidebarContent>
          <SellerSidebar />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <SellerHeader seller={sellerData} isLoading={isLoading} />
        <main>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
