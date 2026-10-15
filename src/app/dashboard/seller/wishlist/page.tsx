
'use client';

import * as React from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, collectionGroup, onSnapshot, doc } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Image from 'next/image';
import { Heart, Eye, ShoppingCart } from 'lucide-react';
import Link from 'next/link';

const ProductDetails = ({ productId }: { productId: string }) => {
    const firestore = useFirestore();
    const productRef = React.useMemo(() => doc(firestore, 'products', productId), [firestore, productId]);
    const { data: product, isLoading } = useDoc<Product>(productRef);

    if (isLoading) {
        return (
             <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-md" />
                <Skeleton className="h-6 w-32" />
            </div>
        );
    }
    
    if (!product) return <p>Product not found</p>;

    return (
        <Link href={`/products/${product.id}`} className="flex items-center gap-3 group">
            <Image src={product.imageUrl || '/placeholder-image.svg'} alt={product.name || 'product'} width={40} height={40} className="rounded-md object-cover" />
            <span className="font-medium group-hover:text-primary">{product.name}</span>
        </Link>
    );
};

export default function SellerWishlistPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [wishlistData, setWishlistData] = React.useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = React.useState(true);

    const productsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
    }, [firestore, user]);

    const { data: sellerProducts } = useCollection<Product>(productsQuery);

    React.useEffect(() => {
        if (!firestore || !sellerProducts || sellerProducts.length === 0) {
            setIsLoading(false);
            return;
        }

        const productIds = sellerProducts.map(p => p.id);
        const wishlistQuery = query(collectionGroup(firestore, 'wishlist'), where('__name__', 'in', productIds));

        const unsubscribe = onSnapshot(wishlistQuery, (snapshot) => {
            const counts: Record<string, number> = {};
            snapshot.docs.forEach(doc => {
                const productId = doc.ref.parent.parent?.id; // The product ID is the parent of the wishlist subcollection item
                if (productId) {
                    counts[productId] = (counts[productId] || 0) + 1;
                }
            });
            setWishlistData(counts);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching wishlist data:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [firestore, sellerProducts]);
    
    const sortedProducts = React.useMemo(() => {
        if (!sellerProducts) return [];
        return sellerProducts.sort((a, b) => (wishlistData[b.id] || 0) - (wishlistData[a.id] || 0));
    }, [sellerProducts, wishlistData]);

    return (
        <SellerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Product Wishlist</h1>
                 <p className="text-muted-foreground">
                    See which of your products are most popular with buyers.
                </p>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-right">Wishlist Adds</TableHead>
                                <TableHead className="text-right">Views</TableHead>
                                <TableHead className="text-right">Purchases</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-16 ml-auto" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-16 ml-auto" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-16 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : sortedProducts.length > 0 ? (
                                sortedProducts.map(product => (
                                    <TableRow key={product.id}>
                                        <TableCell>
                                            <ProductDetails productId={product.id} />
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                            <div className="flex items-center justify-end gap-2">
                                                <Heart className="h-4 w-4 text-red-500"/>
                                                {wishlistData[product.id] || 0}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Eye className="h-4 w-4 text-blue-500"/>
                                                {product.viewCount || 0}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                             <div className="flex items-center justify-end gap-2">
                                                <ShoppingCart className="h-4 w-4 text-green-500"/>
                                                {product.salesCount || 0}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        No products have been added to a wishlist yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </SellerLayout>
    );
}
