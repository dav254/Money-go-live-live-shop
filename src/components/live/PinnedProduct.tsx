'use client';

import type { Product } from '@/lib/types';
import Image from 'next/image';
import { Button } from '../ui/button';
import { ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';

export function PinnedProduct({ product }: { product: Product }) {
  if (!product) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-black/60 backdrop-blur-md border border-primary/50 p-3 rounded-lg flex items-center gap-3 w-72 shadow-lg"
    >
      <div className="relative h-16 w-16 rounded-md overflow-hidden flex-shrink-0">
        <Image
          src={product.imageUrl || 'https://picsum.photos/seed/pinned/150'}
          alt={product.name || 'Pinned Product'}
          fill
          className="object-cover"
        />
      </div>
      <div className="flex-1 overflow-hidden">
        <p className="text-xs text-primary font-semibold">PINNED</p>
        <p className="text-sm font-bold truncate">{product.name}</p>
        <p className="text-lg font-bold">${product.price.toLocaleString()}</p>
      </div>
      <Button size="icon" className="h-10 w-10 shrink-0">
        <ShoppingBag className="h-5 w-5" />
      </Button>
    </motion.div>
  );
}
