'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { LivePreview } from '@/components/live/live-preview';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { Seller, Product } from '@/lib/types';
import { useEffect, useState } from 'react';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// --- The Page Component ---
export default function GoLivePage() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isUserLoading || !user || !firestore) {
      if (!isUserLoading) {
        setIsLoading(false);
      }
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 1. Fetch UserProfile to check role
        const userProfileRef = doc(firestore, 'userProfiles', user.uid);
        const userProfileSnap = await getDoc(userProfileRef);
        
        if (!userProfileSnap.exists() || userProfileSnap.data()?.userRole !== 'seller') {
          setError("Your account is not configured as a 'seller'. Please update your profile or contact support.");
          setIsLoading(false);
          return;
        }
        const profileData = userProfileSnap.data();

        // 2. Fetch SellerShop for shop-specific details
        const sellerShopRef = doc(firestore, 'sellerShops', user.uid);
        const sellerShopSnap = await getDoc(sellerShopRef);
        const sellerShopData = sellerShopSnap.exists() ? sellerShopSnap.data() : {};

        // 3. Construct the complete Seller object
        const constructedSeller: Seller = {
            id: user.uid,
            sellerId: sellerShopData.sellerId || user.uid,
            name: sellerShopData.shopName || profileData.fullName || 'Seller Store',
            description: sellerShopData.description || profileData.bio || 'Welcome to my shop!',
            isVerified: true, // Assuming if they have a sellerShop, they are verified
            rating: 4.8, // Placeholder - adjust as needed
            reviewsCount: 150, // Placeholder
            followers: 2300, // Placeholder
            location: sellerShopData.location || profileData.location || 'Online',
            joinedDate: profileData.joinDate || new Date().toISOString(),
            bio: sellerShopData.description || profileData.bio || 'Welcome to the live show!',
            avatar: {
                id: 'avatar',
                imageHint: 'seller avatar',
                description: 'seller avatar',
                imageUrl: sellerShopData.logoUrl || profileData.profilePictureUrl || getPlaceholderImage(),
            },
            banner: {
                id: 'banner',
                imageHint: 'store banner',
                description: 'store banner',
                imageUrl: sellerShopData.bannerUrl || getPlaceholderImage(),
            },
        };
        setSeller(constructedSeller);

        // 4. Fetch seller's products
        const productsRef = collection(firestore, 'products');
        const q = query(productsRef, where('sellerId', '==', user.uid));
        const querySnapshot = await getDocs(q);

        const fetchedProducts = querySnapshot.docs.map(doc => {
          const data = doc.data();
          const imageUrls = Array.isArray(data.imageUrls) ? data.imageUrls : (data.imageUrl ? [data.imageUrl] : []);
          const videoUrls = Array.isArray(data.videoUrls) ? data.videoUrls : (data.videoUrl ? [data.videoUrl] : []);

          return {
            id: doc.id,
            name: data.name,
            price: data.price,
            originalPrice: data.wasPrice,
            stock: data.stock !== undefined ? data.stock : 1,
            sellerId: data.sellerId,
            description: data.description,
            category: data.category,
            location: data.location,
            deliveryOptions: data.deliveryOptions,
            imageUrls: imageUrls,
            videoUrls: videoUrls,
            image: { imageUrl: imageUrls[0] || getPlaceholderImage(), imageHint: 'product image', id: doc.id, description: 'product image' },
          } as Product;
        });
        
        setProducts(fetchedProducts);

      } catch (err) {
        console.error("[Studio Debug] Error fetching seller data for live preview:", err);
        setError('An unexpected error occurred while fetching your data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, firestore, isUserLoading]);

  if (isLoading || isUserLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <p className="text-white">Loading your studio...</p>
      </div>
    );
  }
  
  if (error || !seller) {
    return (
      <SellerLayout>
        <div className="flex h-full flex-col items-center justify-center p-4 text-center">
            <h2 className="text-xl font-bold">Could not load your seller profile.</h2>
            <p className="max-w-md text-muted-foreground">{error || "Please make sure your account is configured as a 'seller'."}</p>
        </div>
      </SellerLayout>
    );
  }


  return (
     <div className="relative h-[calc(100vh-4rem)] w-full bg-background flex flex-col items-center justify-center p-4">
        <div className="absolute top-4 right-4 z-20">
            <Button asChild>
                <Link href={`/sellers/${user?.uid}`}>
                    View My Shop
                </Link>
            </Button>
        </div>
        <div className="w-full max-w-lg aspect-[9/16] border-4 border-muted rounded-2xl overflow-hidden relative shadow-2xl">
            <LivePreview seller={seller} products={products} />
        </div>
     </div>
  );
}
