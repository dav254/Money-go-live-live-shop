
import { MainLayout } from '@/components/layout/main-layout';
import { SellerHeader } from '@/components/seller/seller-header';
import { ShopStoryHighlights } from '@/components/seller/shop-story-highlights';
import { SellerTabs } from '@/components/seller/seller-tabs';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/server';
import type { Seller, Product, Review, StoryHighlight } from '@/lib/types';

async function getSellerData(sellerId: string): Promise<Seller | null> {
  try {
    const sellerRef = doc(db, 'sellers', sellerId);
    const sellerSnap = await getDoc(sellerRef);

    if (!sellerSnap.exists()) {
      return null;
    }

    const data = sellerSnap.data();

    return {
      id: sellerSnap.id,
      name: data.name || 'Unnamed Seller',
      avatar: { imageUrl: data.avatarUrl || '/placeholder.svg' },
      banner: { imageUrl: data.bannerUrl || '/placeholder.svg' },
      isVerified: data.isVerified || false,
      rating: data.rating || 0,
      reviewsCount: data.reviewsCount || 0,
      followers: data.followers || 0,
      location: data.location || 'Unknown',
      joinedDate: data.joinedDate?.toDate()?.toISOString() || new Date().toISOString(),
      bio: data.bio || 'Welcome to my shop! I am committed to providing the best products and service.',
      returnPolicy: data.returnPolicy || '30-day return window. Buyer pays for return shipping.',
      deliveryPolicy: data.deliveryPolicy || 'Ships within 2 business days. Standard and express options available.',
      storeHours: data.storeHours || '9 AM - 6 PM, Monday to Friday.',
      deliversFast: data.deliversFast ?? true,
    } as Seller;
  } catch (error) {
    console.error(`Error fetching seller ${sellerId}:`, error);
    return null;
  }
}

async function getSellerProducts(sellerId: string): Promise<Product[]> {
  try {
    const q = query(collection(db, 'products'), where('sellerId', '==', sellerId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name || 'Product Name',
            price: data.price || 0,
            originalPrice: data.originalPrice || null,
            image: { imageUrl: data.image?.imageUrl || '/placeholder.svg' },
            stock: data.stock ?? 1,
        } as Product;
    });
  } catch (error) {
     console.error(`Error fetching products for seller ${sellerId}:`, error);
     return [];
  }
}

async function getSellerReviews(sellerId: string): Promise<Review[]> {
  console.log(`Fetching reviews for ${sellerId}`);
  return [];
}

async function getSellerStoryHighlights(sellerId: string): Promise<StoryHighlight[]> {
    console.log(`Fetching highlights for ${sellerId}`);
    return [
        { id: '1', title: 'New Drops', imageUrl: '/placeholder.svg' },
        { id: '2', title: 'On Sale', imageUrl: '/placeholder.svg' },
        { id: '3', title: 'Best Sellers', imageUrl: '/placeholder.svg' },
        { id: '4', title: 'Flash Deals', imageUrl: '/placeholder.svg' },
        { id: '5', title: 'Re-stocked', imageUrl: '/placeholder.svg' },
    ];
}

export default async function SellerShopPage({ params }: { params: { sellerId: string } }) {
  const resolvedParams = await params;
  const { sellerId } = resolvedParams;
  const seller = await getSellerData(sellerId);
  
  if (!seller) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <h1 className="text-2xl font-bold">Seller Not Found</h1>
        </div>
      </MainLayout>
    );
  }

  const [products, reviews, highlights] = await Promise.all([
    getSellerProducts(sellerId),
    getSellerReviews(sellerId),
    getSellerStoryHighlights(sellerId),
  ]);

  return (
    <MainLayout>
      <div className="bg-neutral-950 text-white">
        <SellerHeader seller={seller} />
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ShopStoryHighlights highlights={highlights} />
          <SellerTabs seller={seller} products={products} reviews={reviews} />
        </div>
      </div>
    </MainLayout>
  );
}
