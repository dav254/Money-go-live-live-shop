
'use client';

import { BuyerLayout } from "@/components/layout/buyer-layout";
import { LiveProductCard } from "@/components/buyer/LiveProductCard";
import { Button } from "@/components/ui/button";
import { CartDrawer } from "@/components/buyer/CartDrawer";
import { LiveChat } from "@/components/buyer/LiveChat";
import { useState, useMemo } from "react";
import type { Product, CartItem, Order } from "@/lib/types";
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter } from '@/firebase';
import { collection, query, where, doc, setDoc, serverTimestamp, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { FirestorePermissionError } from "@/firebase/errors";

// --- Mock Data ---
const mockProducts: Product[] = [
    { id: '1', name: 'Classic Handbag', price: 850, imageUrl: 'https://picsum.photos/seed/prod1/200', stock: 10, sellerId: 'seller-1', uploadDate: new Date() },
    { id: '2', name: 'Urban Sneakers', price: 120, imageUrl: 'https://picsum.photos/seed/prod2/200', stock: 5, sellerId: 'seller-1', uploadDate: new Date() },
    { id: '3', name: 'Gold Watch', price: 350, imageUrl: 'https://picsum.photos/seed/prod3/200', stock: 15, sellerId: 'seller-1', uploadDate: new Date() },
    { id: '4', name: 'Sunglasses', price: 75, imageUrl: 'https://picsum.photos/seed/prod4/200', stock: 20, sellerId: 'seller-1', uploadDate: new Date() },
];
// --- End Mock Data ---


export default function SellerRoom() {
  const [pinnedProduct, setPinnedProduct] = useState<Product | null>(mockProducts[0]);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

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
      sellerId: firstItem.sellerId, // This assumes all items are from the same seller
      // In a real app, you'd handle multiple sellers, perhaps by creating multiple orders
      orderDate: serverTimestamp(),
      orderStatus: 'pending',
      totalAmount: cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
      shippingAddress: '123 Placeholder, Nairobi', // Should be fetched from user profile
      productName: `${firstItem.name}${cartItems.length > 1 ? ` & ${cartItems.length - 1} more items` : ''}`,
      productImage: firstItem.imageUrl,
      quantity: cartItems.reduce((sum, item) => sum + item.quantity, 0),
      productPrice: cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
      shippingCost: 10, // Placeholder
    };
    
    try {
      await setDoc(newOrderRef, newOrderData);
      toast({ title: 'Order Created!', description: 'Redirecting to checkout...' });

      // Clear the cart after creating the order
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
                    {mockProducts.map(p => (
                         <div key={p.id} className="flex flex-col items-center">
                            <LiveProductCard product={p} onAddToCart={handleAddToCart} />
                            <Button onClick={() => setPinnedProduct(p)} size="sm" variant="link" className="text-xs h-6">Pin Item</Button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat */}
            <div className="flex-1">
                 <LiveChat liveSessionId="mock-session-id" />
            </div>

            {/* Cart */}
            <CartDrawer cartItems={cartItems || []} onCheckout={handleCheckout} />
        </div>
    </div>
    </BuyerLayout>
  );
}
