
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart2, Heart, PlusCircle, Tag, TrendingUp, Sparkles, Pencil, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

const ProductSkeleton = () => (
    <Card className="group overflow-hidden">
        <div className="relative aspect-video bg-muted">
            <Skeleton className="h-full w-full" />
        </div>
        <CardContent className="p-4">
            <Skeleton className="h-4 w-3/4" />
            <div className="mt-2 flex items-center justify-between">
                <Skeleton className="h-6 w-1/4" />
                <Skeleton className="h-6 w-1/4" />
            </div>
            <div className="mt-4 flex gap-2">
                <Skeleton className="h-9 w-1/2" />
                <Skeleton className="h-9 w-1/2" />
            </div>
        </CardContent>
    </Card>
);


export default function SellerWishlistPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const mostLikedProductsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'products'),
      where('sellerId', '==', user.uid),
      orderBy('likes', 'desc'),
      limit(10)
    );
  }, [firestore, user]);

  const { data: favoriteProducts, isLoading } = useCollection<Product>(mostLikedProductsQuery);

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Product Popularity
          </h1>
        </div>

        <Tabs defaultValue="favorites">
          <TabsList>
            <TabsTrigger value="favorites">Most Wishlisted</TabsTrigger>
            <TabsTrigger value="campaigns">Saved Campaigns</TabsTrigger>
            <TabsTrigger value="trends">Market Trends</TabsTrigger>
          </TabsList>
          <TabsContent value="favorites" className="mt-6">
             <Card>
                <CardHeader>
                    <CardTitle>Your Most Popular Products</CardTitle>
                    <p className="text-muted-foreground">Products most frequently wishlisted by buyers.</p>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)}
                        </div>
                    ) : favoriteProducts && favoriteProducts.length > 0 ? (
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {favoriteProducts.map((product) => (
                                <Card key={product.id} className="group overflow-hidden">
                                <div className="relative aspect-video">
                                    <Image
                                    src={product.imageUrl || product.image?.imageUrl || '/placeholder.svg'}
                                    alt={product.name || 'Product'}
                                    fill
                                    className="object-cover"
                                    data-ai-hint={product.image?.imageHint}
                                    />
                                    <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-xs text-white">
                                        <Heart className="h-3 w-3" fill="white" />
                                        <span>{product.likes || 0}</span>
                                    </div>
                                </div>
                                <CardContent className="p-4">
                                    <h3 className="font-headline font-semibold truncate">
                                    {product.name}
                                    </h3>
                                    <div className="mt-2 flex items-center justify-between">
                                    <p className="text-lg font-bold text-primary">
                                        ${product.price.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {product.stock} in stock
                                    </p>
                                    </div>
                                    <div className="mt-4 flex gap-2">
                                        <Button size="sm" className="flex-1">
                                            <Sparkles className="mr-2 h-4 w-4" /> Promote
                                        </Button>
                                        <Button asChild size="sm" variant="secondary" className="flex-1">
                                            <Link href="/dashboard/live/start">Add to Live</Link>
                                        </Button>
                                    </div>
                                </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                            <Heart className="h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-xl font-semibold">No Wishlisted Products</h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                                When buyers add your products to their wishlist, they will appear here.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="campaigns" className="mt-6">
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <Tag className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold">No Saved Campaigns</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Plan and save your promotions here for later.
              </p>
              <Button className="mt-4">
                <PlusCircle className="mr-2 h-4 w-4" /> Create Campaign
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="trends" className="mt-6">
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold">Marketplace Trends</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                See what's popular and trending in the marketplace to get inspired.
              </p>
               <Button variant="secondary" className="mt-4">
                View Market Report
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}
