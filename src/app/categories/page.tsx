
'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingBag, Laptop, Home, Heart, Apple, Dumbbell, Palette, Book, LayoutGrid, Car, Baby, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { PRODUCT_CATEGORIES } from '@/lib/constants';

const categoryIcons: Record<string, React.ElementType> = {
    "Fashion & Apparel": ShoppingBag,
    "Electronics & Gadgets": Laptop,
    "Home & Living": Home,
    "Beauty & Personal Care": Heart,
    "Food & Groceries": Apple,
    "Health & Wellness": Stethoscope,
    "Baby & Kids": Baby,
    "Sports & Outdoors": Dumbbell,
    "Art & Collectibles": Palette,
    "Books & Stationery": Book,
    "Automotive": Car,
    "Other": LayoutGrid
};

export default function CategoriesPage() {
  return (
    <MainLayout>
      <div className="container mx-auto max-w-7xl py-12 px-4">
        <div className="mb-12">
            <h1 className="font-headline text-4xl font-bold">Categories</h1>
            <p className="text-muted-foreground mt-2">Discover products across all our collections.</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          {PRODUCT_CATEGORIES.map((category) => {
            const Icon = categoryIcons[category] || LayoutGrid;
            return (
                <Link href={`/search?q=${encodeURIComponent(category)}`} key={category}>
                <Card className="relative overflow-hidden group aspect-square flex flex-col items-center justify-center p-6 transition-all hover:shadow-xl hover:shadow-primary/10 border-2 hover:border-primary">
                    <div className="p-4 rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                        <Icon className="h-12 w-12 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <CardHeader className="p-0 mt-4 text-center">
                    <CardTitle className="font-headline text-base font-bold">{category}</CardTitle>
                    </CardHeader>
                </Card>
                </Link>
            )
          })}
        </div>
      </div>
    </MainLayout>
  );
}
