
'use client';

import { ResellerLayout } from '@/components/layout/reseller-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Bot, Filter, Percent, Search, Share2, TrendingUp, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const ResellerProductCard = ({ product }: { product: Product }) => {
    const { user } = useUser();
    const { toast } = useToast();

    const handleShare = () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not identify reseller.' });
            return;
        }

        const shareUrl = `https://goearnvid.shop/products/${product.id}?ref=${user.uid}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            toast({
                title: 'Link Copied!',
                description: 'Your unique reseller link is ready to be shared.',
            });
        }).catch(err => {
             toast({
                variant: 'destructive',
                title: 'Failed to copy link.',
            });
        });
    };

    return (
        <Card className="overflow-hidden">
            <div className="relative aspect-video">
                <Image
                    src={product.imageUrl || 'https://picsum.photos/seed/product/300'}
                    alt={product.name || 'product'}
                    fill
                    className="object-cover"
                />
                <Badge className="absolute top-2 left-2 bg-green-600/80">{product.commissionRate || 0}% Commission</Badge>
            </div>
            <CardContent className="p-3">
                 <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={handleShare}><Share2 className="mr-2 h-4 w-4" /> Share</Button>
                    <Button size="sm" variant="secondary" className="flex-1"><Sparkles className="mr-2 h-4 w-4" /> Get Media</Button>
                </div>
            </CardContent>
        </Card>
    );
};

const ProductGridSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
    </div>
)

export default function ResellerProductsPage() {
  const firestore = useFirestore();

  const productsQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(
          collection(firestore, 'products'),
          where('commissionRate', '>', 0),
          orderBy('commissionRate', 'desc')
      );
  }, [firestore]);

  const { data: products, isLoading } = useCollection<Product>(productsQuery);

  return (
    <ResellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Products to Resell
        </h1>

        <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search products..." className="pl-9" />
            </div>
            <Button variant="outline"><Filter className="mr-2 h-4 w-4" /> Filters</Button>
        </div>

        <Tabs defaultValue="all">
          <TabsList className="grid w-full grid-cols-3 md:w-auto md:grid-cols-5">
            <TabsTrigger value="all">All Products</TabsTrigger>
            <TabsTrigger value="trending"><TrendingUp className="mr-1 h-4 w-4" /> Trending</TabsTrigger>
            <TabsTrigger value="high-commission"><Percent className="mr-1 h-4 w-4" /> High Commission</TabsTrigger>
            <TabsTrigger value="ai-recommended"><Bot className="mr-1 h-4 w-4" /> Recommended</TabsTrigger>
            <TabsTrigger value="new">New Arrivals</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-6">
            {isLoading ? (
                <ProductGridSkeleton />
            ) : products && products.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {products.map(p => <ResellerProductCard key={p.id} product={p} />)}
                </div>
            ) : (
                 <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
                    <p className="text-muted-foreground">No products available for reselling yet.</p>
                </div>
            )}
          </TabsContent>
           <TabsContent value="trending" className="mt-6">
            <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <p className="text-muted-foreground">Trending products will appear here.</p>
            </div>
          </TabsContent>
           <TabsContent value="high-commission" className="mt-6">
            <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <p className="text-muted-foreground">High-commission products will appear here.</p>
            </div>
          </TabsContent>
          <TabsContent value="ai-recommended" className="mt-6">
             <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <p className="text-muted-foreground">AI recommendations will appear here based on your performance.</p>
            </div>
          </TabsContent>
           <TabsContent value="new" className="mt-6">
             <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <p className="text-muted-foreground">New arrivals will appear here.</p>
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </ResellerLayout>
  );
}
