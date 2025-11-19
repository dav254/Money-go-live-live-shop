
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
import { BarChart2, Heart, PlusCircle, Tag, TrendingUp, Sparkles, Pencil, Trash2, Bookmark } from 'lucide-react';
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

  // This query will be updated later to fetch actual wishlist items
  const productsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'products'),
      where('sellerId', '==', user.uid),
      limit(0) // Start with an empty list, will be populated by wishlist logic later
    );
  }, [firestore, user]);

  const { data: favoriteProducts, isLoading } = useCollection<Product>(productsQuery);

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            My Wishlist
          </h1>
          <Button><PlusCircle className="mr-2 h-4 w-4" /> Add External Product</Button>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">⭐ All Items</TabsTrigger>
            <TabsTrigger value="restock">📦 Restock Soon</TabsTrigger>
            <TabsTrigger value="ideas">💡 Product Ideas</TabsTrigger>
            <TabsTrigger value="trending">🔥 Trending</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-6">
             <Card>
                <CardHeader>
                    <CardTitle>My Wishlisted Products</CardTitle>
                    <p className="text-muted-foreground">Bookmark your own products to restock, or save other items for inspiration.</p>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                            <Bookmark className="h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-xl font-semibold">Your Wishlist is Empty</h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Add products from your store or the marketplace to get started.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}
