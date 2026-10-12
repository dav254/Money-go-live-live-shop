'use client';

import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/products/product-card';

interface ProductGridProps {
  products: Product[];
}

function hasUploadedMedia(product: Product) {
  return Boolean(
    product.imageUrl?.trim() ||
    product.videoUrl?.trim() ||
    product.imageUrls?.some((url) => url?.trim()) ||
    product.videoUrls?.some((url) => url?.trim()),
  );
}

export function ProductGrid({ products }: ProductGridProps) {
  const productsWithMedia = (products ?? []).filter(hasUploadedMedia);

  if (productsWithMedia.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg bg-neutral-900">
        <p className="text-neutral-400">No products with uploaded media found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {productsWithMedia.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
