'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, orderBy, limit } from 'firebase/firestore';
import type { Product, Seller, SellerShop, UserProfile, VideoFeedItem, LiveSession } from '@/lib/types';
import { useFirestore, useUser } from '@/firebase';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { VideoCard } from '@/components/feed/video-card';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

function RealtimeVideoCard({ product, isIntersecting, onScroll }: { product: Product; isIntersecting: boolean, onScroll: (direction: 'up' | 'down') => void; }) {
    const firestore = useFirestore();
    
    const sellerShopRef = useMemoFirebase(() => {
        if (!firestore || !product.sellerId) return null;
        return doc(firestore, 'sellerShops', product.sellerId);
    }, [firestore, product.sellerId]);
    
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !product.sellerId) return null;
        return doc(firestore, 'userProfiles', product.sellerId);
    }, [firestore, product.sellerId]);

    const liveSessionRef = useMemoFirebase(() => {
        if (!firestore || !product.sellerId) return null;
        return doc(firestore, 'liveSessions', product.sellerId);
    }, [firestore, product.sellerId]);

    const { data: sellerData } = useDoc<SellerShop>(sellerShopRef);
    const { data: userProfileData } = useDoc<UserProfile>(userProfileRef);
    const { data: liveSession } = useDoc<LiveSession>(liveSessionRef);

    const isLive = liveSession?.status === 'live';
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
        rating: 0, 
        followers: sellerFollowers,
        reviewsCount: sellerReviews,
        isVerified: userProfileData?.verificationStatus === 'verified',
        isLive: isLive,
        joinedDate: userProfileData?.joinDate || new Date().toISOString(),
        location: sellerData?.location || userProfileData?.location || 'Unknown',
        description: sellerData?.description || userProfileData?.bio || 'Welcome!',
    };

    const feedItem: VideoFeedItem = {
        id: product.id,
        product: product,
        seller: seller,
        video: {
          id: product.id,
          imageUrl: product.imageUrl || getPlaceholderImage(),
          description: product.name || 'product media',
          imageHint: 'product',
          mediaType: (product.videoUrl && product.videoUrl.trim() !== "") ? 'video' : 'image',
        },
        likes: product.likes || 0,
        viewers: isLive ? (liveSession?.viewerCount || 0) : 0, 
        comments: [],
    };

    return (
        <div className="h-full w-full snap-start flex-shrink-0">
          <VideoCard item={feedItem} isIntersecting={isIntersecting} onScroll={onScroll} />
        </div>
    );
}

export default function BuyerLiveFeedPage() {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const [intersectingCard, setIntersectingCard] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const productsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        // Fetch the 10 most recent products
        return query(collection(firestore, 'products'), orderBy('uploadDate', 'desc'), limit(10));
    }, [firestore]);

    const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);
    const isLoading = isUserLoading || areProductsLoading;

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

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setIntersectingCard(entry.target.getAttribute('data-product-id'));
                    }
                });
            },
            { threshold: 0.7 }
        );

        const cards = container.querySelectorAll('[data-product-id]');
        cards.forEach(card => observer.observe(card));

        return () => cards.forEach(card => observer.unobserve(card));

    }, [products]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };


    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black">
                <p className="text-white">Loading the live feed...</p>
            </div>
        );
    }

    return (
        <div className="relative h-screen w-full bg-black overflow-hidden">
            {/* Floating Header / Search Section */}
            <div className="absolute top-0 left-0 right-0 z-50 p-4 flex items-center gap-2 bg-gradient-to-b from-black/80 to-transparent">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-white bg-black/20 hover:bg-black/40 rounded-full"
                    onClick={() => router.push('/buyer/dashboard')}
                >
                    <ChevronLeft className="h-6 w-6" />
                </Button>
                <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md mx-auto">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70 group-focus-within:text-primary transition-colors" />
                        <Input 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search products or sellers..." 
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 pl-10 rounded-full focus:bg-white/20 focus:border-primary/50 backdrop-blur-md transition-all h-10 md:h-11"
                        />
                    </div>
                </form>
                {/* Spacer for symmetry on mobile */}
                <div className="w-10 md:hidden" />
            </div>

            <div 
                ref={scrollContainerRef}
                className={cn(
                    "h-full w-full snap-y snap-mandatory overflow-y-scroll",
                    "[&::-webkit-scrollbar]:hidden",
                    "scrollbar-hide"
                )}
            >
            {products && products.length > 0 ? (
                products.map((product) => (
                    <div key={product.id} data-product-id={product.id} className="h-full w-full snap-start flex-shrink-0">
                        <RealtimeVideoCard 
                            product={product} 
                            isIntersecting={intersectingCard === product.id}
                            onScroll={handleScroll}
                        />
                    </div>
                ))
            ) : (
                <div className="h-full w-full snap-start flex-shrink-0 flex items-center justify-center bg-muted">
                    <div className="text-center p-4">
                        <h2 className="text-xl font-semibold text-white">The Live Feed is Currently Empty</h2>
                        <p className="text-muted-foreground max-w-sm mx-auto">There are no videos or images to display at the moment. Please check back later for new content.</p>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
}
