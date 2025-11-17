
import { MainLayout } from '@/components/layout/main-layout';
import { SellerHeader } from '@/components/seller/seller-header';
import { ShopStoryHighlights } from '@/components/seller/shop-story-highlights';
import { SellerTabs } from '@/components/seller/seller-tabs';
import { db } from '@/firebase/server';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import type { Seller, Product, Review, StoryHighlight } from '@/lib/types';
import { sellers, products, reviews, storyHighlights } from '@/lib/placeholder-data';


async function getSellerData(sellerId: string): Promise<Seller | null> {
  // In a real app, you'd fetch from multiple documents and combine them.
  // For now, we'll use the existing placeholder data structure.
  const sellerDocRef = doc(db, 'sellerShops', sellerId);
  const sellerDocSnap = await getDoc(sellerDocRef);

  if (!sellerDocSnap.exists()) {
    // Fallback to userProfile if sellerShop doesn't exist
    const userProfileRef = doc(db, 'userProfiles', sellerId);
    const userProfileSnap = await getDoc(userProfileRef);
    if (!userProfileSnap.exists()) {
        return null;
    }
     const userProfile = userProfileSnap.data();
     return {
        id: userProfileSnap.id,
        name: userProfile.shopName || userProfile.fullName || 'Seller',
        avatar: { id: 'avatar', imageUrl: userProfile.profilePictureUrl || `https://picsum.photos/seed/${sellerId}/200`, description: 'Seller Avatar', imageHint: 'seller avatar' },
        isVerified: false,
        rating: 0,
        reviewsCount: 0,
        followers: 0,
        location: userProfile.location || 'Unknown',
        joinedDate: userProfile.joinDate,
        bio: userProfile.bio || 'Welcome to my shop!',
        banner: { id: 'banner', imageUrl: `https://picsum.photos/seed/${sellerId}/1200/400`, description: 'Shop Banner', imageHint: 'shop banner' }
    };
  }

  const sellerData = sellerDocSnap.data();

  // Also fetch user profile for additional details
  const userProfileRef = doc(db, 'userProfiles', sellerId);
  const userProfileSnap = await getDoc(userProfileRef);
  const userProfile = userProfileSnap.exists() ? userProfileSnap.data() : {};

  // Combine data from sellerShops and userProfiles
  return {
    id: sellerDocSnap.id,
    sellerId: sellerData.sellerId,
    name: sellerData.shopName,
    description: sellerData.description,
    avatar: { id: 'logo', imageUrl: sellerData.logoUrl || `https://picsum.photos/seed/${sellerId}/200`, description: 'Shop Logo', imageHint: 'shop logo' },
    banner: { id: 'banner', imageUrl: sellerData.bannerUrl || `https://picsum.photos/seed/${sellerId}/1200/400`, description: 'Shop Banner', imageHint: 'shop banner' },
    location: sellerData.location,
    contactEmail: sellerData.contactEmail,
    contactWhatsapp: sellerData.contactWhatsapp,
    isVerified: true, // Assuming verified if they have a shop
    rating: 4.8, // Placeholder
    reviewsCount: 150, // Placeholder
    followers: 2300, // Placeholder
    joinedDate: userProfile.joinDate || new Date().toISOString(),
    bio: sellerData.description || userProfile.bio || 'Welcome to my shop!',
  };
}

async function getSellerProducts(sellerId: string): Promise<Product[]> {
  const productsRef = collection(db, 'products');
  const q = query(productsRef, where('sellerId', '==', sellerId));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    return [];
  }
  
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      price: data.price,
      originalPrice: data.wasPrice,
      image: { 
          id: doc.id, 
          imageUrl: data.imageUrl || `https://picsum.photos/seed/${doc.id}/400/300`, 
          description: data.name, 
          imageHint: 'product' 
      },
      stock: data.stock || 0,
      sellerId: data.sellerId,
    } as Product;
  });
}

async function getSellerReviews(sellerId: string): Promise<Review[]> {
  // Placeholder: Firestore schema doesn't have reviews yet.
  return reviews;
}

async function getSellerStoryHighlights(sellerId: string): Promise<StoryHighlight[]> {
  // Placeholder: Firestore schema doesn't have story highlights yet.
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
