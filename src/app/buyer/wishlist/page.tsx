
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Heart } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, getDocs, doc } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/products/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';

const ProductGridSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-72 w-full" />)}
    </div>
);

export default function BuyerWishlistPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        const fetchWishlistProducts = async () => {
            if (!user || !firestore) {
                setIsLoading(false);
                return;
            };

            setIsLoading(true);
            try {
                const wishlistRef = collection(firestore, 'userProfiles', user.uid, 'wishlist');
                const wishlistSnapshot = await getDocs(wishlistRef);
                const productIds = wishlistSnapshot.docs.map(doc => doc.id);

                if (productIds.length === 0) {
                    setWishlistProducts([]);
                    setIsLoading(false);
                    return;
                }
                
                // Firestore 'in' query is limited to 30 items.
                // For a larger wishlist, pagination would be needed.
                const productsQuery = query(collection(firestore, 'products'), where('__name__', 'in', productIds));
                const productsSnapshot = await getDocs(productsQuery);
                const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
                
                setWishlistProducts(products);

            } catch (error) {
                console.error("Error fetching wishlist products:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchWishlistProducts();
    }, [user, firestore]);
    
    
    return (
        <BuyerLayout>
            <div className="container mx-auto max-w-7xl py-8">
                <h1 className="font-headline text-3xl font-bold mb-8">My Wishlist</h1>
                {isLoading ? (
                    <ProductGridSkeleton />
                ) : wishlistProducts && wishlistProducts.length > 0 ? (
                     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {wishlistProducts.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
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
