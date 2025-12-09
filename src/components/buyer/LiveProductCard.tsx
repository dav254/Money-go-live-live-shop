
'use client';

import Image from "next/image";
import { Button } from "../ui/button";
import type { Product } from "@/lib/types";

export function LiveProductCard({ product, onAddToCart }: { product: Product, onAddToCart: (product: Product) => void }) {
  // Fallback in case imageUrl is missing
  const imageUrl = product.imageUrl || 'https://picsum.photos/seed/placeholder/200';

  return (
    <div className="bg-neutral-900 p-2 rounded w-36 flex-shrink-0">
      <div className="h-20 bg-neutral-700 rounded mb-2 relative overflow-hidden">
        <Image src={imageUrl} alt={product.name || 'Product Image'} fill className="object-cover" />
      </div>
      <p className="text-sm font-semibold truncate">{product.name}</p>
      <p className="text-green-400 font-bold">${product.price}</p>
      <Button onClick={() => onAddToCart(product)} size="sm" className="mt-1 bg-blue-600 hover:bg-blue-700 w-full py-1 rounded text-sm h-7">
        Add
      </Button>
    </div>
  );
}
