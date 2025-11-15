import { MainLayout } from '@/components/layout/main-layout';
import { sellers, products } from '@/lib/placeholder-data';
import { SellerHeader } from '@/components/seller/seller-header';
import { ProductGrid } from '@/components/seller/product-grid';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export async function generateStaticParams() {
  return sellers.map((seller) => ({
    sellerId: seller.id,
  }));
}

export default function SellerShopPage({ params }: { params: { sellerId: string } }) {
  const seller = sellers.find((s) => s.id === params.sellerId);
  const sellerProducts = products.filter((p) => p.sellerId === params.sellerId);

  if (!seller) {
    return (
      <MainLayout>
        <div className="flex h-full items-center justify-center">
          <h1 className="text-2xl font-bold">Seller not found</h1>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto max-w-7xl py-8">
        <SellerHeader seller={seller} />
        <Separator className="my-8" />
        
        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:w-fit">
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>
          <TabsContent value="products" className="mt-6">
             <ProductGrid products={sellerProducts} />
          </TabsContent>
          <TabsContent value="videos" className="mt-6">
            <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <p className="text-muted-foreground">No videos uploaded yet.</p>
            </div>
          </TabsContent>
          <TabsContent value="reviews" className="mt-6">
            <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <p className="text-muted-foreground">No reviews yet.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
