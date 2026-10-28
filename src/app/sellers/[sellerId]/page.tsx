'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { SellerHeader as PublicSellerHeader, ShopBottomActions } from '@/components/seller/shop-header';
import { SellerTabs } from '@/components/seller/seller-tabs';
import type { Seller, Product, SellerShop, UserProfile, LiveSession } from '@/lib/types';
import { useUser, useUserProfile, useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { BuyerHeader } from '@/components/buyer/buyer-header';
import { useEffect, useState, useMemo, use } from 'react';
import { doc, query, collection, where } from 'firebase/firestore';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { useParams } from 'next/navigation';
import {
  BusinessTrustPanel,
  type PublicBusinessPayload,
} from '@/components/trust/business-trust-panel';

export default function SellerShopPage(props: { params: Promise<{ sellerId: string }> }) {
  const params = use(props.params);
  const sellerId = params.sellerId;

  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const firestore = useFirestore();

  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [trust, setTrust] = useState<PublicBusinessPayload | null>(null);
  
  // --- Data Fetching ---
  const sellerShopRef = useMemoFirebase(() => doc(firestore, 'sellerShops', sellerId), [firestore, sellerId]);
  const sellerProfileRef = useMemoFirebase(() => doc(firestore, 'userProfiles', sellerId), [firestore, sellerId]);
  const productsQuery = useMemoFirebase(() => query(collection(firestore, 'products'), where('sellerId', '==', sellerId)), [firestore, sellerId]);
  
  const liveSessionRef = useMemoFirebase(() => doc(firestore, 'liveSessions', sellerId), [firestore, sellerId]);

  const { data: shopData, isLoading: isShopLoading } = useDoc<SellerShop>(sellerShopRef);
  const { data: profileData, isLoading: isSellerProfileLoading } = useDoc<UserProfile>(sellerProfileRef);
  const { data: productData, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);
  const { data: liveSession, isLoading: isLiveSessionLoading } = useDoc<LiveSession>(liveSessionRef);

  const isLoading = isUserLoading || isProfileLoading || isShopLoading || isSellerProfileLoading || areProductsLoading || isLiveSessionLoading;

  // --- Data Composition ---
  useEffect(() => {
    if (shopData && profileData) {
      const displayLocation = shopData.area && shopData.county 
        ? `${shopData.area}, ${shopData.county}`
        : (shopData.location || profileData.location || 'Not specified');

      const composedSeller: Seller = {
        id: sellerId,
        sellerId: sellerId,
        name: shopData.shopName || profileData.fullName || 'Unnamed Shop',
        description: shopData.description || profileData.bio || 'No description available.',
        avatar: { id: 'logo', imageUrl: shopData.logoUrl || profileData.profilePictureUrl || getPlaceholderImage(), description: 'Shop Logo', imageHint: 'shop logo' },
        banner: { id: 'banner', imageUrl: shopData.bannerUrl || getPlaceholderImage(), description: 'Shop Banner', imageHint: 'store banner' },
        location: displayLocation,
        isVerified: profileData.verificationStatus === 'verified',
        // Overwritten the moment the trust payload lands. The old code left
        // these at 0 forever, so every business on the open web rendered as a
        // brand-new shop — a fixed zero is worse than a blank, because it looks
        // measured rather than missing.
        rating: 0,
        reviewsCount: 0,
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
        socialLinks: shopData.socialLinks,
        contactWhatsapp: shopData.contactWhatsapp,
        contactPhone: shopData.contactPhone,
        contactEmail: shopData.contactEmail,
        isLive: liveSession?.status === 'live',
      } as any;
      setSeller(composedSeller);
    }

    if (productData) {
      // Admin-unpublished listings stay in the seller's own inventory but are
      // hidden from this public storefront.
      setProducts(productData.filter((p) => !p.unpublished));
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

  // The real numbers, from the same source the app uses.
  const rating = trust?.reviews.average ?? 0;
  const reviewsCount = trust?.reviews.count ?? 0;
  const areaLabel = trust?.business
    ? [trust.business.areaName, trust.business.cityName].filter(Boolean).join(', ')
    : seller?.location;

  const sellerWithRealNumbers: Seller = {
    ...seller,
    rating,
    reviewsCount,
    location: areaLabel || seller.location,
    // While the payload is still in flight we keep the value the profile
    // already gave us. Replacing it with `false` would make the tick blink out
    // and back on every page load, which reads as "verification was removed".
    isVerified: trust ? trust.business?.verificationStatus === 'verified' : seller.isVerified,
  } as any;

  // The seller's REAL product categories, in order of how many products carry
  // them — shown under the shop name and used by the category bar. Derived,
  // never hardcoded, so it always matches this seller's data.
  const shopCategories = (() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const c = (p.category ?? '').trim();
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  })();

  return (
    <MainLayout>
        {isBuyer && <BuyerHeader />}
        <div className="bg-background text-foreground">
            <PublicSellerHeader seller={sellerWithRealNumbers} categories={shopCategories} />
            <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {/* Verification, the real rating and where this business works —
                identical to what the app shows, because it is the same
                component reading the same endpoint. */}
            <BusinessTrustPanel
              sellerId={sellerId}
              origin={trust?.business ? undefined : null}
              onLoaded={setTrust}
              className="py-5"
            />
            <SellerTabs seller={sellerWithRealNumbers} products={products} liveSession={liveSession} trust={trust} />
            </div>
            {/* Bottom action row — Shop · Chat Seller · Share Shop · Save Shop,
                reusing the same follow/chat/share handlers as the header. */}
            <ShopBottomActions seller={sellerWithRealNumbers} />
      </div>
    </MainLayout>
  );
}
