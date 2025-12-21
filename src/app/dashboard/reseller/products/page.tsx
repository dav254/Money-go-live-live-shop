
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
import { Bot, Filter, Percent, Search, Share2, TrendingUp, Sparkles, Loader2, MousePointerClick } from 'lucide-react';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import React, { useState, useMemo } from 'react';
import { logResellerShare } from '@/app/actions/reseller-actions';
import Link from 'next/link';


const ResellerProductCard = ({ product, clicks, onShareClick }: { product: Product; clicks: number; onShareClick: () => void; }) => {
    const { user } = useUser();
    const { toast } = useToast();
    const [isSharing, setIsSharing] = useState(false);

    const handleShare = async (e: React.MouseEvent) => {
        e.preventDefault(); // Stop the link navigation when only the button is clicked
        e.stopPropagation();

        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not identify reseller.' });
            return;
        }

        setIsSharing(true);

        // Frontend-only click tracking
        onShareClick();

        const baseUrl = 'https://goearnvid.shop';
        const shareUrl = `${baseUrl}/products/${product.id}?ref=${user.uid}`;
        
        try {
            await navigator.clipboard.writeText(shareUrl);
            toast({
                title: 'Link Copied!',
                description: 'Your unique reseller link is ready to be shared.',
            });

            // Log the share event in the background (fire-and-forget)
            logResellerShare(user.uid, product.id, product.sellerId);

        } catch (err) {
             toast({
                variant: "destructive",
                title: "Failed to copy link.",
            });
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <Link href={`/products/${product.id}`} className="block group">
            <Card className="overflow-hidden h-full flex flex-col">
                <div className="relative aspect-video">
                    <Image
                        src={product.imageUrl || 'https://picsum.photos/seed/product/300'}
                        alt={product.name || 'product'}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {product.commissionRate && (
                        <Badge className="absolute top-2 left-2 bg-green-600/80">{product.commissionRate || 0}% Commission</Badge>
                    )}
                </div>
                <CardContent className="p-3 space-y-2 flex flex-col flex-1">
                    <div className="flex-1">
                        <p className="text-sm font-semibold truncate group-hover:text-primary">{product.name || 'Unnamed Product'}</p>
                         <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                           <span className="flex items-center gap-1"><Share2 className="h-3 w-3" /> {product.shares || 0} Shares</span>
                           <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {clicks || 0} Clicks</span>
                        </div>
                        <p className="text-primary font-bold mt-1">${product.price.toLocaleString()}</p>
                    </div>
                    <Button size="sm" className="w-full mt-2" onClick={handleShare} disabled={isSharing}>
                        {isSharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
                        Share & Track
                    </Button>
                </CardContent>
            </Card>
        </Link>
    );
};

const ProductGridSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-72 w-full" />)}
    </div>
)

export default function ResellerProductsPage() {
  const firestore = useFirestore();
  const [searchQuery, setSearchQuery] = useState('');
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({});

  const productsQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(
          collection(firestore, 'products'),
          where('commissionRate', '>', 0),
          orderBy('commissionRate', 'desc')
      );
  }, [firestore]);

  const { data: products, isLoading } = useCollection<Product>(productsQuery);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchQuery) return products;

    return products.filter(product =>
      product.name && product.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);
  
  const handleShareClick = (productId: string) => {
    setClickCounts(prev => ({
        ...prev,
        [productId]: (prev[productId] || 0) + 1
    }));
  };

  return (
    <ResellerLayout>
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h1 className="font-headline text-3xl font-bold tracking-tight">
            Products to Resell
            </h1>

            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search products..." 
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                </div>
                <Button variant="outline"><Filter className="mr-2 h-4 w-4" /> Filters</Button>
            </div>

            <Tabs defaultValue="all">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="all">All Products</TabsTrigger>
                <TabsTrigger value="high-commission"><Percent className="mr-1 h-4 w-4" /> High Commission</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="mt-6">
                {isLoading ? (
                    <ProductGridSkeleton />
                ) : filteredProducts && filteredProducts.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {filteredProducts.map(p => (
                            <ResellerProductCard 
                                key={p.id} 
                                product={p} 
                                clicks={clickCounts[p.id] || 0}
                                onShareClick={() => handleShareClick(p.id)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
                        <p className="text-muted-foreground">No products found for "{searchQuery}".</p>
                    </div>
                )}
            </TabsContent>
            <TabsContent value="high-commission" className="mt-6">
                {isLoading ? (
                    <ProductGridSkeleton />
                ) : filteredProducts && filteredProducts.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                         {filteredProducts.map(p => (
                            <ResellerProductCard 
                                key={p.id} 
                                product={p} 
                                clicks={clickCounts[p.id] || 0}
                                onShareClick={() => handleShareClick(p.id)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
                        <p className="text-muted-foreground">No high-commission products found.</p>
                    </div>
                )}
            </TabsContent>

            </Tabs>
        </div>
    </ResellerLayout>
  );
}

