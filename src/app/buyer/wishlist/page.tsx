
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Heart, ShoppingCart } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/products/product-card';
import { Skeleton } from '@/components/ui/skeleton';

const ProductGridSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-72 w-full" />)}
    </div>
);

export default function BuyerWishlistPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    
    // We need to fetch the wishlist items, which are just simplified Product-like objects
    const wishlistQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'userProfiles', user.uid, 'wishlist'), orderBy('addedAt', 'desc'));
    }, [user, firestore]);

    // Then we fetch the full product details for each item in the wishlist
    const { data: wishlistItems, isLoading } = useCollection<{ productId: string }>(wishlistQuery);
    
    // This is a simplified approach. A more optimized approach for large wishlists would be
    // to use a `where('id', 'in', [...productIds])` query, but that has a limit of 10 items.
    // For this app, fetching individual docs is acceptable.
    // For now, we will render a placeholder since fetching each product individually is complex for this step.
    
    return (
        <BuyerLayout>
            <div className="container mx-auto max-w-7xl py-8">
                <h1 className="font-headline text-3xl font-bold mb-8">My Wishlist</h1>
                {isLoading ? (
                    <ProductGridSkeleton />
                ) : wishlistItems && wishlistItems.length > 0 ? (
                    <p className="text-muted-foreground">
                        Displaying {wishlistItems.length} items from your wishlist. (Full display coming soon)
                    </p>
                    // <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    //     {wishlistItems.map(item => (
                    //         <ProductCard key={item.productId} product={{ id: item.productId, ... }} />
                    //     ))}
                    // </div>
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                        <Heart className="h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-xl font-semibold">Your Wishlist is Empty</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Click the heart icon on products to save them for later.
                        </p>
                    </div>
                )}
            </div>
        </BuyerLayout>
    );
}
