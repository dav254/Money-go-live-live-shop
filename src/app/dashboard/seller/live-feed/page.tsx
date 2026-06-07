'use client';

import { useCallback, useRef, useState, useEffect, Suspense } from 'react';
import { useCollection, useDoc, useMemoFirebase, useUserProfile } from '@/firebase';
import { collection, doc, query, orderBy, limit, where, documentId } from 'firebase/firestore';
import type { Product, Seller, SellerShop, UserProfile, VideoFeedItem, LiveSession } from '@/lib/types';
import { useFirestore, useUser } from '@/firebase';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { VideoCard } from '@/components/feed/video-card';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search, ChevronLeft, Video, Heart, X, Loader2, Bookmark } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Badge } from '@/components/ui/badge';

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
        <div className="h-full w-full snap-start flex-shrink-0 relative">
          <VideoCard item={feedItem} isIntersecting={isIntersecting} onScroll={onScroll} />
           <div className="absolute bottom-24 right-4 z-20">
              <Badge variant={product.condition === 'new' ? 'default' : 'secondary'} className="capitalize text-sm py-1 px-3 shadow-lg">
                  {product.condition}
              </Badge>
          </div>
        </div>
    );
}

function LiveFeedContent() {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const { user, isLoading: isUserLoading } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
    const firestore = useFirestore();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [intersectingCard, setIntersectingCard] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const view = searchParams.get('view') || 'all';

    const productsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        
        if (view === 'saved' && userProfile) {
            const wishlist = userProfile.wishlist || [];
            if (wishlist.length === 0) return null;
            return query(
                collection(firestore, 'products'),
                where(documentId(), 'in', wishlist.slice(0, 30))
            );
        }

        return query(
            collection(firestore, 'products'), 
            orderBy('uploadDate', 'desc'), 
            limit(10)
        );
    }, [firestore, view, userProfile]);

    const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);
    const isLoading = isUserLoading || areProductsLoading || isProfileLoading;

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
                <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
                <p className="text-white font-black uppercase tracking-widest text-xs">Syncing Immersive Stream...</p>
            </div>
        );
    }

    return (
        <div className="relative h-screen w-full bg-black overflow-hidden">
            <div className="absolute top-0 left-0 right-0 z-50 p-4 flex items-center gap-2 bg-gradient-to-b from-black/80 to-transparent">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-white bg-black/20 hover:bg-black/40 rounded-full"
                    onClick={() => router.push('/dashboard/seller')}
                >
                    <ChevronLeft className="h-6 w-6" />
                </Button>
                <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md mx-auto">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70 group-focus-within:text-primary transition-colors" />
                        <Input 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={view === 'saved' ? "Search your saved items..." : "Search global discovery..."} 
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 pl-10 rounded-full focus:bg-white/20 focus:border-primary/50 backdrop-blur-md transition-all h-10 md:h-11"
                        />
                    </div>
                </form>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="hidden md:flex border-white/10 bg-black/40 text-white font-black uppercase tracking-widest text-[9px] h-8 px-3">
                        {view === 'saved' ? 'Saved Collection' : 'Global Discovery'}
                    </Badge>
                </div>
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
                <div className="h-full w-full snap-start flex-shrink-0 flex items-center justify-center bg-neutral-950">
                    <div className="text-center p-8 max-w-sm">
                        <div className="p-4 bg-white/5 rounded-full w-fit mx-auto mb-6">
                            {view === 'saved' ? <Bookmark className="h-10 w-10 text-neutral-500" /> : <Video className="h-10 w-10 text-neutral-500" />}
                        </div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">
                            {view === 'saved' ? 'Your Saved Items are Empty' : 'Discovery Empty'}
                        </h2>
                        <p className="text-neutral-500 text-sm font-medium leading-relaxed mb-8">
                            {view === 'saved' 
                                ? "You haven't saved any products yet. Heart some items in the Discovery Feed to see them here." 
                                : "We couldn't find any media to show right now. Check back later!"}
                        </p>
                        {view === 'saved' && (
                            <Button asChild className="font-black uppercase tracking-widest text-xs h-12 rounded-xl">
                                <Link href="/dashboard/seller/live-feed">Explore Discovery Feed</Link>
                            </Button>
                        )}
                    </div>
                </div>
            )}
            </div>
        </div>
    );
}

export default function SellerLiveFeedPage() {
  return (
    <SellerLayout fullWidth>
      <Suspense fallback={
        <div className="flex h-screen w-full items-center justify-center bg-black">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <LiveFeedContent />
      </Suspense>
    </SellerLayout>
  );
}