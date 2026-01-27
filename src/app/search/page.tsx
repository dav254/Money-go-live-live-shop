'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search as SearchIcon } from 'lucide-react';
import { sellers, products } from '@/lib/placeholder-data';
import { ProductGrid } from '@/components/products/product-grid';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

function SearchResults() {
    const searchParams = useSearchParams();
    const query = searchParams.get('q');

    // In a real application, you would use this query to fetch data from your backend.
    // For this frontend-only implementation, we'll filter the mock data.

    const filteredProducts = products.filter(p => {
        const q = query?.toLowerCase() || '';
        const nameMatch = p.name.toLowerCase().includes(q);
        const descMatch = (p.description || '').toLowerCase().includes(q);
        return nameMatch || descMatch;
    });

    const filteredSellers = sellers.filter(s => {
        const q = query?.toLowerCase() || '';
        const nameMatch = s.name.toLowerCase().includes(q);
        const bioMatch = (s.bio || '').toLowerCase().includes(q);
        return nameMatch || bioMatch;
    });


    return (
        <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
            <div className="flex items-center gap-2">
                <SearchIcon className="h-6 w-6 text-muted-foreground" />
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    Search Results for "{query}"
                </h1>
            </div>

            <Tabs defaultValue="products" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="products">Products ({filteredProducts.length})</TabsTrigger>
                    <TabsTrigger value="sellers">Sellers ({filteredSellers.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="products">
                    <ProductGrid products={filteredProducts} />
                </TabsContent>
                <TabsContent value="sellers">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredSellers.map(seller => (
                             <Card key={seller.id} className="hover:bg-muted/50 transition-colors">
                                <CardContent className="p-4">
                                     <div className="flex items-center gap-4">
                                        <Avatar className="h-12 w-12 border">
                                            <AvatarImage src={seller.avatar.imageUrl} />
                                            <AvatarFallback>{seller.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <p className="font-bold">{seller.name}</p>
                                            <p className="text-xs text-muted-foreground">{seller.followers.toLocaleString()} followers</p>
                                        </div>
                                         <Button asChild variant="outline" size="sm">
                                            <Link href={`/sellers/${seller.id}`}>Visit</Link>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                     {filteredSellers.length === 0 && <p className="text-muted-foreground text-center py-12">No sellers found for "{query}".</p>}
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function SearchPage() {
  return (
    <BuyerLayout>
      <Suspense fallback={<div>Loading search results...</div>}>
        <SearchResults />
      </Suspense>
    </BuyerLayout>
  );
}
