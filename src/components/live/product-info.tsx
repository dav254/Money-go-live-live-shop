
'use client';

import type { Product, Review } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Star, Store, Tag } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import React from 'react';

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
    <div className="bg-black/50 p-3 rounded-lg shadow-lg backdrop-blur-md max-w-sm w-full mx-auto">
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
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white truncate">{product.name}</h3>
                {product.coupon && (
                  <div className="flex items-center gap-1.5 text-xs text-yellow-400 font-bold mt-1">
                      <Tag className="h-3 w-3" /> LIVE DEAL: {product.coupon.discount}% OFF
                  </div>
                )}
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
