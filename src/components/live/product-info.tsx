
'use client';

import type { Product, Review } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Star, Store, Tag, Sparkles } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import React from 'react';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

interface ProductInfoProps {
  product: Product;
}

export function ProductInfo({ product }: ProductInfoProps) {
  if (!product) {
    return null;
  }

  const firestore = useFirestore();
  const reviewsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'products', product.id, 'reviews'));
  }, [firestore, product.id]);

  const { data: reviews } = useCollection<Review>(reviewsQuery);

  const averageRating = React.useMemo(() => {
    if (!reviews || reviews.length === 0) return 0;
    const total = reviews.reduce((acc, r) => acc + r.rating, 0);
    return total / reviews.length;
  }, [reviews]);

  // Ensure imageUrl is never an empty string
  const imageUrl = (product.imageUrl && product.imageUrl !== "") 
    ? product.imageUrl 
    : getPlaceholderImage();

  return (
    <div className="bg-black/50 p-3 rounded-lg shadow-lg backdrop-blur-md max-w-sm w-full mx-auto relative overflow-hidden group">
        <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 rounded-md overflow-hidden border border-neutral-700">
                {imageUrl && (
                  <Image 
                      src={imageUrl}
                      alt={product.name || 'Product Image'}
                      fill
                      sizes="100vw"
                      priority
                      className="object-cover"
                  />
                )}
                {product.condition && (
                    <div className={cn(
                        "absolute top-0 left-0 w-full text-[8px] font-black uppercase text-center py-0.5 tracking-tighter",
                        product.condition === 'new' ? "bg-green-600 text-white" : "bg-yellow-600 text-black"
                    )}>
                        {product.condition}
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white truncate">{product.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                    {product.coupon && (
                        <div className="flex items-center gap-1 text-[10px] text-yellow-400 font-bold uppercase tracking-widest">
                            <Tag className="h-2.5 w-2.5" /> {product.coupon.discount}% OFF
                        </div>
                    )}
                    {product.condition === 'used' && (
                        <div className="flex items-center gap-1 text-[10px] text-yellow-500 font-bold uppercase tracking-widest">
                            <Sparkles className="h-2.5 w-2.5" /> PRE-OWNED
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-300 mt-1">
                    {reviews && reviews.length > 0 && (
                      <>
                        <span>{averageRating.toFixed(1)} <Star className="h-3 w-3 inline-block -mt-1 text-yellow-400 fill-current"/></span>
                        <span className='text-neutral-500'>|</span>
                      </>
                    )}
                    <span className="font-semibold text-green-400">${product.price?.toFixed(2)}</span>
                    {product.wasPrice && (
                        <span className="text-neutral-400 line-through">${product.wasPrice.toFixed(2)}</span>
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
