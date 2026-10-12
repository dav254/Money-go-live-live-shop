
'use client';

import React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import Image from 'next/image';
import { Button } from '../ui/button';
import { Pin, PinOff, ShoppingBag } from 'lucide-react';
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
            "relative w-full rounded-xl overflow-hidden border transition-all duration-300 group bg-neutral-900",
            isPinned ? "border-primary ring-2 ring-primary bg-primary/5" : "border-white/5"
        )}>
            <div className="flex p-2 gap-3 items-center">
                <div className="relative h-14 w-14 rounded-lg overflow-hidden shrink-0 border border-white/10">
                    <Image 
                        src={product.imageUrl?.trim() || getPlaceholderImage()} 
                        alt={product.name || 'product'} 
                        fill 
                        className="object-cover" 
                    />
                </div>
                
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate uppercase tracking-tight">{product.name}</p>
                    <p className="text-[10px] font-black text-primary mt-0.5">${product.price.toLocaleString()}</p>
                </div>

                <Button 
                    size="sm" 
                    variant={isPinned ? "destructive" : "default"} 
                    className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest"
                    onClick={() => isPinned ? onUnpin() : onPin(product)}
                >
                    {isPinned ? <PinOff className="h-3 w-3 mr-1.5" /> : <Pin className="h-3 w-3 mr-1.5" />}
                    {isPinned ? 'Unpin' : 'Pin'}
                </Button>
            </div>

            {isPinned && (
                <div className="absolute top-0 left-0 bg-primary px-1.5 py-0.5 rounded-br-md">
                    <span className="text-[8px] font-black text-white uppercase">Active</span>
                </div>
            )}
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
            <div className="flex flex-col gap-3 p-4">
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
            </div>
        )
    }

    if (!products || products.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6 opacity-30">
                <ShoppingBag className="h-12 w-12 text-neutral-500 mb-4" />
                <p className="text-[10px] text-muted-foreground leading-tight uppercase font-black tracking-widest">No Items in Catalog</p>
            </div>
        )
    }

    return (
        <ScrollArea className="h-full w-full">
            <div className="flex flex-col gap-3 p-4">
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
