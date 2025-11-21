
'use client';

import { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import { useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import type { Product, Seller, SellerShop, UserProfile, VideoFeedItem } from '@/lib/types';
import { useFirestore, useUser } from '@/firebase';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { VideoCard } from '@/components/feed/video-card';
import { cn } from '@/lib/utils';
import { SellerLayout } from '@/components/layout/seller-layout';
import Link from 'next/link';

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

    const { data: sellerData, isLoading: isSellerLoading } = useDoc<SellerShop>(sellerShopRef);
    const { data: userProfileData, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

    if (isSellerLoading || isProfileLoading) {
        return (
             <div className="h-full w-full snap-start flex-shrink-0 bg-black flex items-center justify-center">
                <p className="text-white">Loading your feed...</p>
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
        followers: sellerData?.followers || 0,
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
        viewers: Math.floor(Math.random() * 50) + 1, // Placeholder for preview
        comments: [], // Placeholder
    };

    return (
        <div className="h-full w-full snap-start flex-shrink-0">
          <VideoCard item={feedItem} onScroll={onScroll} />
        </div>
    );
}

export default function SellerLivePage() {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();

    const productsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        // Query for products where the sellerId matches the current user's ID
        return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
    }, [firestore, user]);

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
            <SellerLayout>
                <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center">
                    <p>Loading your product feed...</p>
                </div>
            </SellerLayout>
        );
    }

    return (
        <SellerLayout>
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
                    <div className="h-full w-full snap-start flex-shrink-0 flex items-center justify-center bg-muted">
                        <div className="text-center p-4">
                            <h2 className="text-xl font-semibold">Your Live Preview is Empty</h2>
                            <p className="text-muted-foreground max-w-sm mx-auto">This page shows how your products will look in the main feed. Upload products with images or videos to see them here.</p>
                            <Link href="/dashboard/products">
                                <button className="mt-4 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                                    Add Your First Product
                                </button>
                            </Link>
                        </div>
                    </div>
                )}
                </div>
            </div>
        </SellerLayout>
    );
}

    