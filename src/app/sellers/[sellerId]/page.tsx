
import { MainLayout } from '@/components/layout/main-layout';
import { SellerHeader } from '@/components/seller/seller-header';
import { ProductGrid } from '@/components/seller/product-grid';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/server';
import { getPlaceholderImage } from '@/lib/placeholder-images';

// Import the rich data types we need
import type { Seller, Product } from '@/lib/types';

// Fetches and transforms a single seller document from Firestore
async function getSellerData(sellerId: string): Promise<Seller | null> {
  try {
    const sellerRef = doc(db, 'sellers', sellerId);
    const sellerSnap = await getDoc(sellerRef);

    if (!sellerSnap.exists()) {
      console.log(`No seller found for ID: ${sellerId}`);
      return null;
    }

    const data = sellerSnap.data();

    // Transform the raw Firestore data to match the 'Seller' type
    return {
      id: sellerSnap.id,
      name: data.name || 'Unnamed Seller',
      avatar: { imageUrl: data.avatarUrl || getPlaceholderImage(), imageHint: 'Seller avatar' },
      isVerified: data.isVerified || false,
      rating: data.rating || 0,
      reviewsCount: data.reviewsCount || 0,
      followers: data.followers || 0,
      location: data.location || 'Unknown',
      joinedDate: data.joinedDate?.toDate()?.toLocaleDateString() || new Date().toLocaleDateString(),
      bio: data.bio || 'No biography available.',
      banner: { imageUrl: data.bannerUrl || getPlaceholderImage(), imageHint: 'Seller banner' },
    } as Seller;
  } catch (error) {
    console.error("Error fetching seller data:", error);
    return null;
  }
}

// Fetches and transforms all products for a specific seller
async function getSellerProducts(sellerId: string): Promise<Product[]> {
  try {
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('sellerId', '==', sellerId));
    const querySnapshot = await getDocs(q);
    
    // Transform each product document
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name || 'Unnamed Product',
            price: data.price || 0,
            originalPrice: data.originalPrice,
            image: { imageUrl: data.imageUrl || getPlaceholderImage(), imageHint: `Image of ${data.name}` },
            stock: data.stock !== undefined ? data.stock : 1, // Default to in stock if not specified
            sellerId: data.sellerId,
            description: data.description || '',
            category: data.category || '',
            location: data.location || '',
            deliveryOptions: data.deliveryOptions || '',
        } as Product;
    });
  } catch (error) {
    console.error("Error fetching seller products:", error);
    return [];
  }
}

// The main page component, now using our rich data fetching functions
export default async function SellerShopPage({ params }: { params: { sellerId: string } }) {
  const seller = await getSellerData(params.sellerId);
  
  if (!seller) {
    return (
      <MainLayout>
        <div className="flex h-full min-h-[50vh] items-center justify-center">
          <h1 className="text-2xl font-bold">Seller not found</h1>
        </div>
      </MainLayout>
    );
  }

  const products = await getSellerProducts(params.sellerId);

  return (
    <MainLayout>
      <div className="container mx-auto max-w-7xl py-8">
        {/* The header now receives the full, structured seller data */}
        <SellerHeader seller={seller} />
        <Separator className="my-8" />
        
        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:w-fit">
            <TabsTrigger value="products">All Products</TabsTrigger>
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="about">About Seller</TabsTrigger>
          </TabsList>
          
          <TabsContent value="products" className="mt-6">
            {products.length > 0 ? (
              /* The grid now receives the full, structured product data */
              <ProductGrid products={products} />
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
                <p className="text-muted-foreground">This seller has not listed any products yet.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="videos" className="mt-6">
            <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <p className="text-muted-foreground">No videos uploaded yet.</p>
            </div>
          </TabsContent>

          <TabsContent value="about" className="mt-6 prose max-w-none dark:prose-invert">
             {/* You can add more detailed seller info here from the seller object */}
             <p>{seller.bio}</p>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
