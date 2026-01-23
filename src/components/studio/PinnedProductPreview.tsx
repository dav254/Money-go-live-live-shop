'use client';

import type { Product } from '@/lib/types';
import Image from 'next/image';
import { Skeleton } from '../ui/skeleton';

export function PinnedProductPreview({ product, isLoading }: { product: Product | null, isLoading: boolean }) {

  if (isLoading) {
    return (
        <div className="bg-black/60 backdrop-blur-md border border-primary/50 p-3 rounded-lg flex items-center gap-3 w-72 shadow-lg">
            <Skeleton className="h-16 w-16 rounded-md"/>
            <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-12"/>
                <Skeleton className="h-4 w-3/4"/>
                <Skeleton className="h-5 w-1/2"/>
            </div>
        </div>
    )
  }

  if (!product) {
    return null;
  }

  return (
    <div className="bg-black/60 backdrop-blur-md border border-primary/50 p-3 rounded-lg flex items-center gap-3 w-72 shadow-lg">
      <div className="relative h-16 w-16 rounded-md overflow-hidden flex-shrink-0">
        <Image
          src={product.imageUrl || 'https://picsum.photos/seed/pinned/150'}
          alt={product.name || 'Pinned Product'}
          fill
          className="object-cover"
        />
      </div>
      <div className="flex-1 overflow-hidden">
        <p className="text-xs text-primary font-semibold">SELECTED PRODUCT</p>
        <p className="text-sm font-bold truncate">{product.name}</p>
        <p className="text-lg font-bold">${product.price.toLocaleString()}</p>
      </div>
    </div>
  );
}
