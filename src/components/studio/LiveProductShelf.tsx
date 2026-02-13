'use client';

import React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
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
            "relative aspect-square w-16 md:w-full rounded-lg overflow-hidden border transition-all duration-300 group shrink-0",
            isPinned ? "border-primary ring-2 ring-primary" : "border-white/10"
        )}>
            <Image 
                src={product.imageUrl || 'https://picsum.photos/seed/placeholder/150'} 
                alt={product.name || 'product'} 
                fill 
                className="object-cover" 
            />
            
            {/* Actions Overlay - Touch friendly for mobile */}
            <div className={cn(
                "absolute inset-0 bg-black/60 flex items-center justify-center p-1 transition-opacity",
                isPinned ? "opacity-100" : "opacity-0 md:group-hover:opacity-100"
            )}>
                <Button 
                    size="icon" 
                    variant={isPinned ? "destructive" : "default"} 
                    className="h-7 w-7 md:h-8 md:w-8 rounded-full shadow-lg"
                    onClick={() => isPinned ? onUnpin() : onPin(product)}
                >
                    {isPinned ? <PinOff className="h-3 w-3 md:h-4 md:w-4" /> : <Pin className="h-3 w-3 md:h-4 md:w-4" />}
                </Button>
            </div>

            {/* Indicator Badge */}
            {isPinned && (
                <div className="absolute top-0 right-0 bg-primary p-0.5 rounded-bl-md">
                    <Pin className="h-2 w-2 text-white" />
                </div>
            )}
            
            {/* Price Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-0.5 text-[7px] md:text-[8px] text-center font-black text-white truncate px-1">
                ${product.price.toLocaleString()}
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
            <div className="flex md:flex-col gap-2 p-2">
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="aspect-square w-16 md:w-full rounded-lg" />
                ))}
            </div>
        )
    }

    if (!products || products.length === 0) {
        return (
            <div className="flex items-center justify-center h-full w-full p-2 text-center">
                <p className="text-[10px] text-muted-foreground leading-tight uppercase font-bold">No Items</p>
            </div>
        )
    }

    return (
        <ScrollArea className="h-full w-full">
            <div className="flex md:flex-col gap-2 p-2 min-w-max md:min-w-0">
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
            <ScrollBar orientation="horizontal" className="md:hidden" />
        </ScrollArea>
    )
}
