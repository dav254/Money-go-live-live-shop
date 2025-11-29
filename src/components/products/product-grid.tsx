
'use client';

import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/seller/product-card';

interface ProductGridProps {
  products: Product[];
}

export function ProductGrid({ products }: ProductGridProps) {
  if (!products || products.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-neutral-900 rounded-lg">
        <p className="text-neutral-400">No products found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} priority={index < 4} />
      ))}
    </div>
  );
}
