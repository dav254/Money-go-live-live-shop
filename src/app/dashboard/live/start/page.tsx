
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { LivePreview } from '@/components/live/live-preview';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { Seller, Product } from '@/lib/types';
import { useEffect, useState } from 'react';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { doc, getDoc } from 'firebase/firestore';


// --- The Page Component ---
export default function GoLivePage() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isUserLoading || !user) {
      if (!isUserLoading) {
        setIsLoading(false);
      }
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch seller data from userProfiles collection
        const userProfileRef = doc(firestore, 'userProfiles', user.uid);
        const userProfileSnap = await getDoc(userProfileRef);

        if (userProfileSnap.exists() && userProfileSnap.data().userRole === 'seller') {
          const profileData = userProfileSnap.data();
          
          // Attempt to fetch more detailed seller data if it exists in a 'sellers' collection
          let sellerData = null;
          const sellerRef = doc(firestore, 'sellers', user.uid);
          const sellerSnap = await getDoc(sellerRef);
          if (sellerSnap.exists()) {
             sellerData = sellerSnap.data();
          }

          setSeller({
            id: user.uid,
            name: sellerData?.name || profileData.fullName || 'Seller Store',
            avatar: { imageUrl: sellerData?.avatarUrl || user.photoURL || getPlaceholderImage(), imageHint: 'seller avatar', id: 'avatar', description: 'seller avatar' },
            isVerified: sellerData?.isVerified || false,
            rating: sellerData?.rating || 0,
            reviewsCount: sellerData?.reviewsCount || 0,
            followers: sellerData?.followers || 0,
            location: sellerData?.location || 'Online',
            joinedDate: profileData.joinDate,
            bio: sellerData?.bio || '',
            banner: { imageUrl: sellerData?.bannerUrl || getPlaceholderImage(), imageHint: 'store banner', id: 'banner', description: 'store banner' },
          });

          // Fetch seller products
          const productsRef = collection(firestore, 'products');
          const q = query(productsRef, where('sellerId', '==', user.uid));
          const querySnapshot = await getDocs(q);
          
          const fetchedProducts = querySnapshot.docs.map(doc => {
              const data = doc.data();
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
                  imageUrl: data.imageUrl, // Directly use the URL
                  videoUrl: data.videoUrl, // Directly use the URL
              } as Product;
          });
          setProducts(fetchedProducts);

        }
      } catch (error) {
        console.error("Error fetching seller data for live preview:", error);
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
            <h2 className="text-xl font-bold">Could not load seller data.</h2>
            <p className="text-muted-foreground">Please make sure your profile is set as a 'seller'.</p>
          </div>
        </div>
      </SellerLayout>
    );
  }

  return (
    // We use a simplified layout for the fullscreen live experience
    <div className="h-screen w-screen bg-black">
       <LivePreview seller={seller} products={products} />
    </div>
  );
}
