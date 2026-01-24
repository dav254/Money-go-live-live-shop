
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { ProductCard } from '@/components/products/product-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Package, Video, CreditCard } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, limit, orderBy, where } from 'firebase/firestore';
import type { Product, SellerShop, HomepageSlide, LiveSession } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('https://5000-firebase-studio-1763190344911.cluster-lu4mup47g5gm4rtyvhzpwbfadi.cloudworkstations.dev');


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
    title: 'Live Shows',
    icon: Video,
    href: '/buyer/live-stream',
    color: 'bg-purple-500/20 text-purple-500',
  },
];

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

const SellerCarouselSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
        ))}
    </div>
);


export default function BuyerDashboardPage() {
  const firestore = useFirestore();
  const [lastViewedCategory, setLastViewedCategory] = useState<string | null>(null);
  const [liveSellers, setLiveSellers] = useState<any[]>([]);
  const [isLoadingSellers, setIsLoadingSellers] = useState(true);

  useEffect(() => {
    const categories = ['Fashion', 'Electronics', 'Home Goods', 'Beauty'];
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    setLastViewedCategory(randomCategory);
  }, []);

  useEffect(() => {
    socket.emit('get-sellers');
    
    socket.on('sellers-update', (updatedSellers) => {
        setLiveSellers(updatedSellers.slice(0, 4)); // Take only the first 4
        setIsLoadingSellers(false);
    });

    return () => {
        socket.off('sellers-update');
    };
  }, []);


  const dealsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'products'), where('wasPrice', '>', 0), limit(10));
  }, [firestore]);

  const recommendedQuery = useMemoFirebase(() => {
    if (!firestore || !lastViewedCategory) return null;
    return query(collection(firestore, 'products'), where('category', '==', lastViewedCategory), limit(10));
  }, [firestore, lastViewedCategory]);

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
                Trending Live Shows
            </h2>
            {isLoadingSellers ? <SellerCarouselSkeleton /> : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {liveSellers?.map((seller) => (
                    <Link href={`/sellers/${seller.streamId}`} key={seller.streamId}>
                        <Card className="group relative h-40 overflow-hidden">
                        <Image
                            src={`https://picsum.photos/seed/${seller.streamId}/600/400`}
                            alt={seller.sellerName || 'Live stream from seller'}
                            fill
                            sizes="(max-width: 768px) 50vw, 25vw"
                            className="object-cover transition-transform group-hover:scale-105"
                            data-ai-hint="store banner"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <CardHeader className="absolute bottom-0 left-0 z-10 p-4">
                            <CardTitle className="font-headline text-lg text-white">
                            {seller.sellerName || 'Live Stream'}
                            </CardTitle>
                        </CardHeader>
                        </Card>
                    </Link>
                    ))}
                </div>
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
