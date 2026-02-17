
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { ProductCard } from '@/components/products/product-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Package, Video, CreditCard, LayoutGrid, ShoppingBag, Laptop, Home as HomeIcon, Heart, Apple, Dumbbell, Palette, Book, Radio, Users, ChevronRight, Zap } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, limit, orderBy, where, doc } from 'firebase/firestore';
import type { Product, SellerShop, HomepageSlide, LiveSession, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPlaceholderImage } from '@/lib/placeholder-images';

const categoryIcons: Record<string, React.ElementType> = {
    "Fashion & Apparel": ShoppingBag,
    "Electronics & Gadgets": Laptop,
    "Home & Living": HomeIcon,
    "Beauty & Personal Care": Heart,
    "Food & Groceries": Apple,
    "Sports & Outdoors": Dumbbell,
    "Art & Collectibles": Palette,
    "Books & Stationery": Book,
    "Other": LayoutGrid
};

const shortcuts = [
  {
    title: 'My Orders',
    icon: Package,
    href: '/buyer/my-orders',
    color: 'bg-blue-500/20 text-blue-500',
  },
  {
    title: 'Wallet',
    icon: CreditCard,
    href: '/buyer/wallet',
    color: 'bg-green-500/20 text-green-500',
  },
  {
    title: 'Live Now',
    icon: Radio,
    href: '/buyer/live-now',
    color: 'bg-red-500/20 text-red-500',
  },
];

const SellerInfo = ({ sellerId }: { sellerId: string }) => {
  const firestore = useFirestore();
  const userRef = useMemoFirebase(() => doc(firestore, 'userProfiles', sellerId), [firestore, sellerId]);
  const { data: user, isLoading } = useDoc<UserProfile>(userRef);

  if (isLoading) return <Skeleton className="h-4 w-24" />;
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-5 w-5 border border-white/10">
        <AvatarImage src={user?.profilePictureUrl || getPlaceholderImage()} />
        <AvatarFallback className="text-[8px]">{user?.fullName?.charAt(0) || 'S'}</AvatarFallback>
      </Avatar>
      <span className="text-[10px] font-black text-neutral-300 truncate max-w-[80px] uppercase tracking-tight">
        {user?.shopName || user?.fullName || 'Seller'}
      </span>
    </div>
  );
};

const StreamCard = ({ session }: { session: LiveSession }) => {
  return (
    <Link href={`/buyer/live/${session.id}`}>
        <Card className="group relative h-40 sm:h-48 overflow-hidden border-none bg-neutral-900 ring-1 ring-white/10 hover:ring-primary/50 transition-all duration-300 shadow-2xl rounded-2xl">
            <div className="absolute inset-0">
                <Image
                    src={`https://picsum.photos/seed/${session.id}/600/400`}
                    alt={session.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110 opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            </div>
            
            <div className="absolute top-3 left-3 z-10">
                <Badge className="bg-red-600 hover:bg-red-700 flex items-center gap-1 animate-pulse border-none text-[9px] font-black px-2 py-0.5 rounded-full">
                    <Radio className="h-3 w-3" /> LIVE
                </Badge>
            </div>

            <div className="absolute bottom-3 left-3 right-3 z-10 space-y-1.5">
                <h3 className="font-headline text-[11px] sm:text-xs font-black text-white leading-tight line-clamp-2 uppercase tracking-tighter drop-shadow-md">
                    {session.title}
                </h3>
                <div className="flex items-center justify-between">
                    <SellerInfo sellerId={session.sellerId} />
                    <div className="flex items-center gap-1 text-[9px] font-black text-white/70">
                        <Users className="h-2.5 w-2.5 text-primary" /> {session.viewerCount || 0}
                    </div>
                </div>
            </div>
        </Card>
    </Link>
  );
};

const HomepageCarousel = () => {
    const firestore = useFirestore();
    const slidesQuery = useMemoFirebase(() => {
        return query(collection(firestore, 'homepageSlides'), orderBy('order'));
    }, [firestore]);

    const { data: slides, isLoading } = useCollection<HomepageSlide>(slidesQuery);

    if (isLoading || !slides || slides.length === 0) {
        return <Skeleton className="w-full aspect-[16/9] sm:aspect-[16/7] rounded-3xl" />;
    }

    return (
        <Carousel
            opts={{ loop: true }}
            className="w-full"
        >
            <CarouselContent>
                {slides.map(slide => (
                    <CarouselItem key={slide.id}>
                        <div className="relative aspect-[16/10] sm:aspect-[16/7] w-full overflow-hidden rounded-3xl group">
                            <Image
                                src={slide.imageUrl}
                                alt={slide.title || 'Promotional slide'}
                                fill
                                sizes="100vw"
                                className="object-cover transition-transform duration-1000 group-hover:scale-105"
                                priority
                                data-ai-hint={slide.imageHint}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <div className="absolute bottom-0 left-0 p-6 sm:p-10 text-white max-w-2xl">
                                <h2 className="font-headline text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-none mb-3">{slide.title}</h2>
                                <p className="text-xs sm:text-base font-bold text-white/70 uppercase tracking-widest line-clamp-2 mb-6">{slide.description}</p>
                                <Button asChild className="rounded-xl h-12 px-8 font-black uppercase tracking-widest text-xs" size={"lg"}>
                                    <Link href={slide.href}>Shop Now</Link>
                                </Button>
                            </div>
                        </div>
                    </CarouselItem>
                ))}
            </CarouselContent>
            <CarouselPrevious className="hidden lg:flex" />
            <CarouselNext className="hidden lg:flex" />
        </Carousel>
    );
};

const ProductCarouselSkeleton = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-1">
                <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
        ))}
    </div>
);

export default function BuyerDashboardPage() {
  const firestore = useFirestore();
  const [lastViewedCategory, setLastViewedCategory] = useState<string | null>(null);

  useEffect(() => {
    const randomCategory = PRODUCT_CATEGORIES[Math.floor(Math.random() * PRODUCT_CATEGORIES.length)];
    setLastViewedCategory(randomCategory);
  }, []);

  const liveSessionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'liveSessions'), where('status', '==', 'live'), limit(10));
  }, [firestore]);

  const dealsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'products'), where('wasPrice', '>', 0), limit(10));
  }, [firestore]);

  const recommendedQuery = useMemoFirebase(() => {
    if (!firestore || !lastViewedCategory) return null;
    return query(collection(firestore, 'products'), where('category', '==', lastViewedCategory), limit(10));
  }, [firestore, lastViewedCategory]);

  const { data: liveSessions, isLoading: isLoadingSellers } = useCollection<LiveSession>(liveSessionsQuery);
  const { data: dealsProducts, isLoading: isLoadingDeals } = useCollection<Product>(dealsQuery);
  const { data: recommendedProducts, isLoading: isLoadingRecs } = useCollection<Product>(recommendedQuery);
  
  return (
    <BuyerLayout>
        <div className="flex-1 space-y-8 sm:space-y-12 p-2 sm:p-4 pt-4 md:p-8">
            <HomepageCarousel />

            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
            {shortcuts.map((shortcut) => (
                <Card
                key={shortcut.title}
                className="group transition-all hover:shadow-xl hover:-translate-y-1 rounded-2xl border-white/5 bg-card/50"
                >
                <Link href={shortcut.href}>
                    <CardContent className="flex items-center justify-start gap-4 p-4 sm:p-6">
                    <div
                        className={cn(
                            "flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 shadow-lg",
                            shortcut.color
                        )}
                    >
                        <shortcut.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <h3 className="font-headline text-sm sm:text-base font-black uppercase tracking-tighter">
                        {shortcut.title}
                    </h3>
                    </CardContent>
                </Link>
                </Card>
            ))}
            </div>

            {liveSessions && liveSessions.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                            <div className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </div>
                            <h2 className="font-headline text-lg sm:text-xl font-black uppercase tracking-widest">Trending Live</h2>
                        </div>
                        <Button variant="ghost" asChild className="text-[10px] font-black uppercase tracking-widest text-primary h-8"><Link href="/buyer/live-now">Explore All</Link></Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                        {liveSessions.map((session) => (
                            <StreamCard key={session.id} session={session} />
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h2 className="font-headline text-lg sm:text-xl font-black uppercase tracking-widest flex items-center gap-2">
                        <LayoutGrid className="h-5 w-5 text-primary" /> Categories
                    </h2>
                    <Button variant="ghost" asChild className="text-[10px] font-black uppercase tracking-widest text-primary h-8"><Link href="/categories">View All</Link></Button>
                </div>
                <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-hide">
                    {PRODUCT_CATEGORIES.slice(0, 8).map((cat) => {
                        const Icon = categoryIcons[cat] || LayoutGrid;
                        return (
                            <Link key={cat} href={`/search?q=${encodeURIComponent(cat)}`} className="flex flex-col items-center gap-2 group flex-shrink-0">
                                <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-white/5 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 flex items-center justify-center border border-white/5 shadow-md group-hover:shadow-primary/20">
                                    <Icon className="h-6 w-6 sm:h-8 sm:w-8" />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-tight text-center w-16 sm:w-20 line-clamp-2 text-muted-foreground group-hover:text-white">{cat}</span>
                            </Link>
                        )
                    })}
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                    <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    <h2 className="font-headline text-lg sm:text-xl font-black uppercase tracking-widest">Today's Deals</h2>
                </div>
                {isLoadingDeals ? <ProductCarouselSkeleton /> : (
                    <Carousel
                        opts={{ align: 'start' }}
                        className="w-full"
                    >
                        <CarouselContent className="-ml-2 sm:-ml-4">
                        {(dealsProducts || []).map((product) => (
                            <CarouselItem
                            key={product.id}
                            className="basis-1/2 sm:basis-1/3 lg:basis-1/4 xl:basis-1/5 pl-2 sm:pl-4"
                            >
                            <div className="p-1 h-full">
                                <ProductCard product={product} />
                            </div>
                            </CarouselItem>
                        ))}
                        </CarouselContent>
                        <CarouselPrevious className="hidden lg:flex" />
                        <CarouselNext className="hidden lg:flex" />
                    </Carousel>
                )}
            </div>

            <div className="space-y-4 pb-10">
                <div className="flex items-center gap-3 px-2">
                    <Heart className="h-5 w-5 text-pink-500 fill-pink-500" />
                    <h2 className="font-headline text-lg sm:text-xl font-black uppercase tracking-widest">For You</h2>
                </div>
                {isLoadingRecs ? (
                    <ProductCarouselSkeleton />
                ) : recommendedProducts && recommendedProducts.length > 0 ? (
                    <Carousel
                        opts={{ align: 'start' }}
                        className="w-full"
                    >
                        <CarouselContent className="-ml-2 sm:-ml-4">
                        {recommendedProducts.map((product) => (
                            <CarouselItem
                            key={product.id}
                            className="basis-1/2 sm:basis-1/3 lg:basis-1/4 xl:basis-1/5 pl-2 sm:pl-4"
                            >
                            <div className="p-1 h-full">
                                <ProductCard product={product} />
                            </div>
                            </CarouselItem>
                        ))}
                        </CarouselContent>
                        <CarouselPrevious className="hidden lg:flex" />
                        <CarouselNext className="hidden lg:flex" />
                    </Carousel>
                ) : (
                    <div className="text-center p-12 border-2 border-dashed rounded-3xl border-white/5 opacity-30">
                        <p className="font-black uppercase tracking-widest text-[10px]">Browsing data needed for personalized recs</p>
                    </div>
                )}
            </div>
        </div>
    </BuyerLayout>
  );
}
