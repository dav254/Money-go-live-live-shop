
'use client';

import type { Product, Review, SellerShop } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Star, Store, Tag } from 'lucide-react';
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

/**
 * Enhanced ProductInfo component for immersive views.
 * Displays local price, market price (wasPrice), and global USD equivalent.
 */
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

  // Fallback image if primary is missing
  const imageUrl = (product.imageUrl && product.imageUrl !== "") 
    ? product.imageUrl 
    : getPlaceholderImage();

  return (
    <div className="bg-black/60 p-3 rounded-2xl shadow-2xl backdrop-blur-2xl max-w-sm w-full mx-auto relative overflow-hidden group border border-white/10 ring-1 ring-white/5">
        <div className="flex items-center gap-3">
            {/* Thumbnail */}
            <div className="relative h-16 w-16 rounded-xl overflow-hidden border border-white/5 shrink-0 bg-neutral-900 shadow-inner">
                {imageUrl && (
                  <Image 
                      src={imageUrl}
                      alt={product.name || 'Product Image'}
                      fill
                      sizes="100vw"
                      priority
                      className="object-cover transition-transform group-hover:scale-110 duration-700"
                  />
                )}
            </div>

            {/* Info Section */}
            <div className="flex-1 min-w-0">
                <h3 className="text-[11px] font-black text-white truncate uppercase tracking-tight mb-1">{product.name}</h3>
                
                <div className="space-y-0.5">
                    {/* MAIN PRICE (Local Currency specified by Seller) */}
                    <div className="flex items-center gap-1.5">
                        <Tag className="h-2.5 w-2.5 text-primary" />
                        <p className="text-[13px] font-black text-primary tracking-tighter leading-none">
                            {product.localCurrency || 'USD'} {product.localPrice?.toLocaleString() || product.price?.toLocaleString()}
                        </p>
                    </div>

                    {/* MARKET PRICE (Strike-through / Comparative Price) */}
                    {product.wasPrice && (
                        <div className="flex items-center gap-1.5 opacity-50">
                            <span className="text-[8px] font-black text-white uppercase tracking-widest leading-none">Market:</span>
                            <span className="text-[10px] font-bold text-white line-through tracking-tighter leading-none">
                                ${product.wasPrice.toLocaleString()}
                            </span>
                        </div>
                    )}
                </div>

                {/* Metadata Footer */}
                <div className="flex items-center gap-2 text-[8px] font-black text-neutral-500 uppercase tracking-widest mt-2">
                    {reviews && reviews.length > 0 && (
                      <>
                        <span className="flex items-center gap-0.5 text-white">{averageRating.toFixed(1)} <Star className="h-2 w-2 text-yellow-500 fill-current"/></span>
                        <span className='opacity-20'>|</span>
                      </>
                    )}
                    <span className="text-green-500/80">Net: ${product.price?.toFixed(2)}</span>
                </div>
            </div>

            {/* Action Button */}
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[9px] tracking-widest h-10 shrink-0 px-4 rounded-xl shadow-xl shadow-primary/20 border-none transition-all active:scale-95">
                <Link href={`/sellers/${product.sellerId}`}>
                    <Store className="h-3.5 w-3.5 mr-1.5"/>
                    SHOP
                </Link>
            </Button>
        </div>
    </div>
  );
}
