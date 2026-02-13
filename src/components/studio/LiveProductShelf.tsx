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
import { cn } from '@/lib/utils';

interface LiveProductShelfProps {
    sellerId: string;
    onPinProduct: (product: Product) => void;
    onUnpinProduct: () => void;
    pinnedProductId: string | null;
}

const ProductRow = ({ product, onPin, onUnpin, isPinned }: { product: Product; onPin: (p: Product) => void; onUnpin: () => void; isPinned: boolean; }) => {
    return (
        <div className={cn(
            "flex flex-col gap-2 p-2 rounded-lg border transition-all duration-300",
            isPinned ? "bg-primary/10 border-primary/50" : "hover:bg-white/5 border-transparent"
        )}>
            <div className="relative aspect-square w-full rounded-md overflow-hidden bg-neutral-800">
                <Image 
                    src={product.imageUrl || 'https://picsum.photos/seed/placeholder/150'} 
                    alt={product.name || 'product'} 
                    fill 
                    className="object-cover" 
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1">
                    <p className="text-[10px] font-bold text-white text-center">${product.price.toLocaleString()}</p>
                </div>
            </div>
            <div className="flex flex-col gap-1 overflow-hidden">
                <p className="truncate text-[11px] font-medium text-center">{product.name}</p>
                <Button 
                    size="sm" 
                    variant={isPinned ? "secondary" : "default"} 
                    className={cn(
                        "h-7 w-full text-[10px] font-bold",
                        isPinned ? "bg-red-600 hover:bg-red-700 text-white border-none" : "bg-primary text-primary-foreground"
                    )}
                    onClick={() => isPinned ? onUnpin() : onPin(product)}
                >
                    {isPinned ? (
                        <>
                            <PinOff className="h-3 w-3 mr-1" /> UNPIN
                        </>
                    ) : (
                        <>
                            <Pin className="h-3 w-3 mr-1" /> PIN
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
};

export function LiveProductShelf({ sellerId, onPinProduct, onUnpinProduct, pinnedProductId }: LiveProductShelfProps) {
    const firestore = useFirestore();

    const productsQuery = useMemoFirebase(() => {
        if (!sellerId) return null;
        return query(collection(firestore, 'products'), where('sellerId', '==', sellerId));
    }, [firestore, sellerId]);

    const { data: products, isLoading } = useCollection<Product>(productsQuery);

    if (isLoading) {
        return (
            <div className="space-y-4 p-2">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="aspect-square w-full rounded-md" />
                        <Skeleton className="h-3 w-3/4 mx-auto" />
                        <Skeleton className="h-7 w-full rounded-md" />
                    </div>
                ))}
            </div>
        )
    }

    if (!products || products.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-48 px-4 text-center">
                <p className="text-[11px] text-muted-foreground">You have no products to display. Add some in the Dashboard.</p>
            </div>
        )
    }

    return (
        <ScrollArea className="h-full">
            <div className="space-y-4 p-2">
                {products.map(product => (
                    <ProductRow 
                        key={product.id} 
                        product={product} 
                        onPin={onPinProduct} 
                        onUnpin={onUnpinProduct} 
                        isPinned={pinnedProductId === product.id}
                    />
                ))}
            </div>
        </ScrollArea>
    )
}