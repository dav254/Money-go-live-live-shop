
'use client';

import React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import Image from 'next/image';
import { Button } from '../ui/button';
import { Pin, PinOff } from 'lucide-react';

interface LiveProductShelfProps {
    sellerId: string;
    onPinProduct: (product: Product) => void;
    onUnpinProduct: () => void;
}

const ProductRow = ({ product, onPin, onUnpin }: { product: Product; onPin: (p: Product) => void; onUnpin: () => void }) => {
    return (
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
                <Image src={product.imageUrl || 'https://picsum.photos/seed/placeholder/150'} alt={product.name || 'product'} fill className="object-cover" />
            </div>
            <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-semibold">{product.name}</p>
                <p className="text-xs font-bold text-primary">${product.price.toLocaleString()}</p>
            </div>
            <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onPin(product)}>
                    <Pin className="h-4 w-4" />
                </Button>
                 <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onUnpin}>
                    <PinOff className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

export function LiveProductShelf({ sellerId, onPinProduct, onUnpinProduct }: LiveProductShelfProps) {
    const firestore = useFirestore();

    const productsQuery = useMemoFirebase(() => {
        if (!sellerId) return null;
        return query(collection(firestore, 'products'), where('sellerId', '==', sellerId));
    }, [firestore, sellerId]);

    const { data: products, isLoading } = useCollection<Product>(productsQuery);

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3"><Skeleton className="h-12 w-12 rounded-md" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/4" /></div></div>
                <div className="flex items-center gap-3"><Skeleton className="h-12 w-12 rounded-md" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/4" /></div></div>
            </div>
        )
    }

    if (!products || products.length === 0) {
        return <p className="text-center text-sm text-muted-foreground">You have no products to display.</p>
    }

    return (
        <ScrollArea className="h-full">
            <div className="space-y-2">
                {products.map(product => (
                    <ProductRow key={product.id} product={product} onPin={onPinProduct} onUnpin={onUnpinProduct} />
                ))}
            </div>
        </ScrollArea>
    )
}
