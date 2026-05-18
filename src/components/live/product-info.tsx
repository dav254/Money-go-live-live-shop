
'use client';

import type { Product, Review, SellerShop } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Star, Store, Banknote } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import React from 'react';
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

  const sellerShopRef = useMemoFirebase(() => {
    return doc(firestore, 'sellerShops', product.sellerId);
  }, [firestore, product.sellerId]);

  const { data: reviews } = useCollection<Review>(reviewsQuery);
  const { data: shop } = useDoc<SellerShop>(sellerShopRef);

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
                <h3 className="text-sm font-bold text-white truncate uppercase">{product.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                    {/* Display Currency, Local Sale Price, and Market Price (wasPrice) */}
                    <div className="flex items-center gap-1.5 text-[10px] text-primary font-black uppercase tracking-widest truncate">
                        <Banknote className="h-3 w-3 shrink-0" /> 
                        <span className="truncate">
                            {product.localCurrency || 'USD'} {product.localPrice?.toLocaleString() || product.price?.toLocaleString()}
                        </span>
                        {product.wasPrice && (
                             <span className="text-white/40 font-bold line-through ml-1 shrink-0">
                                MKT: ${product.wasPrice.toLocaleString()}
                             </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-300 mt-1">
                    {reviews && reviews.length > 0 && (
                      <>
                        <span className="flex items-center gap-0.5">{averageRating.toFixed(1)} <Star className="h-3 w-3 text-yellow-400 fill-current"/></span>
                        <span className='text-neutral-500'>|</span>
                      </>
                    )}
                    <span className="font-semibold text-green-400">USD ${product.price?.toFixed(2)}</span>
                </div>
            </div>
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest h-10 shrink-0 px-4 rounded-xl shadow-lg shadow-primary/20">
                <Link href={`/sellers/${product.sellerId}`}>
                    <Store className="h-4 w-4 mr-2"/>
                    Shop
                </Link>
            </Button>
        </div>
    </div>
  );
}
