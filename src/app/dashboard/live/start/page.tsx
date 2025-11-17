
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { LivePreview } from '@/components/live/live-preview';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { Seller, Product } from '@/lib/types';
import { useEffect, useState } from 'react';
import { getPlaceholderImage } from '@/lib/placeholder-images';

// --- The Page Component ---
export default function GoLivePage() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isUserLoading || !user || !firestore) {
      if (!isUserLoading) {
        setIsLoading(false);
      }
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch seller data from multiple sources
        const userProfileRef = doc(firestore, 'userProfiles', user.uid);
        const userProfileSnap = await getDoc(userProfileRef);
        const profileData = userProfileSnap.exists() ? userProfileSnap.data() : {};

        if (profileData.userRole !== 'seller') {
            setIsLoading(false);
            return;
        }

        const sellerRef = doc(firestore, 'sellers', user.uid);
        const sellerSnap = await getDoc(sellerRef);
        const sellerData = sellerSnap.exists() ? sellerSnap.data() : {};

        // Safely construct the seller object with fallbacks for every property
        const constructedSeller: Seller = {
            id: user.uid,
            name: sellerData?.name || profileData?.fullName || 'Seller Store',
            isVerified: sellerData?.isVerified || false,
            rating: sellerData?.rating || 0,
            reviewsCount: sellerData?.reviewsCount || 0,
            followers: sellerData?.followers || 0,
            location: sellerData?.location || 'Online',
            bio: sellerData?.bio || 'Welcome to the live show!',
            joinedDate: profileData?.joinDate || new Date(),
            avatar: {
                id: 'avatar',
                imageHint: 'seller avatar',
                description: 'seller avatar',
                imageUrl: sellerData?.avatarUrl || user.photoURL || getPlaceholderImage(),
            },
            banner: {
                id: 'banner',
                imageHint: 'store banner',
                description: 'store banner',
                imageUrl: sellerData?.bannerUrl || getPlaceholderImage(),
            },
        };
        setSeller(constructedSeller);

        // Fetch seller products
        const productsRef = collection(firestore, 'products');
        const q = query(productsRef, where('sellerId', '==', user.uid));
        const querySnapshot = await getDocs(q);

        const fetchedProducts = querySnapshot.docs.map(doc => {
          const data = doc.data();
          const imageUrls = Array.isArray(data.imageUrls) ? data.imageUrls : (data.imageUrl ? [data.imageUrl] : []);
          const videoUrls = Array.isArray(data.videoUrls) ? data.videoUrls : (data.videoUrl ? [data.videoUrl] : []);

          return {
            id: doc.id,
            name: data.productName,
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

      } catch (error) {
        console.error("[Studio Debug] Error fetching seller data for live preview:", error);
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

  if (!user || !seller) {
    return (
      <SellerLayout>
        <div className="flex h-full items-center justify-center text-center p-4">
          <div>
            <h2 className="text-xl font-bold">Could not load your seller profile.</h2>
            <p className="text-muted-foreground">Please make sure your account is configured as a 'seller'.</p>
          </div>
        </div>
      </SellerLayout>
    );
  }

  return (
    <div className="h-screen w-screen bg-black">
       <LivePreview seller={seller} products={products} />
    </div>
  );
}
