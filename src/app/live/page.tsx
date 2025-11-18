'use client';

import { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import { VideoCard } from '@/components/feed/video-card';
import { MainLayout } from '@/components/layout/main-layout';
import { useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query } from 'firebase/firestore';
import type { Product, Seller, VideoFeedItem } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { getPlaceholderImage } from '@/lib/placeholder-images';

function RealtimeVideoCard({ product, mediaUrl, mediaType, onScroll }: { product: Product; mediaUrl: string; mediaType: 'image' | 'video', onScroll: (direction: 'up' | 'down') => void; }) {
    const firestore = useFirestore();
    
    const sellerShopRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return product.sellerId ? doc(firestore, 'sellerShops', product.sellerId) : null;
    }, [firestore, product.sellerId]);
    
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return product.sellerId ? doc(firestore, 'userProfiles', product.sellerId) : null;
    }, [firestore, product.sellerId]);

    const { data: sellerData, isLoading: isSellerLoading } = useDoc<Seller>(sellerShopRef);
    const { data: userProfileData, isLoading: isProfileLoading } = useDoc<any>(userProfileRef);

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
        video: {
          id: product.id + mediaUrl, 
          imageUrl: mediaUrl,
          description: product.name,
          imageHint: mediaType,
          mediaType: mediaType,
        },
        likes: product.likes || 0,
        viewers: Math.floor(Math.random() * 3000) + 100, // Placeholder
        comments: [], // Placeholder
    };

    return (
        <div className="h-full w-full snap-start flex-shrink-0">
          <VideoCard item={feedItem} onScroll={onScroll} />
        </div>
    );
}


export default function LiveFeedPage() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const firestore = useFirestore();
  
  const productsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'products'));
  }, [firestore]);

  const { data: products, isLoading } = useCollection<Product>(productsQuery);

  const feedMediaItems = useMemo(() => {
    if (!products) return [];

    const allMedia: {product: Product, mediaUrl: string, mediaType: 'video' | 'image'}[] = [];
    products.forEach(product => {
      // Prioritize videos
      if (product.videoUrls && product.videoUrls.length > 0) {
        product.videoUrls.forEach(url => allMedia.push({ product, mediaUrl: url, mediaType: 'video' }));
      }
      // Then add images
      if (product.imageUrls && product.imageUrls.length > 0) {
        product.imageUrls.forEach(url => allMedia.push({ product, mediaUrl: url, mediaType: 'image' }));
      }
    });

    return allMedia;
  }, [products]);

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
          {feedMediaItems && feedMediaItems.length > 0 ? (
             feedMediaItems.map((item) => (
                <RealtimeVideoCard 
                  key={item.product.id + item.mediaUrl} 
                  product={item.product} 
                  mediaUrl={item.mediaUrl}
                  mediaType={item.mediaType}
                  onScroll={handleScroll}
                />
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
