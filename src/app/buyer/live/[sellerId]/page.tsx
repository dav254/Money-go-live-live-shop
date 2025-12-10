
'use client';

import { BuyerLayout } from "@/components/layout/buyer-layout";
import { LiveProductCard } from "@/components/buyer/LiveProductCard";
import { Button } from "@/components/ui/button";
import { CartDrawer } from "@/components/buyer/CartDrawer";
import { LiveChat } from "@/components/buyer/LiveChat";
import { useState } from "react";
import type { Product } from "@/lib/types";

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
  const [cartItems, setCartItems] = useState<Product[]>([]);

  const handleAddToCart = (product: Product) => {
    setCartItems(prevItems => [...prevItems, product]);
  };

  const handleCheckout = () => {
    alert(`Checking out with ${cartItems.length} items. Total: $${cartItems.reduce((sum, item) => sum + item.price, 0).toFixed(2)}`);
    setCartItems([]);
  }

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
            <CartDrawer cartItems={cartItems} onCheckout={handleCheckout} />
        </div>
    </div>
    </BuyerLayout>
  );
}

