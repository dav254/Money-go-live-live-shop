
'use client';

import { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import { useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query } from 'firebase/firestore';
import type { Product, Seller, SellerShop, UserProfile, VideoFeedItem } from '@/lib/types';
import { useFirestore, useUser } from '@/firebase';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { VideoCard } from '@/components/feed/video-card';
import { cn } from '@/lib/utils';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

function RealtimeVideoCard({ product, mediaUrl, mediaType, onScroll }: { product: Product; mediaUrl: string; mediaType: 'image' | 'video', onScroll: (direction: 'up' | 'down') => void; }) {
    const firestore = useFirestore();
    
    const sellerShopRef = useMemoFirebase(() => {
        if (!firestore || !product.sellerId) return null;
        return doc(firestore, 'sellerShops', product.sellerId);
    }, [firestore, product.sellerId]);
    
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !product.sellerId) return null;
        return doc(firestore, 'userProfiles', product.sellerId);
    }, [firestore, product.sellerId]);

    const { data: sellerData, isLoading: isSellerLoading } = useDoc<SellerShop>(sellerShopRef);
    const { data: userProfileData, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

    if (isSellerLoading || isProfileLoading) {
        return (
             <div className="h-full w-full snap-start flex-shrink-0 bg-black flex items-center justify-center">
                <Skeleton className="h-full w-full" />
            </div>
        )
    }
    
    const sellerName = sellerData?.shopName || userProfileData?.fullName || 'Seller Store';
    const sellerFollowers = sellerData?.followers || 0;
    const sellerReviews = sellerData?.reviewsCount || 0;

    const seller: Seller = {
        id: product.sellerId,
        sellerId: product.sellerId,
        name: sellerName,
        avatar: {
            id: 'avatar',
            imageUrl: sellerData?.logoUrl || userProfileData?.profilePictureUrl || getPlaceholderImage(),
            description: `${sellerName}'s avatar`,
            imageHint: 'seller avatar'
        },
        banner: {
            id: 'banner',
            imageUrl: sellerData?.bannerUrl || getPlaceholderImage(),
            description: `${sellerName}'s banner`,
            imageHint: 'store banner'
        },
        bio: sellerData?.description || userProfileData?.bio || 'Welcome!',
        rating: 4.8, // Placeholder
        followers: sellerFollowers,
        reviewsCount: sellerReviews,
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
        viewers: 0, // View count removed
        comments: [], // Placeholder
    };

    return (
        <div className="h-full w-full snap-start flex-shrink-0">
          <VideoCard item={feedItem} onScroll={onScroll} />
        </div>
    );
}

export default function LivePage() {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();

    const productsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        // Query for all products to create a full feed
        return query(collection(firestore, 'products'));
    }, [firestore]);

    const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

    const isLoading = isUserLoading || areProductsLoading;

    const feedMediaItems = useMemo(() => {
        if (!products) return [];

        const allMedia: {product: Product, mediaUrl: string, mediaType: 'video' | 'image'}[] = [];
        products.forEach(product => {
            if (product.videoUrls && product.videoUrls.length > 0) {
                product.videoUrls.forEach(url => allMedia.push({ product, mediaUrl: url, mediaType: 'video' }));
            }
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
            <BuyerLayout>
                <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center">
                    <p>Loading the live feed...</p>
                </div>
            </BuyerLayout>
        );
    }

    return (
        <BuyerLayout>
            <div className="relative h-[calc(100vh-4rem)] w-full">
                <div 
                    ref={scrollContainerRef}
                    className={cn(
                        "h-full w-full snap-y snap-mandatory overflow-y-scroll",
                        // This will hide the scrollbar in WebKit browsers (Chrome, Safari)
                        "[&::-webkit-scrollbar]:hidden",
                        // This will hide the scrollbar in Firefox
                        "scrollbar-hide"
                    )}
                >
                {feedMediaItems && feedMediaItems.length > 0 ? (
                    feedMediaItems.map((item, index) => (
                        <RealtimeVideoCard 
                            key={`${item.product.id}-${index}`} 
                            product={item.product} 
                            mediaUrl={item.mediaUrl}
                            mediaType={item.mediaType}
                            onScroll={handleScroll}
                        />
                    ))
                ) : (
                    <div className="h-full w-full snap-start flex-shrink-0 flex items-center justify-center bg-muted">
                        <div className="text-center p-4">
                            <h2 className="text-xl font-semibold">The Live Feed is Currently Empty</h2>
                            <p className="text-muted-foreground max-w-sm mx-auto">There are no live videos or images to display at the moment. Please check back later for new content.</p>
                        </div>
                    </div>
                )}
                </div>
            </div>
        </BuyerLayout>
    );
}
