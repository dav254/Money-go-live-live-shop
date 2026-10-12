'use client';

import type { Product, SellerShop } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Store, Tag } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';

interface ProductInfoProps {
  product: Product;
}

export function ProductInfo({ product }: ProductInfoProps) {
  if (!product) return null;

  const firestore = useFirestore();
  const sellerShopRef = useMemoFirebase(() => doc(firestore, 'sellerShops', product.sellerId), [firestore, product.sellerId]);
  const { data: shop } = useDoc<SellerShop>(sellerShopRef);
  const imageUrl = product.imageUrl?.trim();
  const mainPrice = product.localPrice || product.price || 0;

  return (
    <div className="bg-black/60 p-3 rounded-2xl shadow-2xl backdrop-blur-2xl max-w-sm w-full mx-auto relative overflow-hidden group border border-white/10 ring-1 ring-white/5">
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 rounded-xl overflow-hidden border border-white/5 shrink-0 bg-neutral-900">
          {imageUrl ? <Image src={imageUrl} alt={product.name || 'Product image'} fill sizes="64px" priority className="object-cover transition-transform group-hover:scale-110 duration-700" /> : <span className="flex h-full items-center justify-center px-1 text-center text-[9px] font-medium text-neutral-500">No image</span>}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[11px] font-black text-white truncate uppercase tracking-tight mb-1">{product.name || 'Unnamed Item'}</h3>
          <div className="flex items-center gap-1.5"><Tag className="h-3 w-3 text-primary" /><p className="text-[14px] font-black text-primary tracking-tighter leading-none">{product.localCurrency || 'USD'} {mainPrice.toLocaleString()}</p></div>
          {product.wasPrice && <div className="flex items-center gap-1.5 opacity-60"><span className="text-[9px] font-black text-white uppercase tracking-widest leading-none">Market:</span><span className="text-[11px] font-bold text-white line-through tracking-tighter leading-none">${product.wasPrice.toLocaleString()}</span></div>}
          <div className="flex items-center gap-2 text-[8px] font-black text-neutral-500 uppercase tracking-widest mt-2"><span className="text-green-500/80">Net: ${Number(product.price || 0).toFixed(2)}</span></div>
        </div>
        <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[9px] tracking-widest h-10 shrink-0 px-4 rounded-xl shadow-xl shadow-primary/20 border-none transition-all active:scale-95"><Link href={`/sellers/${product.sellerId}`}><Store className="h-3.5 w-3.5 mr-1.5" />SHOP</Link></Button>
      </div>
    </div>
  );
}
