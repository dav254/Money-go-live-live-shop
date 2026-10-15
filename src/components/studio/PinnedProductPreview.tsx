
'use client';

import type { Product } from '@/lib/types';
import Image from 'next/image';
import { Skeleton } from '../ui/skeleton';
import { Tag } from 'lucide-react';

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
      <div className="relative h-16 w-16 rounded-md overflow-hidden flex-shrink-0 border border-white/10">
        <Image
          src={product.imageUrl || '/placeholder-image.svg'}
          alt={product.name || 'Pinned Product'}
          fill
          className="object-cover"
        />
      </div>
      <div className="flex-1 overflow-hidden">
        <p className="text-[8px] font-black text-primary uppercase tracking-[0.2em] mb-1">SELECTED PRODUCT</p>
        <p className="text-sm font-bold text-white truncate uppercase tracking-tight mb-1">{product.name}</p>
        
        <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
                <Tag className="h-2.5 w-2.5 text-primary" />
                <span className="text-sm font-black text-primary tracking-tighter">
                    {product.localCurrency || 'USD'} {(product.localPrice || product.price)?.toLocaleString()}
                </span>
            </div>
            {product.wasPrice && (
                <p className="text-[10px] font-bold text-white/50 line-through tracking-tighter">
                    MKT: ${product.wasPrice.toLocaleString()}
                </p>
            )}
        </div>
      </div>
    </div>
  );
}
