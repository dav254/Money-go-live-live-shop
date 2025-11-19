
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import type { Product } from '@/lib/types';
import { collection, query, where } from 'firebase/firestore';
import Image from 'next/image';
import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageIcon, VideoIcon } from 'lucide-react';

const MediaGridSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="relative aspect-square">
                <Skeleton className="h-full w-full rounded-md" />
            </div>
        ))}
    </div>
);

export default function SellerLivePage() {
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();

    const productsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
    }, [firestore, user]);

    const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

    const isLoading = isUserLoading || areProductsLoading;

    const allImages = useMemo(() => {
        if (!products) return [];
        return products.flatMap(p => p.imageUrls || (p.imageUrl ? [p.imageUrl] : [])).filter(Boolean);
    }, [products]);

    const allVideos = useMemo(() => {
        if (!products) return [];
        return products.flatMap(p => p.videoUrls || (p.videoUrl ? [p.videoUrl] : [])).filter(Boolean);
    }, [products]);

    return (
        <SellerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    My Media
                </h1>

                <Card>
                    <CardHeader>
                        <CardTitle>My Videos & Images</CardTitle>
                        <CardDescription>A gallery of all media uploaded with your products.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="images">
                            <TabsList className="mb-4">
                                <TabsTrigger value="images">Images ({allImages.length})</TabsTrigger>
                                <TabsTrigger value="videos">Videos ({allVideos.length})</TabsTrigger>
                            </TabsList>
                            <TabsContent value="images">
                                {isLoading ? (
                                    <MediaGridSkeleton />
                                ) : allImages.length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {allImages.map((url, index) => (
                                            <div key={index} className="relative aspect-square rounded-md overflow-hidden border">
                                                <Image src={url} alt={`Product Image ${index + 1}`} fill className="object-cover" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                                        <ImageIcon className="h-10 w-10 text-muted-foreground" />
                                        <p className="mt-4 text-muted-foreground">You have not uploaded any images yet.</p>
                                    </div>
                                )}
                            </TabsContent>
                             <TabsContent value="videos">
                                {isLoading ? (
                                    <MediaGridSkeleton />
                                ) : allVideos.length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {allVideos.map((url, index) => (
                                            <div key={index} className="relative aspect-video rounded-md overflow-hidden border bg-black">
                                                <video src={url} className="h-full w-full object-contain" controls />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                     <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                                        <VideoIcon className="h-10 w-10 text-muted-foreground" />
                                        <p className="mt-4 text-muted-foreground">You have not uploaded any videos yet.</p>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </SellerLayout>
    );
}

