import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';

export interface LandingCategory {
  label: string;
  href: string;
}

export type LandingCategories = LandingCategory[];

export function CategoryGrid({ categories }: { categories: LandingCategories }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {categories.map((category) => (
        <Link
          key={category.href}
          href={category.href}
          aria-label={`Browse ${category.label} products and services`}
          className="group relative aspect-square overflow-hidden rounded-xl bg-white/5 p-3 transition-all hover:bg-white/10"
        >
          <div className="flex h-full items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#ff5a36]/10 transition-colors group-hover:border-[#ff5a36] group-hover:bg-[#ff5a36]/20">
              <ShoppingBag className="h-5 w-5 text-[#ff5a36]" />
            </div>
          </div>
          <span className="mt-2 block truncate text-xs font-medium text-white/70 group-hover:text-white">
            {category.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
