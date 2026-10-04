'use client';

import type { Product, SellerShop } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Store, Tag, MapPin } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { isService, ListingPrice, ListingStock, ServiceBadge } from '@/components/listings/service-badge';
import { useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import React from 'react';

interface ProductInfoProps {
  product: Product;
  /**
   * Where the SHOP button goes. Required on purpose: an omitted destination
   * used to mean "the seller's shop", which is the bug this prop exists to
   * remove, so there is no default to fall back into.
   */
  appHref: string;
}

/**
 * Enhanced ProductInfo component for immersive views.
 * Displays local price, market price (wasPrice), and global USD equivalent.
 *
 * ## The SHOP button goes to the PRODUCT, not the seller's storefront
 *
 * This button used to point at `/sellers/{sellerId}` — so the one control on
 * the product card labelled after the product opened the seller's shop
 * instead. It now opens the product itself.
 *
 * `appHref` is what makes that true without breaking the website feed, which
 * renders this same card. The app route (`/app/buyer/product/[productId]`) is
 * the buyer's own screen and inherits the buyer shell; the website has no such
 * route, so a caller on the website passes its own detail URL. Every call site
 * therefore states its destination explicitly — there is no path sniffing and
 * no silent fallback that could send an app buyer out to the website.
 */
export function ProductInfo({ product, appHref }: ProductInfoProps) {
  if (!product) {
    return null;
  }

  const firestore = useFirestore();
  const sellerShopRef = useMemoFirebase(() => {
    return doc(firestore, 'sellerShops', product.sellerId);
  }, [firestore, product.sellerId]);

  const { data: shop } = useDoc<SellerShop>(sellerShopRef);

  // Fallback image if primary is missing
  const imageUrl = (product.imageUrl && product.imageUrl !== "") 
    ? product.imageUrl 
    : getPlaceholderImage();

  const mainPrice = product.localPrice || product.price || 0;

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
                <h3 className="text-[11px] font-black text-white truncate uppercase tracking-tight mb-1">
                    {product.name || (isService(product) ? 'Service' : 'Unnamed Item')}
                </h3>

                {/*
                  A service is labelled and priced differently, in place.
                  A plumber is not "KES 0" and has no stock — both of which
                  read as broken until you know the listing is work, not goods.
                */}
                <div className="mb-1">
                  <ServiceBadge listing={product} />
                </div>

                <div className="space-y-0.5">
                    {/* MAIN PRICE — or a quote prompt, never a fabricated 0. */}
                    <div className="flex items-center gap-1.5">
                        {isService(product) ? (
                            <ListingPrice listing={product} className="text-[14px]" />
                        ) : (
                            <>
                              <Tag className="h-3 w-3 text-primary" />
                              <p className="text-[14px] font-black text-primary tracking-tighter leading-none">
                                  {product.localCurrency || 'USD'} {mainPrice.toLocaleString()}
                              </p>
                            </>
                        )}
                    </div>

                    {/* MARKET PRICE (Strike-through / Comparative Price) */}
                    {product.wasPrice && (
                        <div className="flex items-center gap-1.5 opacity-60">
                            <span className="text-[9px] font-black text-white uppercase tracking-widest leading-none">Market:</span>
                            <span className="text-[11px] font-bold text-white line-through tracking-tighter leading-none">
                                ${product.wasPrice.toLocaleString()}
                            </span>
                        </div>
                    )}
                </div>

                {/* Metadata Footer — a service has no USD net and no stock. */}
                {!isService(product) && (
                    <div className="flex items-center gap-2 text-[8px] font-black text-neutral-500 uppercase tracking-widest mt-2">
                        <span className="text-green-500/80">Net: ${Number(product.price || 0).toFixed(2)}</span>
                        <ListingStock listing={product} />
                    </div>
                )}
                {isService(product) && product.serviceArea && (
                    <div className="flex items-center gap-1 text-[8px] font-black text-neutral-400 uppercase tracking-widest mt-2 truncate">
                        <MapPin className="h-2.5 w-2.5 shrink-0" aria-hidden />
                        {product.serviceArea}
                    </div>
                )}
            </div>

            {/* Action Button */}
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[9px] tracking-widest h-10 shrink-0 px-4 rounded-xl shadow-xl shadow-primary/20 border-none transition-all active:scale-95">
                <Link href={appHref} aria-label={`View ${product.name || 'this product'}`}>
                    <Store className="h-3.5 w-3.5 mr-1.5"/>
                    SHOP
                </Link>
            </Button>
        </div>
    </div>
  );
}
