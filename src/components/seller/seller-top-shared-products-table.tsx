
'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { Product, ResellActivity } from '@/lib/types';
import Image from 'next/image';

const TableSkeleton = () => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Total Shares</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {[...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-10 w-10 rounded-md" />
                                <Skeleton className="h-6 w-48" />
                            </div>
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-6 w-12 ml-auto" />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

export function SellerTopSharedProductsTable() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [topShared, setTopShared] = React.useState<{ product: Product; shares: number }[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        if (!user || !firestore) {
            setIsLoading(false);
            return;
        }

        const sellerId = user.uid;
        let productsUnsubscribe: (() => void) | undefined;
        let activitiesUnsubscribe: (() => void) | undefined;

        setIsLoading(true);

        const productsQuery = query(collection(firestore, 'products'), where('sellerId', '==', sellerId));
        productsUnsubscribe = onSnapshot(productsQuery, (productsSnapshot) => {
            const sellerProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
            const sellerProductsMap = new Map(sellerProducts.map(p => [p.id, p]));
            const sellerProductIds = Array.from(sellerProductsMap.keys());

            if (sellerProductIds.length === 0) {
                setTopShared([]);
                setIsLoading(false);
                return;
            }

            const activitiesQuery = query(collection(firestore, 'resellActivities'), where('sellerId', '==', sellerId));
            
            activitiesUnsubscribe = onSnapshot(activitiesQuery, (activitiesSnapshot) => {
                const shareCounts = activitiesSnapshot.docs.reduce((acc, doc) => {
                    const activity = doc.data() as ResellActivity;
                    acc[activity.productId] = (acc[activity.productId] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

                const combinedData = Object.entries(shareCounts)
                    .map(([productId, shares]) => {
                        const product = sellerProductsMap.get(productId);
                        return product ? { product, shares } : null;
                    })
                    .filter(item => item !== null)
                    .sort((a, b) => b!.shares - a!.shares)
                    .slice(0, 10) as { product: Product; shares: number }[];
                
                setTopShared(combinedData);
                setIsLoading(false);
            }, (error) => {
                console.error("FirebaseError in resellActivities subscription:", error);
                const permissionError = new FirestorePermissionError({
                    path: 'resellActivities',
                    operation: 'list',
                });
                errorEmitter.emit('permission-error', permissionError);
                setIsLoading(false);
            });
        }, (error) => {
            console.error("FirebaseError in products subscription:", error);
             const permissionError = new FirestorePermissionError({
                path: 'products',
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
            setIsLoading(false);
        });

        return () => {
            if (productsUnsubscribe) productsUnsubscribe();
            if (activitiesUnsubscribe) activitiesUnsubscribe();
        };

    }, [user, firestore]);

    if (isLoading) {
        return <TableSkeleton />;
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Total Shares by Resellers</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {topShared.length > 0 ? (
                    topShared.map(item => (
                        <TableRow key={item.product.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Image src={item.product.imageUrl || 'https://picsum.photos/seed/placeholder/40'} alt={item.product.name || 'Product'} width={40} height={40} className="rounded-md object-cover" />
                                    <span className="font-medium">{item.product.name}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">{item.shares}</TableCell>
                        </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                            No products have been shared by resellers yet.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    )
}
