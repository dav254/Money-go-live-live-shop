
import { MainLayout } from '@/components/layout/main-layout';
import { SellerHeader } from '@/components/seller/seller-header';
import { ShopStoryHighlights } from '@/components/seller/shop-story-highlights';
import { SellerTabs } from '@/components/seller/seller-tabs';
import { sellers, products, reviews, storyHighlights } from '@/lib/placeholder-data';
import type { Seller, Product, Review, StoryHighlight } from '@/lib/types';

// This is a mock data fetching function.
// In a real app, this would fetch data from Firebase based on the sellerId.
async function getSellerData(sellerId: string): Promise<Seller | null> {
  const seller = sellers.find(s => s.id === sellerId);
  return seller || null;
}

async function getSellerProducts(sellerId: string): Promise<Product[]> {
  return products.filter(p => p.sellerId === sellerId);
}

async function getSellerReviews(sellerId: string): Promise<Review[]> {
  // Mock: return reviews if seller is the first one
  return sellerId === sellers[0].id ? reviews : [];
}

async function getSellerStoryHighlights(sellerId: string): Promise<StoryHighlight[]> {
  // Mock: return highlights for all sellers for now
  return storyHighlights;
}

export default async function SellerShopPage({ params }: { params: { sellerId: string } }) {
  const seller = await getSellerData(params.sellerId);
  
  if (!seller) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <h1 className="text-2xl font-bold">Seller Not Found</h1>
        </div>
      </MainLayout>
    );
  }

  // Fetch all data in parallel
  const [sellerProducts, sellerReviews, sellerHighlights] = await Promise.all([
    getSellerProducts(params.sellerId),
    getSellerReviews(params.sellerId),
    getSellerStoryHighlights(params.sellerId),
  ]);

  return (
    <MainLayout>
      <div className="bg-background text-foreground">
        <SellerHeader seller={seller} />
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ShopStoryHighlights highlights={sellerHighlights} />
          <SellerTabs seller={seller} products={sellerProducts} reviews={sellerReviews} />
        </div>
      </div>
    </MainLayout>
  );
}
