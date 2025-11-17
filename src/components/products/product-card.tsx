'use client';

import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Heart, ShoppingCart, Eye } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const isOutOfStock = product.stock !== undefined && product.stock <= 0;
  const discountPercentage = product.originalPrice && product.price ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden group text-white">
      <div className="relative">
        <a href={`/products/${product.id}`} className="cursor-pointer">
            <img
            src={product.image?.imageUrl || '/placeholder.svg'}
            alt={product.name || 'Product image'}
            className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
            />
        </a>
        {discountPercentage > 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
            {discountPercentage}% OFF
          </div>
        )}
        <Button size="icon" variant="ghost" className="absolute top-2 right-2 bg-black/50 text-white rounded-full h-8 w-8 hover:bg-black/70">
          <Heart className="h-4 w-4" />
        </Button>
        {isOutOfStock && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white font-bold">Out of Stock</span>
            </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold truncate group-hover:text-red-400">
            <a href={`/products/${product.id}`}>{product.name}</a>
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-lg font-bold text-green-400">${product.price?.toFixed(2)}</span>
          {product.originalPrice && (
            <span className="text-sm text-neutral-400 line-through">${product.originalPrice.toFixed(2)}</span>
          )}
        </div>
        <div className="mt-3 flex gap-2">
            <Button disabled={isOutOfStock} size="sm" className="w-full bg-red-500 hover:bg-red-600 text-white">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add to Cart
            </Button>
            <Button asChild size="icon" variant="outline" className="shrink-0 border-neutral-700 hover:bg-neutral-800">
                <a href={`/products/${product.id}`}><Eye className="h-4 w-4" /></a>
            </Button>
        </div>
      </div>
    </div>
  );
}
