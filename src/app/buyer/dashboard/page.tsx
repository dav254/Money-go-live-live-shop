
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { ProductCard } from '@/components/seller/product-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Heart, Package, Video, Wallet } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, limit, orderBy } from 'firebase/firestore';
import type { Product, SellerShop, UserProfile, HomepageSlide } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const shortcuts = [
  {
    title: 'My Orders',
    icon: Package,
    href: '/buyer/my-orders',
    color: 'bg-blue-500/20 text-blue-500',
  },
  {
    title: 'Wallet',
    icon: Wallet,
    href: '/buyer/wallet',
    color: 'bg-green-500/20 text-green-500',
  },
  {
    title: 'Live Shows',
    icon: Video,
    href: '/live',
    color: 'bg-purple-500/20 text-purple-500',
  },
];

const HomepageCarousel = () => {
    const firestore = useFirestore();
    const slidesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'homepageSlides'), orderBy('order'));
    }, [firestore]);
    const { data: slides, isLoading } = useCollection<HomepageSlide>(slidesQuery);

    if (isLoading) {
        return <Skeleton className="w-full aspect-[16/7] rounded-lg" />;
    }

    if (!slides || slides.length === 0) {
        return null; // Don't render the carousel if there are no slides
    }

    return (
        <Carousel
            opts={{ loop: true }}
            className="w-full"
        >
            <CarouselContent>
                {slides.map(slide => (
                    <CarouselItem key={slide.id}>
                        <div className="relative aspect-[16/7] w-full overflow-hidden rounded-lg">
                            <Image
                                src={slide.imageUrl}
                                alt={slide.title}
                                fill
                                sizes="100vw"
                                className="object-cover"
                                priority
                                data-ai-hint={slide.imageHint}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <div className="absolute bottom-0 left-0 p-8 text-white">
                                <h2 className="font-headline text-4xl font-bold">{slide.title}</h2>
                                <p className="mt-2 max-w-md">{slide.description}</p>
                                <Button asChild className="mt-4">
                                    <Link href={slide.href}>Shop Now</Link>
                                </Button>
                            </div>
                        </div>
                    </CarouselItem>
                ))}
            </CarouselContent>
            <CarouselPrevious className="left-4" />
            <CarouselNext className="right-4" />
        </Carousel>
    );
};

const ProductCarouselSkeleton = () => (
    <Carousel className="w-full">
        <CarouselContent>
            {Array.from({ length: 5 }).map((_, i) => (
                <CarouselItem key={i} className="md:basis-1/2 lg:basis-1/4 xl:basis-1/5">
                    <div className="p-1">
                        <Skeleton className="h-64 w-full" />
                    </div>
                </CarouselItem>
            ))}
        </CarouselContent>
    </Carousel>
);

const SellerCarouselSkeleton = () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full" />
        ))}
    </div>
);


export default function BuyerDashboardPage() {
  const firestore = useFirestore();

  const productsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'products'), limit(10));
  }, [firestore]);

  const sellerShopsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sellerShops'), limit(4));
  }, [firestore]);

  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);
  const { data: sellers, isLoading: isLoadingSellers } = useCollection<SellerShop>(sellerShopsQuery);

  const dealsProducts = products?.slice(0, 5) || [];
  const recommendedProducts = products?.slice(5, 10) || [];

  return (
    <BuyerLayout>
      <div className="flex-1 space-y-8 p-4 pt-6 md:p-8">
        <HomepageCarousel />

        {/* Quick Shortcuts */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((shortcut) => (
            <Card
              key={shortcut.title}
              className="group transition-all hover:shadow-lg hover:-translate-y-1"
            >
              <Link href={shortcut.href}>
                <CardContent className="flex items-center justify-start gap-4 p-6">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-lg ${shortcut.color} transition-colors group-hover:bg-primary group-hover:text-primary-foreground`}
                  >
                    <shortcut.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-headline text-lg font-semibold">
                    {shortcut.title}
                  </h3>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>

        {/* Today's Deals Carousel */}
        <div className="space-y-4">
          <h2 className="font-headline text-2xl font-bold">Today's Deals</h2>
           {isLoadingProducts ? <ProductCarouselSkeleton /> : (
            <Carousel
                opts={{
                align: 'start',
                loop: dealsProducts.length > 4,
                }}
                className="w-full"
            >
                <CarouselContent>
                {dealsProducts.map((product) => (
                    <CarouselItem
                    key={product.id}
                    className="md:basis-1/2 lg:basis-1/4 xl:basis-1/5"
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

        {/* Trending Live Shows */}
        <div className="space-y-4">
          <h2 className="font-headline text-2xl font-bold">
            Trending Live Shows
          </h2>
          {isLoadingSellers ? <SellerCarouselSkeleton /> : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {sellers?.map((seller) => (
                <Link href={`/sellers/${seller.sellerId}`} key={seller.id}>
                    <Card className="group relative h-52 overflow-hidden">
                    <Image
                        src={seller.bannerUrl || `https://picsum.photos/seed/${seller.id}/600/400`}
                        alt={seller.shopName}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover transition-transform group-hover:scale-105"
                        data-ai-hint="store banner"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <CardHeader className="absolute bottom-0 left-0 z-10 p-4">
                        <CardTitle className="font-headline text-lg text-white">
                        {seller.shopName}
                        </CardTitle>
                    </CardHeader>
                    </Card>
                </Link>
                ))}
            </div>
          )}
        </div>

        {/* Recommended For You */}
        <div className="space-y-4">
          <h2 className="font-headline text-2xl font-bold">
            Recommended For You
          </h2>
           {isLoadingProducts ? <ProductCarouselSkeleton /> : (
            <Carousel
                opts={{
                align: 'start',
                loop: recommendedProducts.length > 4,
                }}
                className="w-full"
            >
                <CarouselContent>
                {recommendedProducts.map((product) => (
                    <CarouselItem
                    key={product.id}
                    className="md:basis-1/2 lg:basis-1/3 xl:basis-1/5"
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
      </div>
    </BuyerLayout>
  );
}
