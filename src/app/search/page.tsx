
'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search as SearchIcon, Store, ShoppingBag } from 'lucide-react';
import { ProductGrid } from '@/components/products/product-grid';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Product, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

function SearchResults() {
    const searchParams = useSearchParams();
    const queryTerm = searchParams.get('q')?.toLowerCase() || '';
    const firestore = useFirestore();

    // Fetch all products to filter locally (Firestore doesn't do substring search well)
    const productsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'products');
    }, [firestore]);

    // Fetch all sellers to filter locally
    const sellersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'userProfiles'), where('userRole', '==', 'seller'));
    }, [firestore]);

    const { data: allProducts, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);
    const { data: allSellers, isLoading: areSellersLoading } = useCollection<UserProfile>(sellersQuery);

    const filteredProducts = useMemo(() => {
        if (!allProducts) return [];
        if (!queryTerm) return allProducts;
        return allProducts.filter(p => 
            p.name?.toLowerCase().includes(queryTerm) || 
            p.description?.toLowerCase().includes(queryTerm) ||
            p.category?.toLowerCase().includes(queryTerm)
        );
    }, [allProducts, queryTerm]);

    const filteredSellers = useMemo(() => {
        if (!allSellers) return [];
        if (!queryTerm) return allSellers;
        return allSellers.filter(s => 
            s.fullName?.toLowerCase().includes(queryTerm) || 
            s.shopName?.toLowerCase().includes(queryTerm) ||
            s.username?.toLowerCase().includes(queryTerm)
        );
    }, [allSellers, queryTerm]);

    const isLoading = areProductsLoading || areSellersLoading;

    if (isLoading) {
        return (
            <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-64" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
            <div className="flex items-center gap-2">
                <SearchIcon className="h-6 w-6 text-primary" />
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    {queryTerm ? `Results for "${queryTerm}"` : "Explore Everything"}
                </h1>
            </div>

            <Tabs defaultValue="products" className="space-y-4">
                <TabsList className="bg-neutral-900 border-neutral-800">
                    <TabsTrigger value="products" className="data-[state=active]:bg-primary">
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        Products ({filteredProducts.length})
                    </TabsTrigger>
                    <TabsTrigger value="sellers" className="data-[state=active]:bg-primary">
                        <Store className="mr-2 h-4 w-4" />
                        Sellers ({filteredSellers.length})
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="products" className="space-y-4 pt-4">
                    {filteredProducts.length > 0 ? (
                        <ProductGrid products={filteredProducts} />
                    ) : (
                        <div className="text-center py-20 border-2 border-dashed rounded-xl bg-neutral-900/20 border-neutral-800">
                            <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-xl font-bold text-white">No products found</h3>
                            <p className="text-muted-foreground">Try a different keyword or category.</p>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="sellers" className="pt-4">
                    {filteredSellers.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredSellers.map(seller => (
                                <Card key={seller.id} className="hover:bg-neutral-900 transition-colors border-neutral-800 bg-neutral-950">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-14 w-14 border-2 border-primary">
                                                <AvatarImage src={seller.profilePictureUrl} />
                                                <AvatarFallback>{seller.fullName?.charAt(0) || seller.username?.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 overflow-hidden">
                                                <p className="font-bold truncate text-lg text-white">{seller.shopName || seller.fullName}</p>
                                                <p className="text-xs text-muted-foreground truncate">@{seller.username}</p>
                                            </div>
                                            <Button asChild variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-white transition-colors">
                                                <Link href={`/sellers/${seller.id}`}>Visit</Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 border-2 border-dashed rounded-xl bg-neutral-900/20 border-neutral-800">
                            <Store className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-xl font-bold text-white">No sellers found</h3>
                            <p className="text-muted-foreground">We couldn't find any shops matching your search.</p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function SearchPage() {
  return (
    <BuyerLayout>
      <Suspense fallback={<div className="p-8 text-white">Loading Search...</div>}>
        <SearchResults />
      </Suspense>
    </BuyerLayout>
  );
}
