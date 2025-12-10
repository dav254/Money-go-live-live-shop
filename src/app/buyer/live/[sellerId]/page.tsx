
'use client';

import { BuyerLayout } from "@/components/layout/buyer-layout";
import { LiveProductCard } from "@/components/buyer/LiveProductCard";
import { Button } from "@/components/ui/button";
import { CartDrawer } from "@/components/buyer/CartDrawer";
import { LiveChat } from "@/components/buyer/LiveChat";
import { useState, useMemo, useEffect } from "react";
import type { Product, CartItem, Order, LiveSession } from "@/lib/types";
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, useDoc } from '@/firebase';
import { collection, query, where, doc, setDoc, serverTimestamp, writeBatch, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";
import { FirestorePermissionError } from "@/firebase/errors";
import { Skeleton } from "@/components/ui/skeleton";


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

  // Find the active live session for this seller
  const liveSessionQuery = useMemoFirebase(() => {
    if (!sellerId) return null;
    return query(collection(firestore, 'liveSessions'), where('sellerId', '==', sellerId), where('status', '==', 'live'));
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


  // Cart functionality
  const cartItemsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'userProfiles', user.uid, 'cart');
  }, [user, firestore]);
  
  const { data: cartItems } = useCollection<CartItem>(cartItemsQuery);

  const handleAddToCart = async (product: Product) => {
    if (!user) {
        toast({ title: 'Please log in', description: 'You need to be logged in to add items to your cart.' });
        return;
    }
    const cartItemRef = doc(firestore, 'userProfiles', user.uid, 'cart', product.id);
    const itemData = {
        productId: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        quantity: 1, // For now, we add one by one
        addedAt: serverTimestamp(),
    };

    try {
        await setDoc(cartItemRef, itemData, { merge: true });
        toast({ title: 'Added to cart!', description: `${product.name} has been added.` });
    } catch (e) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: cartItemRef.path,
            operation: 'write',
            requestResourceData: itemData,
        }));
    }
  };

  const handleCheckout = async () => {
    if (!user || !cartItems || cartItems.length === 0) {
      toast({ variant: 'destructive', title: 'Your cart is empty.' });
      return;
    }

    const newOrderRef = doc(collection(firestore, 'orders'));
    const firstItem = cartItems[0]; 

    const newOrderData: Partial<Order> = {
      id: newOrderRef.id,
      buyerId: user.uid,
      sellerId: firstItem.sellerId, 
      orderDate: serverTimestamp(),
      orderStatus: 'pending',
      totalAmount: cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
      shippingAddress: '123 Placeholder, Nairobi', 
      productName: `${firstItem.name}${cartItems.length > 1 ? ` & ${cartItems.length - 1} more items` : ''}`,
      productImage: firstItem.imageUrl,
      quantity: cartItems.reduce((sum, item) => sum + item.quantity, 0),
      productPrice: cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
      shippingCost: 10, 
    };
    
    try {
      await setDoc(newOrderRef, newOrderData);
      toast({ title: 'Order Created!', description: 'Redirecting to checkout...' });

      const batch = writeBatch(firestore);
      cartItems.forEach(item => {
        const cartItemRef = doc(firestore, 'userProfiles', user.uid, 'cart', item.productId);
        batch.delete(cartItemRef);
      });
      await batch.commit();

      router.push(`/checkout/${newOrderRef.id}`);

    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: newOrderRef.path,
        operation: 'create',
        requestResourceData: newOrderData,
      }));
    }
  };


  return (
    <BuyerLayout>
        <div className="flex h-[calc(100vh-8rem)]">
        
        {/* Live Video */}
        <div className="flex-1 bg-black flex items-center justify-center border-r border-neutral-700">
            <p className="text-white">[Live Video Feed]</p>
            {pinnedProduct && (
                 <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm p-2 rounded-lg border border-primary/50">
                    <LiveProductCard product={pinnedProduct} onAddToCart={handleAddToCart} />
                </div>
            )}
        </div>

        {/* Right Panel */}
        <div className="w-1/3 bg-neutral-800 flex flex-col">
            
            {/* Product Shelf */}
            <div className="p-3 border-b border-neutral-700">
                <h3 className="font-bold mb-2">🛍️ Product Shelf</h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {areProductsLoading ? <ProductShelfSkeleton /> : (
                        products && products.length > 0 ? (
                            products.map(p => (
                                <div key={p.id} className="flex flex-col items-center">
                                    <LiveProductCard product={p} onAddToCart={handleAddToCart} />
                                    <Button onClick={() => setPinnedProduct(p)} size="sm" variant="link" className="text-xs h-6">Pin Item</Button>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-neutral-400 p-4 text-center">This seller has no products.</p>
                        )
                    )}
                </div>
            </div>

            {/* Chat */}
            <div className="flex-1">
                 <LiveChat liveSessionId={liveSession?.id || null} />
            </div>

            {/* Cart */}
            <CartDrawer cartItems={cartItems || []} onCheckout={handleCheckout} />
        </div>
    </div>
    </BuyerLayout>
  );
}
