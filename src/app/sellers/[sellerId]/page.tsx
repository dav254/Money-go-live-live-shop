
import { MainLayout } from '@/components/layout/main-layout';
import { SellerHeader } from '@/components/seller/seller-header';
import { SellerTabs } from '@/components/seller/seller-tabs';
import { db } from '@/firebase/server';
import { collection, doc, getDoc, getDocs, query, where, collectionGroup } from 'firebase/firestore';
import type { Seller, Product, Review, SellerShop, UserProfile } from '@/lib/types';
import { sellers, products } from '@/lib/placeholder-data';


async function getSellerData(sellerId: string): Promise<Seller | null> {
  const sellerDocRef = doc(db, 'sellerShops', sellerId);
  const sellerDocSnap = await getDoc(sellerDocRef);

  if (!sellerDocSnap.exists()) {
    const userProfileRef = doc(db, 'userProfiles', sellerId);
    const userProfileSnap = await getDoc(userProfileRef);
    if (!userProfileSnap.exists()) {
        return null;
    }
     const userProfile = userProfileSnap.data() as UserProfile;
     return {
        id: userProfileSnap.id,
        sellerId: userProfileSnap.id,
        name: userProfile.fullName || 'Seller',
        description: userProfile.bio || 'Welcome to my shop!',
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

  const sellerData = sellerDocSnap.data() as SellerShop;
  const userProfileRef = doc(db, 'userProfiles', sellerId);
  const userProfileSnap = await getDoc(userProfileRef);
  const userProfile = userProfileSnap.exists() ? userProfileSnap.data() as UserProfile : {};

  return {
    id: sellerDocSnap.id,
    sellerId: sellerData.sellerId,
    name: sellerData.shopName,
    description: sellerData.description,
    avatar: { id: 'logo', imageUrl: sellerData.logoUrl || `https://picsum.photos/seed/${sellerId}/200`, description: 'Shop Logo', imageHint: 'shop logo' },
    banner: { id: 'banner', imageUrl: sellerData.bannerUrl || `https://picsum.photos/seed/${sellerId}/1200/400`, description: 'Shop Banner', imageHint: 'shop banner' },
    location: sellerData.location || userProfile.location || 'Unknown',
    contactEmail: sellerData.contactEmail,
    contactWhatsapp: sellerData.contactWhatsapp,
    isVerified: true,
    rating: 4.8, // Placeholder
    reviewsCount: sellerData.reviewsCount || 0,
    followers: sellerData.followers || 0,
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
  const reviewsQuery = query(collectionGroup(db, 'reviews'), where('sellerId', '==', sellerId));
  const snapshot = await getDocs(reviewsQuery);
  if (snapshot.empty) {
    return [];
  }
  return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
  } as Review));
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

  const [sellerProducts, sellerReviews] = await Promise.all([
    getSellerProducts(params.sellerId),
    getSellerReviews(params.sellerId),
  ]);

  const totalReviews = sellerReviews.length;
  const averageRating = totalReviews > 0 ? sellerReviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews : 0;
  
  const sellerWithReviewData: Seller = {
      ...seller,
      reviewsCount: totalReviews,
      rating: averageRating,
  }

  return (
    <MainLayout>
      <div className="bg-background text-foreground">
        <SellerHeader seller={sellerWithReviewData} />
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SellerTabs seller={sellerWithReviewData} products={sellerProducts} reviews={sellerReviews} />
        </div>
      </div>
    </MainLayout>
  );
}

    