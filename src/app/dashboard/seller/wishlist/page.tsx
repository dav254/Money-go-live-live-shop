
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { products } from '@/lib/placeholder-data';
import { BarChart2, Heart, PlusCircle, Tag, TrendingUp, Sparkles, Pencil, Trash2 } from 'lucide-react';
import Image from 'next/image';

const favoriteProducts = [
  products[0],
  products[3],
  products[4],
];

export default function SellerWishlistPage() {
  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            My Wishlist & Favorites
          </h1>
           <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Product to Favorites
            </Button>
        </div>

        <Tabs defaultValue="favorites">
          <TabsList>
            <TabsTrigger value="favorites">My Favorite Products</TabsTrigger>
            <TabsTrigger value="campaigns">Saved Campaigns</TabsTrigger>
            <TabsTrigger value="trends">Market Trends</TabsTrigger>
          </TabsList>
          <TabsContent value="favorites" className="mt-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {favoriteProducts.map((product) => (
                <Card key={product.id} className="group overflow-hidden">
                  <div className="relative aspect-video">
                    <Image
                      src={product.image.imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover"
                      data-ai-hint={product.image.imageHint}
                    />
                     <div className="absolute top-2 right-2 flex gap-1">
                          <Button size="icon" variant="destructive" className="h-8 w-8 rounded-full">
                            <Heart className="h-4 w-4" fill="white" />
                          </Button>
                     </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-headline font-semibold truncate">
                      {product.name}
                    </h3>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-lg font-bold text-primary">
                        {product.price.toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {product.stock} in stock
                      </p>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <Button size="sm" className="flex-1">
                            <Sparkles className="mr-2 h-4 w-4" /> Promote
                        </Button>
                        <Button size="sm" variant="secondary" className="flex-1">
                            Add to Live
                        </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="campaigns" className="mt-6">
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <Tag className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold">No Saved Campaigns</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Plan and save your promotions here for later.
              </p>
              <Button className="mt-4">
                <PlusCircle className="mr-2 h-4 w-4" /> Create Campaign
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="trends" className="mt-6">
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold">Marketplace Trends</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                See what's popular and trending in the marketplace to get inspired.
              </p>
               <Button variant="secondary" className="mt-4">
                View Market Report
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}
