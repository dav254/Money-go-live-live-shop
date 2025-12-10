
'use client';

import { BuyerLayout } from "@/components/layout/buyer-layout";
import { LiveProductCard } from "@/components/buyer/LiveProductCard";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useEffect } from "react";
import type { Product, CartItem, Order, LiveSession, ChatMessage, Chat, UserProfile } from "@/lib/types";
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, useDoc } from '@/firebase';
import { collection, query, where, doc, setDoc, serverTimestamp, writeBatch, getDocs, deleteDoc, updateDoc, addDoc, orderBy, limit } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";
import { FirestorePermissionError } from "@/firebase/errors";
import { Skeleton } from "@/components/ui/skeleton";
import { PrivateChat } from "@/components/messages/private-chat";
import { CartDrawer } from "@/components/buyer/CartDrawer";
import { Card } from "@/components/ui/card";

const ProductShelfSkeleton = () => (
    <div className="flex gap-2 overflow-x-auto pb-2">
        {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-neutral-900 p-2 rounded w-36 flex-shrink-0">
                <Skeleton className="h-20 w-full rounded mb-2" />
                <Skeleton className="h-4 w-3/4 mb-1" />
                <Skeleton className="h-5 w-1/2 mb-2" />
                <Skeleton className="h-7 w-full" />
            </div>
        ))}
    </div>
);


export default function SellerRoom() {
  const params = useParams();
  const sellerId = params.sellerId as string;
  
  const [pinnedProduct, setPinnedProduct] = useState<Product | null>(null);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  // Fetch all products for the current seller
  const productsQuery = useMemoFirebase(() => {
    if (!sellerId) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', sellerId));
  }, [firestore, sellerId]);
  const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

  // Fetch Cart Items
  const cartItemsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'userProfiles', user.uid, 'cart');
  }, [user, firestore]);
  const { data: cartItems } = useCollection<CartItem>(cartItemsQuery);

  // Find the active live session for this seller
  const liveSessionQuery = useMemoFirebase(() => {
    if (!sellerId) return null;
    return query(collection(firestore, 'liveSessions'), where('sellerId', '==', sellerId), where('status', '==', 'live'), limit(1));
  }, [firestore, sellerId]);

  const { data: liveSessions, isLoading: isLiveSessionLoading } = useCollection<LiveSession>(liveSessionQuery);
  const liveSession = liveSessions?.[0]; // Get the first (and likely only) live session
  
  // Effect to update the pinned product when the live session data changes
  useEffect(() => {
      if (liveSession && liveSession.pinnedProductId && products) {
          const product = products.find(p => p.id === liveSession.pinnedProductId);
          setPinnedProduct(product || null);
      } else {
          setPinnedProduct(null);
      }
  }, [liveSession, products]);
  
  const handleCheckout = async () => {
    if (!user || !firestore || !cartItems || cartItems.length === 0) {
      toast({ variant: 'destructive', title: 'Your cart is empty.' });
      return;
    }
    
    // Simplified checkout: creating one order for the first item in the cart
    const firstItem = cartItems[0];
    const newOrderRef = doc(collection(firestore, 'orders'));
    
    const newOrderData: Partial<Order> = {
      id: newOrderRef.id,
      buyerId: user.uid,
      sellerId: firstItem.sellerId,
      productId: firstItem.productId,
      productName: firstItem.name,
      productImage: firstItem.imageUrl,
      productPrice: firstItem.price,
      shippingCost: 0, // Placeholder
      totalAmount: firstItem.price * firstItem.quantity,
      orderDate: serverTimestamp() as any,
      shippingAddress: '123 Placeholder Lane, Nairobi', // Placeholder
      orderStatus: 'pending',
      paymentMethod: 'pending',
      quantity: firstItem.quantity,
    };

    try {
      await setDoc(newOrderRef, newOrderData);
      
      // Clear cart after creating order
      const batch = writeBatch(firestore);
      cartItems.forEach(item => {
        const itemRef = doc(firestore, 'userProfiles', user.uid, 'cart', item.productId);
        batch.delete(itemRef);
      });
      await batch.commit();

      toast({ title: 'Order Created!', description: 'Redirecting to checkout...' });
      router.push(`/checkout/${newOrderRef.id}`);
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: newOrderRef.path,
        operation: 'create',
        requestResourceData: newOrderData,
      }));
    }
  };


  return (
    <BuyerLayout>
      <div className="grid grid-cols-1 md:grid-cols-3 h-[calc(100vh-8rem)]">
        
        {/* Main Content: Video and Products */}
        <div className="md:col-span-2 flex flex-col h-full bg-black">
          {/* Live Video */}
          <div className="flex-1 relative bg-black flex items-center justify-center border-r border-neutral-700">
              <p className="text-white">[Live Video Feed]</p>
              {pinnedProduct && (
                  <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm p-2 rounded-lg border border-primary/50">
                      <LiveProductCard product={pinnedProduct} />
                  </div>
              )}
          </div>
          
          <div className="flex-shrink-0">
             {/* Product Shelf */}
            <Card className="rounded-none border-x-0 border-b-0 border-t border-neutral-700">
                <div className="p-3">
                    <h3 className="font-bold mb-2">🛍️ Product Shelf</h3>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {areProductsLoading ? <ProductShelfSkeleton /> : (
                            products && products.length > 0 ? (
                                products.map(p => (
                                    <div key={p.id} className="flex flex-col items-center">
                                        <LiveProductCard product={p} />
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-neutral-400 p-4 text-center">This seller has no products.</p>
                            )
                        )}
                    </div>
                </div>
            </Card>

            {/* Shopping Cart */}
            <CartDrawer cartItems={cartItems || []} onCheckout={handleCheckout} />
          </div>
        </div>

        {/* Right Panel: Chat */}
        <div className="h-full bg-neutral-800 flex flex-col">
          <div className="flex-1 min-h-0">
              <PrivateChat sellerId={sellerId} sellerName="Seller" />
          </div>
        </div>
    </div>
    </BuyerLayout>
  );
}
