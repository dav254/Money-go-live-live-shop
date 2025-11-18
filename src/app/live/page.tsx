
'use client';

import { useCallback, useRef } from 'react';
import { VideoCard } from '@/components/feed/video-card';
import { MainLayout } from '@/components/layout/main-layout';
import { useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { Product, Seller, VideoFeedItem } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { getPlaceholderImage } from '@/lib/placeholder-images';

function RealtimeVideoCard({ product }: { product: Product }) {
    const firestore = useFirestore();
    
    const sellerShopRef = useMemoFirebase(() => {
        return product.sellerId ? doc(firestore, 'sellerShops', product.sellerId) : null;
    }, [firestore, product.sellerId]);
    
    const userProfileRef = useMemoFirebase(() => {
        return product.sellerId ? doc(firestore, 'userProfiles', product.sellerId) : null;
    }, [firestore, product.sellerId]);

    const { data: sellerData, isLoading: isSellerLoading } = useDoc<Seller>(sellerShopRef);
    const { data: userProfileData, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

    const handleScroll = useCallback((direction: 'up' | 'down') => {
      // This is a placeholder as the main container handles scrolling
    }, []);

    if (isSellerLoading || isProfileLoading) {
        return (
             <div className="h-full w-full snap-start flex-shrink-0 bg-black flex items-center justify-center">
                <p className="text-white">Loading live feed...</p>
            </div>
        )
    }

    const seller: Seller = {
        id: product.sellerId,
        sellerId: product.sellerId,
        name: sellerData?.shopName || userProfileData?.fullName || 'Seller Store',
        avatar: {
            id: 'avatar',
            imageUrl: sellerData?.logoUrl || userProfileData?.profilePictureUrl || getPlaceholderImage(),
            description: 'Seller avatar',
            imageHint: 'seller avatar'
        },
        banner: {
            id: 'banner',
            imageUrl: sellerData?.bannerUrl || getPlaceholderImage(),
            description: 'Seller banner',
            imageHint: 'store banner'
        },
        bio: sellerData?.description || userProfileData?.bio || 'Welcome!',
        rating: 4.8, // Placeholder
        followers: 123, // Placeholder
        reviewsCount: 45, // Placeholder
        isVerified: true, // Placeholder
        joinedDate: userProfileData?.joinDate || new Date().toISOString(),
        location: sellerData?.location || userProfileData?.location || 'Unknown',
        description: sellerData?.description || userProfileData?.bio || 'Welcome!',
    };

    const feedItem: VideoFeedItem = {
        id: product.id,
        product: product,
        seller: seller,
        video: product.image || {id:'placeholder', imageUrl: getPlaceholderImage(), description: 'placeholder', imageHint: 'placeholder'},
        likes: product.likes || 0,
        viewers: Math.floor(Math.random() * 3000) + 100, // Placeholder
        comments: [], // Placeholder
    };

    return (
        <div className="h-full w-full snap-start flex-shrink-0">
          <VideoCard item={feedItem} onScroll={handleScroll} />
        </div>
    );
}


export default function LiveFeedPage() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const firestore = useFirestore();
  
  const productsQuery = useMemoFirebase(() => {
    return collection(firestore, 'products');
  }, [firestore]);

  const { data: products, isLoading } = useCollection<Product>(productsQuery);

  const handleScroll = useCallback((direction: 'up' | 'down') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = container.clientHeight;
    const currentScroll = container.scrollTop;

    let targetScroll;
    if (direction === 'down') {
      targetScroll = currentScroll + scrollAmount;
    } else {
      targetScroll = currentScroll - scrollAmount;
    }
    
    container.scrollTo({
        top: targetScroll,
        behavior: 'smooth',
    });
  }, []);

  if (isLoading) {
    return (
        <MainLayout>
             <div className="flex h-full w-full items-center justify-center">
                <p>Loading live shows...</p>
            </div>
        </MainLayout>
    )
  }


  return (
    <MainLayout>
      <div className="relative h-full w-full">
        <div 
          ref={scrollContainerRef}
          className="h-full w-full snap-y snap-mandatory overflow-y-scroll"
        >
          {products && products.length > 0 ? (
             products.map((product) => (
                <RealtimeVideoCard key={product.id} product={product} />
            ))
          ) : (
             <div className="h-full w-full snap-start flex-shrink-0 flex items-center justify-center bg-black">
                <p className="text-white">No live shows available right now.</p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
