
import { MainLayout } from '@/components/layout/main-layout';
import { SellerHeader } from '@/components/seller/shop-header';
import { SellerTabs } from '@/components/seller/seller-tabs';
import { initializeAdminApp } from '@/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';
import type { Seller, Product, SellerShop, UserProfile } from '@/lib/types';


async function getSellerData(sellerId: string): Promise<Seller | null> {
  const adminApp = initializeAdminApp();
  const db = getFirestore(adminApp);
  const sellerDocRef = db.collection('sellerShops').doc(sellerId);
  const sellerDocSnap = await sellerDocRef.get();

  if (!sellerDocSnap.exists) {
    const userProfileRef = db.collection('userProfiles').doc(sellerId);
    const userProfileSnap = await userProfileRef.get();
    if (!userProfileSnap.exists) {
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
  const userProfileRef = db.collection('userProfiles').doc(sellerId);
  const userProfileSnap = await userProfileRef.get();
  const userProfile = userProfileSnap.exists ? userProfileSnap.data() as UserProfile : {};

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
    bio: sellerData.description || userProfile.bio || 'Welcome!',
  };
}

async function getSellerProducts(sellerId: string): Promise<Product[]> {
  const adminApp = initializeAdminApp();
  const db = getFirestore(adminApp);
  const productsRef = db.collection('products');
  const q = productsRef.where('sellerId', '==', sellerId);
  const querySnapshot = await q.get();
  
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
      imageUrl: data.imageUrl,
      videoUrl: data.videoUrl,
      stock: data.stock || 0,
      sellerId: data.sellerId,
    } as Product;
  });
}

export default async function SellerShopPage({ params }: { params: { sellerId: string } }) {
  const sellerId = params.sellerId;
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

  const sellerProducts = await getSellerProducts(sellerId);

  return (
    <MainLayout>
      <div className="bg-background text-foreground">
        <SellerHeader seller={seller} />
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SellerTabs seller={seller} products={sellerProducts} />
        </div>
      </div>
    </MainLayout>
  );
}
