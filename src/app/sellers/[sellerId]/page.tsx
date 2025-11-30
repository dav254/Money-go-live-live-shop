
'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { SellerHeader as PublicSellerHeader } from '@/components/seller/shop-header';
import { SellerTabs } from '@/components/seller/seller-tabs';
import { initializeAdminApp } from '@/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';
import type { Seller, Product, SellerShop, UserProfile } from '@/lib/types';
import { useUser, useUserProfile } from '@/firebase';
import { BuyerHeader } from '@/components/buyer/buyer-header';
import { useEffect, useState } from 'react';

// NOTE: The data fetching functions getSellerData and getSellerProducts are no longer used
// as this is now a client component. Data will be fetched on the client side inside components.
// We will mock the data for now.

const mockSeller: Seller = {
    id: 'CKmHD5jv0dOevUJhJ8tM7akpSlF2',
    sellerId: 'CKmHD5jv0dOevUJhJ8tM7akpSlF2',
    name: "Aisha's Handbags",
    description: "Curated collection of handcrafted leather bags and accessories. Made with love, built to last. We believe in sustainable fashion and timeless design.",
    avatar: { id: 'logo', imageUrl: 'https://picsum.photos/seed/CKmHD5jv0dOevUJhJ8tM7akpSlF2/200', description: 'Shop Logo', imageHint: 'shop logo' },
    banner: { id: 'banner', imageUrl: 'https://picsum.photos/seed/CKmHD5jv0dOevUJhJ8tM7akpSlF2/1200/400', description: 'Shop Banner', imageHint: 'shop banner' },
    location: "Nairobi, Kenya",
    isVerified: true,
    rating: 4.8,
    reviewsCount: 150,
    followers: 2300,
    joinedDate: new Date().toISOString(),
    bio: "Welcome to my awesome shop! We sell the best products.",
    returnPolicy: "30-day returns accepted.",
    deliveryPolicy: "Ships nationwide in 2-3 business days.",
    storeHours: "9 AM - 5 PM, Mon-Fri",
    deliversFast: true,
};

const mockProducts: Product[] = [];


export default function SellerShopPage({ params }: { params: { sellerId: string } }) {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);

  const [seller, setSeller] = useState<Seller | null>(mockSeller);
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
      // In a real implementation, you would fetch seller and product data here
      // based on params.sellerId. For now, we use mock data.
      setIsLoading(isUserLoading || isProfileLoading);
  }, [isUserLoading, isProfileLoading]);


  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <h1 className="text-2xl font-bold">Loading Shop...</h1>
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
            <SellerTabs seller={seller} products={products} />
            </div>
      </div>
    </MainLayout>
  );
}

