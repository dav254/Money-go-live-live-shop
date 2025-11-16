
import type { Product } from '@/lib/types';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1">
      <CardContent className="p-0">
        <div className="relative aspect-[4/3] w-full">
          <Image
            src={product.image.imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            data-ai-hint={product.image.imageHint}
          />
        </div>
        <div className="p-3">
          <h3 className="font-headline font-semibold truncate text-sm">{product.name}</h3>
          <div className="mt-1 flex items-baseline justify-between">
            <div>
                <p className="text-base font-bold text-primary">{product.price.toLocaleString()}</p>
                {product.originalPrice && (
                    <p className="text-xs text-muted-foreground line-through">{product.originalPrice.toLocaleString()}</p>
                )}
            </div>
            <Button size="icon" variant="ghost">
              <ShoppingCart className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
