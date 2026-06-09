'use client';

import React, { useMemo } from 'react';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { ProductCard } from '@/components/products/product-card';
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile } from '@/firebase';
import { collection, query, where, documentId } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Heart, ShoppingBag, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function BuyerWishlistPage() {
    const { user } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
    const firestore = useFirestore();

    // 1. Get IDs from user profile
    const wishlistIds = userProfile?.wishlist || [];

    // 2. Fetch the product details for those IDs
    const wishlistProductsQuery = useMemoFirebase(() => {
        if (!firestore || wishlistIds.length === 0) return null;
        // Firestore 'in' query supports up to 30 items
        return query(
            collection(firestore, 'products'),
            where(documentId(), 'in', wishlistIds.slice(0, 30))
        );
    }, [firestore, wishlistIds]);

    const { data: products, isLoading: areProductsLoading } = useCollection<Product>(wishlistProductsQuery);

    const isLoading = isProfileLoading || areProductsLoading;

    return (
        <BuyerLayout>
            <div className="flex flex-col space-y-8 animate-in fade-in duration-500">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20">
                        <Heart className="h-6 w-6 text-pink-500 fill-pink-500" />
                    </div>
                    <div>
                        <h1 className="font-headline text-3xl font-black uppercase tracking-tighter text-white">
                            My Saved Items
                        </h1>
                        <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] mt-1">This collection is private to you.</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} className="h-72 w-full rounded-2xl bg-white/5" />
                        ))}
                    </div>
                ) : products && products.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {products.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 text-center bg-neutral-900/30 border-2 border-dashed border-white/5 rounded-[3rem] shadow-inner">
                        <div className="p-8 rounded-full bg-white/5 mb-6 border border-white/5">
                            <Heart className="h-12 w-12 text-neutral-800" />
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Your List is Private & Quiet</h2>
                        <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs mt-3 max-w-xs leading-relaxed">
                            Start liking products in the feed to save them here. Only you can see this.
                        </p>
                        <Button className="mt-10 h-14 px-12 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20" asChild>
                            <Link href="/buyer/live">START DISCOVERING <ArrowRight className="ml-2 h-4 w-4" /></Link>
                        </Button>
                    </div>
                )}
            </div>
        </BuyerLayout>
    );
}