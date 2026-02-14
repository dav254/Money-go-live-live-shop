
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
import { Package, Video, CreditCard, LayoutGrid, ShoppingBag, Laptop, Home as HomeIcon, Heart, Apple, Dumbbell, Palette, Book, Radio, Users } from 'lucide-react';
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
    title: 'Payment Methods',
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
      <span className="text-xs font-bold text-neutral-300 truncate max-w-[100px]">
        {user?.shopName || user?.fullName || 'Seller'}
      </span>
    </div>
  );
};

const StreamCard = ({ session }: { session: LiveSession }) => {
  return (
    <Link href={`/buyer/live/${session.id}`}>
        <Card className="group relative h-48 overflow-hidden border-none bg-neutral-900 ring-1 ring-white/10 hover:ring-primary/50 transition-all duration-300 shadow-2xl">
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
                <Badge className="bg-red-600 hover:bg-red-700 flex items-center gap-1 animate-pulse border-none text-[10px] font-black px-2 py-0.5">
                    <Radio className="h-3 w-3" /> LIVE
                </Badge>
            </div>

            <div className="absolute bottom-3 left-3 right-3 z-10 space-y-2">
                <h3 className="font-headline text-sm font-bold text-white leading-tight line-clamp-2 drop-shadow-md">
                    {session.title}
                </h3>
                <div className="flex items-center justify-between">
                    <SellerInfo sellerId={session.sellerId} />
                    <div className="flex items-center gap-1 text-[10px] font-black text-white/70">
                        <Users className="h-3 w-3 text-primary" /> {session.viewerCount || 0}
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
        return <Skeleton className="w-full aspect-video md:aspect-[16/7] rounded-lg" />;
    }

    return (
        <Carousel
            opts={{ loop: true }}
            className="w-full"
        >
            <CarouselContent>
                {slides.map(slide => (
                    <CarouselItem key={slide.id}>
                        <div className="relative aspect-video md:aspect-[16/7] w-full overflow-hidden rounded-lg">
                            <Image
                                src={slide.imageUrl}
                                alt={slide.title || 'Promotional slide'}
                                fill
                                sizes="100vw"
                                className="object-cover"
                                priority
                                data-ai-hint={slide.imageHint}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <div className="absolute bottom-0 left-0 p-4 md:p-8 text-white">
                                <h2 className="font-headline text-2xl md:text-4xl font-bold">{slide.title}</h2>
                                <p className="mt-2 max-w-md text-sm md:text-base">{slide.description}</p>
                                <Button asChild className="mt-4" size={"sm"}>
                                    <Link href={slide.href}>Shop Now</Link>
                                </Button>
                            </div>
                        </div>
                    </CarouselItem>
                ))}
            </CarouselContent>
            <CarouselPrevious className="hidden md:flex" />
            <CarouselNext className="hidden md:flex" />
        </Carousel>
    );
};

const ProductCarouselSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-1">
                <Skeleton className="h-64 w-full" />
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
        <div className="flex-1 space-y-12 p-4 pt-6 md:p-8">
            <HomepageCarousel />

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            {shortcuts.map((shortcut) => (
                <Card
                key={shortcut.title}
                className="group transition-all hover:shadow-lg hover:-translate-y-1"
                >
                <Link href={shortcut.href}>
                    <CardContent className="flex items-center justify-start gap-4 p-4 md:p-6">
                    <div
                        className={`flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-lg ${shortcut.color} transition-colors group-hover:bg-primary group-hover:text-primary-foreground`}
                    >
                        <shortcut.icon className="h-5 w-5 md:h-6 md:w-6" />
                    </div>
                    <h3 className="font-headline text-base md:text-lg font-semibold">
                        {shortcut.title}
                    </h3>
                    </CardContent>
                </Link>
                </Card>
            ))}
            </div>

            {/* LIVE NOW SECTION - TRENDING */}
            {liveSessions && liveSessions.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </div>
                            <h2 className="font-headline text-2xl font-black uppercase tracking-tighter">Trending Live Shopping</h2>
                        </div>
                        <Button variant="link" asChild className="font-bold text-red-500"><Link href="/buyer/live-now">View All</Link></Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {liveSessions.map((session) => (
                            <StreamCard key={session.id} session={session} />
                        ))}
                    </div>
                </div>
            )}

            {/* Categories Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-headline text-2xl font-bold">Shop by Category</h2>
                    <Button variant="link" asChild><Link href="/categories">View All</Link></Button>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                    {PRODUCT_CATEGORIES.slice(0, 8).map((cat) => {
                        const Icon = categoryIcons[cat] || LayoutGrid;
                        return (
                            <Link key={cat} href={`/search?q=${encodeURIComponent(cat)}`} className="flex flex-col items-center gap-2 group flex-shrink-0">
                                <div className="h-16 w-16 rounded-2xl bg-muted group-hover:bg-primary group-hover:text-primary-foreground transition-all flex items-center justify-center border">
                                    <Icon className="h-8 w-8" />
                                </div>
                                <span className="text-xs font-medium text-center w-20 line-clamp-2">{cat}</span>
                            </Link>
                        )
                    })}
                </div>
            </div>

            <div className="space-y-4">
            <h2 className="font-headline text-2xl font-bold">Today's Deals</h2>
            {isLoadingDeals ? <ProductCarouselSkeleton /> : (
                <Carousel
                    opts={{ align: 'start' }}
                    className="w-full"
                >
                    <CarouselContent>
                    {(dealsProducts || []).map((product) => (
                        <CarouselItem
                        key={product.id}
                        className="basis-1/2 sm:basis-1/3 lg:basis-1/4 xl:basis-1/5"
                        >
                        <div className="p-1">
                            <ProductCard product={product} />
                        </div>
                        </CarouselItem>
                    ))}
                    </CarouselContent>
                    <CarouselPrevious className="hidden md:flex" />
                    <CarouselNext className="hidden md:flex" />
                </Carousel>
            )}
            </div>

            <div className="space-y-4">
            <h2 className="font-headline text-2xl font-bold">
                Recommended For You
            </h2>
            {isLoadingRecs ? (
                <ProductCarouselSkeleton />
            ) : recommendedProducts && recommendedProducts.length > 0 ? (
                <Carousel
                    opts={{ align: 'start' }}
                    className="w-full"
                >
                    <CarouselContent>
                    {recommendedProducts.map((product) => (
                        <CarouselItem
                        key={product.id}
                        className="basis-1/2 sm:basis-1/3 lg:basis-1/4 xl:basis-1/5"
                        >
                        <div className="p-1">
                            <ProductCard product={product} />
                        </div>
                        </CarouselItem>
                    ))}
                    </CarouselContent>
                    <CarouselPrevious className="hidden md:flex" />
                    <CarouselNext className="hidden md:flex" />
                </Carousel>
            ) : (
                <div className="text-center text-muted-foreground p-8 border border-dashed rounded-lg">
                    <p>No recommendations found for you right now.</p>
                    <p className="text-sm">Browse more products to get personalized suggestions!</p>
                </div>
            )}
            </div>
        </div>
    </BuyerLayout>
  );
}
