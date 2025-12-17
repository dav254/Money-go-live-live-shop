'use client';

import * as React from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ImageIcon } from 'lucide-react';

const ProductCardSkeleton = () => (
    <Card>
        <CardContent className="p-4 flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-md" />
            <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-9 w-24" />
        </CardContent>
    </Card>
);

export default function SelectProductForVideoPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const productsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
    }, [firestore, user]);

    const { data: products, isLoading } = useCollection<Product>(productsQuery);

    return (
        <SellerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl flex items-center gap-2">
                           <ImageIcon className="text-primary" /> Image-to-Video Generator
                        </CardTitle>
                        <CardDescription>
                           Select one of your products to generate a short promotional video from its images.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isLoading && (
                            <>
                                <ProductCardSkeleton />
                                <ProductCardSkeleton />
                            </>
                        )}
                        {products && products.length > 0 ? products.map(product => (
                            <Card key={product.id}>
                                <CardContent className="p-4 flex items-center gap-4">
                                     <div className="relative h-16 w-16 rounded-md overflow-hidden bg-muted">
                                        {product.imageUrl && <Image src={product.imageUrl} alt={product.name || 'product'} fill className="object-cover" />}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold">{product.name}</p>
                                        <p className="text-sm text-muted-foreground">{product.imageUrls?.length || 0} images available</p>
                                    </div>
                                    <Button asChild disabled={!product.imageUrls || product.imageUrls.length === 0}>
                                        <Link href={`/dashboard/seller/ai-tools/image-to-video/${product.id}`}>
                                            Select
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        )) : !isLoading && (
                             <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                                <p className="text-muted-foreground">You have no products with images to generate videos from.</p>
                                <Button asChild variant="link">
                                    <Link href="/dashboard/products?tab=add-new">Add a Product</Link>
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </SellerLayout>
    );
}
