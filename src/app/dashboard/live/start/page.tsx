
import { SellerLayout } from '@/components/layout/seller-layout';
import { LivePreview } from '@/components/live/live-preview';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/server'; // Using server-side firebase
import { getPlaceholderImage } from '@/lib/placeholder-images';
import type { Seller, Product } from '@/lib/types';

// --- Data Fetching Functions ---
// NOTE: In a real app, you would get the sellerId from the authenticated user session.
// For now, we will use a hardcoded ID for demonstration.
const HARDCODED_SELLER_ID = 'CKmHD5jv0dOevUJhJ8tM7akpSlF2';

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
      name: data.name || 'Demo Seller',
      avatar: { imageUrl: data.avatarUrl || getPlaceholderImage(), imageHint: 'Seller avatar' },
      isVerified: data.isVerified || false,
      rating: data.rating || 5,
      reviewsCount: data.reviewsCount || 100,
      followers: data.followers || 1500,
      location: data.location || 'Online',
      joinedDate: new Date().toISOString(),
      bio: data.bio || '',
      banner: { imageUrl: data.bannerUrl || getPlaceholderImage(), imageHint: 'Seller banner' },
    } as Seller;
  } catch (error) {
    console.error("Error fetching seller for live preview:", error);
    return null;
  }
}

async function getSellerProducts(sellerId: string): Promise<Product[]> {
  try {
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('sellerId', '==', sellerId));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name || 'Product Name',
            price: data.price || 0,
            originalPrice: data.originalPrice,
            image: { imageUrl: data.imageUrl || getPlaceholderImage(), imageHint: `Image of ${data.name}` },
            stock: data.stock !== undefined ? data.stock : 1,
            sellerId: data.sellerId,
            description: data.description || '',
            category: data.category || '',
            location: data.location || '',
            deliveryOptions: data.deliveryOptions || '',
            imageUrl: data.imageUrl || '', // Keep the top-level imageUrl for compatibility
        } as Product;
    });
  } catch (error) {
    console.error("Error fetching seller products for live preview:", error);
    return [];
  }
}

// --- The Page Component ---
export default async function GoLivePage() {
  // Fetch the seller and their products
  const seller = await getSellerData(HARDCODED_SELLER_ID);
  const products = await getSellerProducts(HARDCODED_SELLER_ID);

  if (!seller) {
    return (
      <SellerLayout>
        <div className="flex h-full items-center justify-center">
          <p>Could not load seller data. Please make sure you are logged in.</p>
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
