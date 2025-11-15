
import { MainLayout } from '@/components/layout/main-layout';
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
import { products, sellers } from '@/lib/placeholder-data';
import { Heart, Package, Video, Wallet } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

const shortcuts = [
  {
    title: 'My Orders',
    icon: Package,
    href: '#',
    color: 'bg-blue-500/20 text-blue-500',
  },
  {
    title: 'Wishlist',
    icon: Heart,
    href: '#',
    color: 'bg-red-500/20 text-red-500',
  },
  {
    title: 'Wallet',
    icon: Wallet,
    href: '#',
    color: 'bg-green-500/20 text-green-500',
  },
  {
    title: 'Live Shows',
    icon: Video,
    href: '#',
    color: 'bg-purple-500/20 text-purple-500',
  },
];

export default function BuyerDashboardPage() {
  return (
    <MainLayout>
      <div className="flex-1 space-y-8 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-between space-y-2">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Welcome, Buyer!
          </h1>
          <div className="flex items-center space-x-2">
            <Button>Explore</Button>
          </div>
        </div>

        {/* Quick Shortcuts */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          <Carousel
            opts={{
              align: 'start',
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContent>
              {products.slice(0, 5).map((product) => (
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
        </div>

        {/* Trending Live Shows */}
        <div className="space-y-4">
          <h2 className="font-headline text-2xl font-bold">
            Trending Live Shows
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sellers.map((seller) => (
              <Link href="#" key={seller.id}>
                <Card className="group relative h-64 overflow-hidden">
                  <Image
                    src={seller.banner.imageUrl}
                    alt={seller.name}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    data-ai-hint={seller.banner.imageHint}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <CardHeader className="absolute bottom-0 left-0 z-10 p-4">
                    <CardTitle className="font-headline text-lg text-white">
                      {seller.name}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Recommended For You */}
        <div className="space-y-4">
          <h2 className="font-headline text-2xl font-bold">
            Recommended For You
          </h2>
          <Carousel
            opts={{
              align: 'start',
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContent>
              {products.slice(1, 6).map((product) => (
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
        </div>
      </div>
    </MainLayout>
  );
}
