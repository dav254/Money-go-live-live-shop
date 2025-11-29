import { MainLayout } from '@/components/layout/main-layout';
import { categories } from '@/lib/placeholder-data';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';

export default function CategoriesPage() {
  return (
    <MainLayout>
      <div className="container mx-auto max-w-7xl py-8">
        <h1 className="font-headline text-3xl font-bold mb-8">Categories</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {categories.map((category) => (
            <Link href="#" key={category.id}>
              <Card className="relative overflow-hidden group aspect-square flex items-end justify-start p-4 transition-all hover:shadow-lg hover:shadow-primary/20">
                <Image 
                  src={category.image.imageUrl} 
                  alt={category.name} 
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 16vw"
                  className="object-cover transition-transform group-hover:scale-105"
                  data-ai-hint={category.image.imageHint}
                />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                <CardHeader className="p-0 z-10">
                  <CardTitle className="font-headline text-lg text-white">{category.name}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
