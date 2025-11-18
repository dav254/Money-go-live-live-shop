
import type { Product } from '@/lib/types';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge'; // Import Badge component
import Link from 'next/link';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const isOutOfStock = product.stock !== undefined && product.stock <= 0;

  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1 h-full flex flex-col">
      <CardContent className="p-0 flex flex-col flex-grow">
        <Link href={`/products/${product.id}`} className="block relative aspect-[4/3] w-full">
          <Image
            src={product.imageUrl ?? product.image?.imageUrl ?? '/placeholder.svg'} // Use optional chaining and a fallback
            alt={product.name}
            fill
            className="object-cover"
            data-ai-hint={product.image?.imageHint}
          />
          {isOutOfStock && (
            <Badge variant="destructive" className="absolute top-2 right-2">Out of Stock</Badge>
          )}
        </Link>
        <div className="p-3 flex flex-col flex-grow">
          <h3 className="font-headline font-semibold truncate text-sm">{product.name}</h3>
          <div className="mt-auto pt-2 flex items-baseline justify-between">
            <div>
                <p className="text-base font-bold text-primary">{product.price.toLocaleString()}</p>
                {(product.originalPrice || product.wasPrice) && (
                    <p className="text-xs text-muted-foreground line-through">{(product.originalPrice || product.wasPrice)?.toLocaleString()}</p>
                )}
            </div>
            <Button size="icon" variant={isOutOfStock ? "secondary" : "ghost"} disabled={isOutOfStock}>
              <ShoppingCart className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
