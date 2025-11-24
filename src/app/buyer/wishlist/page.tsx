
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { ProductCard } from '@/components/seller/product-card';
import { Button } from '@/components/ui/button';
import { useCollection, useFirestore, useUser, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc, deleteDoc, getDocs, where } from 'firebase/firestore';
import { Heart, PlusCircle, Trash2, Bookmark } from 'lucide-react';
import type { Product } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

type WishlistItem = {
  id: string; // This will be the productId
  productId: string;
  addedAt: any;
};

const ProductGridSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
                <Skeleton className="h-56 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-6 w-2/5" />
            </div>
        ))}
    </div>
);


export default function BuyerWishlistPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const wishlistQuery = useMemoFirebase(() => {
        if (!user) return null;
        return collection(firestore, `userProfiles/${user.uid}/wishlist`);
    }, [firestore, user]);

    const { data: wishlistItems } = useCollection<WishlistItem>(wishlistQuery);
    
    useEffect(() => {
        if (!wishlistItems) {
            if(user) setIsLoading(false); // If user is loaded and there are no items, stop loading
            return;
        };

        const fetchProducts = async () => {
            if (wishlistItems.length === 0) {
                setProducts([]);
                setIsLoading(false);
                return;
            }
            
            const productIds = wishlistItems.map(item => item.productId);
            const productsRef = collection(firestore, 'products');
            // Firestore 'in' queries are limited to 10 items.
            // For a production app, we would need to batch these queries.
            const q = query(productsRef, where('__name__', 'in', productIds.slice(0, 10)));
            
            try {
                const productSnapshots = await getDocs(q);
                const fetchedProducts = productSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
                setProducts(fetchedProducts);
            } catch (error) {
                console.error("Error fetching wishlist products:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProducts();
    }, [wishlistItems, firestore, user]);

    const handleRemoveFromWishlist = async (productId: string) => {
        if (!user) return;
        const wishlistItemRef = doc(firestore, `userProfiles/${user.uid}/wishlist`, productId);
        try {
            await deleteDoc(wishlistItemRef);
            toast({
                title: 'Item Removed',
                description: 'The product has been removed from your wishlist.',
            });
        } catch (error) {
            console.error("Error removing from wishlist:", error);
             toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not remove the item from your wishlist.',
            });
        }
    };


  return (
    <BuyerLayout>
      <div className="container mx-auto max-w-7xl py-8">
        <h1 className="font-headline text-3xl font-bold mb-8">My Wishlist</h1>
        <Tabs defaultValue="products">
          <TabsList className="mb-6">
            <TabsTrigger value="products">My Wishlist</TabsTrigger>
            <TabsTrigger value="shops">Saved Shops</TabsTrigger>
            <TabsTrigger value="viewed">Recently Viewed</TabsTrigger>
          </TabsList>
          
          <TabsContent value="products">
             {isLoading ? (
                <ProductGridSkeleton />
             ) : products.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {products.map((product) => (
                    <div key={product.id} className="relative group">
                        <ProductCard product={product} />
                        <Button 
                            size="icon" 
                            variant="destructive" 
                            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveFromWishlist(product.id)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                    <Bookmark className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-xl font-semibold">Your Wishlist is Empty</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Click the bookmark icon on products in the feed to save them here.
                    </p>
                </div>
              )}
          </TabsContent>
          <TabsContent value="shops">
             <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                    <Heart className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-xl font-semibold">No Saved Shops</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                       This feature is coming soon! You'll be able to follow your favorite sellers here.
                    </p>
                </div>
          </TabsContent>
          <TabsContent value="viewed">
            <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
                <p className="text-muted-foreground">Recently viewed products will appear here.</p>
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </BuyerLayout>
  );
}
