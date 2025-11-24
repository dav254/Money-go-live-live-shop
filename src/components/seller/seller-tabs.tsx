
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductGrid } from "@/components/products/product-grid";
import { SellerInfo } from "./seller-info";
import { SellerReviews } from "./seller-reviews";
import type { Seller, Product } from "@/lib/types";

interface SellerTabsProps {
  seller: Seller;
  products: Product[];
}

export function SellerTabs({ seller, products }: SellerTabsProps) {
  const videoProducts = products.filter(p => p.videoUrl);

  return (
    <Tabs defaultValue="products" className="w-full">
      <TabsList className="sticky top-14 z-30 grid w-full grid-cols-5 rounded-none border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-sm md:w-fit md:rounded-lg">
        <TabsTrigger value="products">Products</TabsTrigger>
        <TabsTrigger value="reviews">Reviews</TabsTrigger>
        <TabsTrigger value="videos">Videos</TabsTrigger>
        <TabsTrigger value="live">Live</TabsTrigger>
        <TabsTrigger value="about">About</TabsTrigger>
      </TabsList>
      
      <div className="mt-6">
        <TabsContent value="products">
          <ProductGrid products={products} />
        </TabsContent>

        <TabsContent value="reviews">
          <SellerReviews seller={seller} />
        </TabsContent>

        <TabsContent value="videos">
          {videoProducts.length > 0 ? (
            <ProductGrid products={videoProducts} />
          ) : (
            <div className="flex items-center justify-center rounded-lg bg-neutral-900 p-12 text-center">
              <p className="text-neutral-400">This seller has not uploaded any videos yet.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="live">
          <div className="flex items-center justify-center rounded-lg bg-neutral-900 p-12 text-center">
            <p className="text-neutral-400">No live streams scheduled.</p>
          </div>
        </TabsContent>

        <TabsContent value="about">
          <SellerInfo seller={seller} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

    