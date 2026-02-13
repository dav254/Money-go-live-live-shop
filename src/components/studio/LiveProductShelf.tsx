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
            "relative aspect-square w-full rounded-md overflow-hidden border transition-all duration-300 group",
            isPinned ? "border-primary ring-2 ring-primary" : "border-white/10"
        )}>
            <Image 
                src={product.imageUrl || 'https://picsum.photos/seed/placeholder/150'} 
                alt={product.name || 'product'} 
                fill 
                className="object-cover" 
            />
            
            {/* Actions Overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                <Button 
                    size="icon" 
                    variant={isPinned ? "destructive" : "default"} 
                    className="h-8 w-8 rounded-full shadow-lg"
                    onClick={() => isPinned ? onUnpin() : onPin(product)}
                >
                    {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </Button>
            </div>

            {/* Indicator Badges */}
            {isPinned && (
                <div className="absolute top-0 right-0 bg-primary p-0.5 rounded-bl-md">
                    <Pin className="h-2.5 w-2.5 text-white" />
                </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-0.5 text-[8px] text-center font-bold text-white truncate px-1">
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
            <div className="space-y-2 p-1">
                {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="aspect-square w-full rounded-md" />
                ))}
            </div>
        )
    }

    if (!products || products.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-48 px-1 text-center">
                <p className="text-[10px] text-muted-foreground leading-tight">No items</p>
            </div>
        )
    }

    return (
        <ScrollArea className="h-full">
            <div className="space-y-2 p-1">
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