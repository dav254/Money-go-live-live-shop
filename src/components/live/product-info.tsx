
'use client';

import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Star, Store } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { getPlaceholderImage } from '@/lib/placeholder-images';

interface ProductInfoProps {
  product: Product;
}

export function ProductInfo({ product }: ProductInfoProps) {
  if (!product) {
    return null;
  }

  const imageUrl = product.image?.imageUrl || product.imageUrl || getPlaceholderImage();

  return (
    <div className="bg-black/50 p-3 rounded-lg shadow-lg backdrop-blur-md max-w-sm w-full mx-auto">
        <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 rounded-md overflow-hidden border border-neutral-700">
                <Image 
                    src={imageUrl}
                    alt={product.name || 'Product Image'}
                    fill
                    sizes="100vw"
                    priority
                    className="object-cover"
                />
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white truncate">{product.name}</h3>
                <div className="flex items-center gap-2 text-xs text-neutral-300 mt-1">
                    <span>{product.rating?.toFixed(1) || 'N/A'} <Star className="h-3 w-3 inline-block -mt-1 text-yellow-400 fill-current"/></span>
                    <span className='text-neutral-500'>|</span>
                    <span className="font-semibold text-green-400">${product.price?.toFixed(2)}</span>
                    {product.originalPrice && (
                        <span className="text-neutral-400 line-through">${product.originalPrice.toFixed(2)}</span>
                    )}
                </div>
            </div>
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shrink-0">
                <Link href={`/sellers/${product.sellerId}`}>
                    <Store className="h-4 w-4 mr-2"/>
                    Shop
                </Link>
            </Button>
        </div>
    </div>
  );
}
