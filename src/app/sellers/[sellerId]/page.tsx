'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { SellerHeader as PublicSellerHeader } from '@/components/seller/shop-header';
import { SellerTabs } from '@/components/seller/seller-tabs';
import type { Seller, Product, SellerShop, UserProfile, LiveSession } from '@/lib/types';
import { useUser, useUserProfile, useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { BuyerHeader } from '@/components/buyer/buyer-header';
import { useEffect, useState, useMemo } from 'react';
import { doc, query, collection, where } from 'firebase/firestore';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { useParams } from 'next/navigation';

export default function SellerShopPage() {
  const params = useParams();
  const sellerId = params.sellerId as string;

  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const firestore = useFirestore();

  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  
  // --- Data Fetching ---
  const sellerShopRef = useMemoFirebase(() => doc(firestore, 'sellerShops', sellerId), [firestore, sellerId]);
  const sellerProfileRef = useMemoFirebase(() => doc(firestore, 'userProfiles', sellerId), [firestore, sellerId]);
  const productsQuery = useMemoFirebase(() => query(collection(firestore, 'products'), where('sellerId', '==', sellerId)), [firestore, sellerId]);
  
  // Fetch specifically the current/latest live session for this seller
  const liveSessionRef = useMemoFirebase(() => doc(firestore, 'liveSessions', sellerId), [firestore, sellerId]);

  const { data: shopData, isLoading: isShopLoading } = useDoc<SellerShop>(sellerShopRef);
  const { data: profileData, isLoading: isSellerProfileLoading } = useDoc<UserProfile>(sellerProfileRef);
  const { data: productData, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);
  const { data: liveSession, isLoading: isLiveSessionLoading } = useDoc<LiveSession>(liveSessionRef);

  const isLoading = isUserLoading || isProfileLoading || isShopLoading || isSellerProfileLoading || areProductsLoading || isLiveSessionLoading;

  // --- Data Composition ---
  useEffect(() => {
    if (shopData && profileData) {
      const composedSeller: Seller = {
        id: sellerId,
        sellerId: sellerId,
        name: shopData.shopName || profileData.fullName || 'Unnamed Shop',
        description: shopData.description || profileData.bio || 'No description available.',
        avatar: { id: 'logo', imageUrl: shopData.logoUrl || profileData.profilePictureUrl || getPlaceholderImage(), description: 'Shop Logo', imageHint: 'shop logo' },
        banner: { id: 'banner', imageUrl: shopData.bannerUrl || getPlaceholderImage(), description: 'Shop Banner', imageHint: 'store banner' },
        location: shopData.location || profileData.location || 'Not specified',
        isVerified: profileData.verificationStatus === 'verified',
        rating: 4.8, 
        reviewsCount: shopData.reviewsCount || 0,
        followers: shopData.followers || 0,
        joinedDate: profileData.joinDate,
        bio: profileData.bio || 'Welcome!',
        returnPolicy: shopData.returnPolicy || "30-day returns accepted.",
        deliveryPolicy: shopData.deliveryPolicy || "Ships nationwide in 2-3 business days.",
        storeHours: shopData.storeHours || "9 AM - 5 PM, Mon-Fri",
        deliversFast: true,
        facebookUrl: shopData.facebookUrl,
        instagramUrl: shopData.instagramUrl,
        twitterUrl: shopData.twitterUrl,
        contactWhatsapp: shopData.contactWhatsapp,
        contactPhone: shopData.contactPhone,
        contactEmail: shopData.contactEmail,
        isLive: liveSession?.status === 'live',
      } as any;
      setSeller(composedSeller);
    }

    if (productData) {
      setProducts(productData);
    }
  }, [shopData, profileData, productData, sellerId, liveSession]);


  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <h1 className="text-2xl font-bold text-muted-foreground animate-pulse">Syncing Shop Data...</h1>
        </div>
      </MainLayout>
    );
  }

  if (!seller) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <h1 className="text-2xl font-bold">Seller Not Found</h1>
        </div>
      </MainLayout>
    );
  }

  const isBuyer = userProfile?.userRole === 'buyer';

  return (
    <MainLayout>
        {isBuyer && <BuyerHeader />}
        <div className="bg-background text-foreground">
            <PublicSellerHeader seller={seller} />
            <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SellerTabs seller={seller} products={products} liveSession={liveSession} />
            </div>
      </div>
    </MainLayout>
  );
}
