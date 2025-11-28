
'use client';

import { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query } from 'firebase/firestore';
import type { Product, Seller, SellerShop, UserProfile, VideoFeedItem } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { VideoCard } from '@/components/feed/video-card';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { useUser } from '@/firebase/auth/use-user';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { useRouter, useSearchParams } from 'next/navigation';

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
        followers: sellerData?.followers || 0,
        reviewsCount: sellerData?.reviewsCount || 0,
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

function VideoFeed() {
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

    return (
        <div className="relative h-[calc(100vh-4rem)]">
            <div 
                ref={scrollContainerRef}
                className="h-full w-full snap-y snap-mandatory overflow-y-scroll"
            >
             {isLoading ? (
                <div className="h-full w-full snap-start flex-shrink-0 flex items-center justify-center bg-black">
                    <p className="text-white">Loading live shows...</p>
                </div>
             ) : feedMediaItems && feedMediaItems.length > 0 ? (
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
    )
}

export default function HomePage() {
    const { user, isLoading } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
    const router = useRouter();
    const searchParams = useSearchParams();

    // Capture and store the reseller referral ID from the URL
    useEffect(() => {
        const refId = searchParams.get('ref');
        if (refId) {
            localStorage.setItem('resellerRefId', refId);
        }
    }, [searchParams]);

    // This effect handles role-based redirection after the component has rendered.
    useEffect(() => {
        if (isLoading || isProfileLoading) {
            return; // Wait until user data is loaded
        }

        if (user && userProfile) {
            if (userProfile.userRole === 'admin') {
                router.replace('/dashboard/admin');
            } else if (userProfile.userRole === 'seller') {
                router.replace('/dashboard/seller');
            } else if (userProfile.userRole === 'reseller') {
                router.replace('/dashboard/reseller');
            }
        }
    }, [user, userProfile, isLoading, isProfileLoading, router]);

    // Show a loading state while we determine the user's role and redirect
    if (isLoading || isProfileLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <p>Loading...</p>
            </div>
        );
    }
    
    // If the user is a buyer, show the BuyerLayout.
    if (user && userProfile?.userRole === 'buyer') {
        return (
            <BuyerLayout>
                <VideoFeed />
            </BuyerLayout>
        )
    }

    // Default view for guests or roles that are about to be redirected.
    return (
        <MainLayout>
            <VideoFeed />
        </MainLayout>
    );
}
