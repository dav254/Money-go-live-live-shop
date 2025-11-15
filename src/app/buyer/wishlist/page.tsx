import { MainLayout } from '@/components/layout/main-layout';
import { ProductCard } from '@/components/seller/product-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { products, sellers } from '@/lib/placeholder-data';
import { Heart, PlusCircle, Trash2 } from 'lucide-react';
import Image from 'next/image';

const favoriteProducts = [products[0], products[4], products[5]];
const favoriteShops = [sellers[0], sellers[1]];

export default function BuyerWishlistPage() {
  return (
    <MainLayout>
      <div className="container mx-auto max-w-7xl py-8">
        <h1 className="font-headline text-3xl font-bold mb-8">My Wishlist</h1>
        <Tabs defaultValue="products">
          <TabsList className="mb-6">
            <TabsTrigger value="products">My Wishlist</TabsTrigger>
            <TabsTrigger value="shops">Saved Shops</TabsTrigger>
            <TabsTrigger value="viewed">Recently Viewed</TabsTrigger>
          </TabsList>
          
          <TabsContent value="products">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {favoriteProducts.map((product) => (
                <div key={product.id} className="relative group">
                    <ProductCard product={product} />
                    <Button size="icon" variant="destructive" className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="shops">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {favoriteShops.map((seller) => (
                <Card key={seller.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={seller.avatar.imageUrl} />
                      <AvatarFallback>{seller.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-bold">{seller.name}</p>
                      <p className="text-sm text-muted-foreground">{seller.followers.toLocaleString()} Followers</p>
                    </div>
                    <Button variant="outline" size="sm">Visit</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="viewed">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {products.slice(1, 6).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </MainLayout>
  );
}
