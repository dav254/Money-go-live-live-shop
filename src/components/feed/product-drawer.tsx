
'use client';

import type { Product } from '@/lib/types';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import Link from 'next/link';

interface ProductDrawerProps {
  product: Product;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function ProductDrawer({ product, isOpen, onOpenChange }: ProductDrawerProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card/95 text-card-foreground border-t-primary border-t-2 rounded-t-2xl backdrop-blur-md">
        <SheetHeader>
          <SheetTitle className="font-headline text-lg text-primary">Featured Product</SheetTitle>
        </SheetHeader>
        <div className="py-4">
            <div className="flex items-start gap-4">
              <div className="relative h-24 w-24 overflow-hidden rounded-lg">
                <Image 
                  src={product.image.imageUrl} 
                  alt={product.name || 'Product Image'} 
                  fill 
                  className="object-cover" 
                  data-ai-hint={product.image.imageHint}
                />
              </div>
              <div className="flex-1">
                <h3 className="font-headline text-lg font-semibold">{product.name}</h3>
                <div className="text-xl font-bold text-primary mt-1">
                  {product.price.toLocaleString()}
                  {product.originalPrice && (
                    <span className="ml-2 text-sm text-muted-foreground line-through">
                      {product.originalPrice.toLocaleString()}
                    </span>
                  )}
                </div>
                 <p className="text-sm text-muted-foreground mt-1">
                  Only {product.stock} left in stock!
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3">
               <Button size="lg" className="w-full font-bold text-lg">Buy Now</Button>
               <Button size="lg" variant="secondary" className="w-full font-bold text-lg">Add to Cart</Button>
               <Button size="lg" variant="link" asChild>
                  <Link href={`/sellers/${product.sellerId}`}>Visit Shop</Link>
                </Button>
            </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
