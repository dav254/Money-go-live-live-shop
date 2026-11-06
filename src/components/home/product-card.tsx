import Link from 'next/link';
import { Store, Clock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface LandingProduct {
  id: string;
  image: string;
  title: string;
  price: string;
  seller: string;
  category: string;
}

export function ProductCard({ product }: { product: LandingProduct }) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="group overflow-hidden rounded-[20px] border border-white/10 bg-white/5 transition-all hover:-translate-y-1 hover:border-[#ff5a36]/30 hover:shadow-[0_20px_60px_rgba(255,82,54,0.12)]"
    >
      <div className="relative h-36 overflow-hidden bg-[#111111]">
        <img
          src={product.image}
          alt={product.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090909]/80 via-transparent to-transparent" />
      </div>

      <div className="p-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#ff5a36]">
          {product.category}
        </p>
        <h3 className="mt-1 font-grotesk text-lg font-bold text-white">
          {product.title}
        </h3>
        <p className="mt-2 font-grotesk text-xl font-black text-[#ff5a36]">
          {product.price}
        </p>

        <div className="mt-3 flex items-center gap-2 text-[10px] text-white/50">
          <span className="flex items-center gap-1">
            <Store className="h-3 w-3 text-[#ff5a36]" />
            {product.seller}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-[#ff5a36]" />
            Fresh
          </span>
        </div>

        <Button
          asChild
          className="mt-4 w-full border-0 bg-[#ff5a36] font-bold text-[#150d0b] hover:bg-[#ff6b49]"
        >
          <Link href={`/products/${product.id}`}>
            View details
            <span className="ml-1.5 h-4 w-4 rounded-full bg-[#150d0b] font-bold text-xs">
              →
            </span>
          </Link>
        </Button>
      </div>
    </Link>
  );
}
