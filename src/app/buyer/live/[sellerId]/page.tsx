
'use client';

import { BuyerLayout } from "@/components/layout/buyer-layout";
import { LiveChat } from "@/components/buyer/LiveChat";
import { LiveProductCard } from "@/components/buyer/LiveProductCard";
import { CartDrawer } from "@/components/buyer/CartDrawer";
import { PaymentModal } from "@/components/buyer/PaymentModal";
import { Button } from "@/components/ui/button";
import { useState } from "react";

// Mock data
const seller = { name: "David Shoe Store" };
const products = [
    { id: 1, name: "Urban Sneakers", price: 25, image: "https://picsum.photos/seed/sneaker/150" },
    { id: 2, name: "Leather Boots", price: 60, image: "https://picsum.photos/seed/boots/150" },
    { id: 3, name: "Running Shoes", price: 45, image: "https://picsum.photos/seed/run/150" },
];

export default function SellerRoom() {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);

  const addToCart = (product) => {
    setCartItems(prev => [...prev, product]);
  };

  return (
    <BuyerLayout>
        <div className="flex flex-col h-[calc(100vh-8rem)] bg-black text-white">

        {/* LIVE VIDEO AREA */}
        <div className="h-1/2 bg-neutral-900 flex items-center justify-center border-b border-neutral-800">
            <p className="text-neutral-400">🔴 Live Stream Video Placeholder</p>
        </div>

        {/* SELLER INFO */}
        <div className="p-2 flex justify-between items-center bg-neutral-800 border-b border-neutral-700">
            <div>
            <h2 className="font-bold">{seller.name}</h2>
            <p className="text-sm text-red-500">LIVE NOW</p>
            </div>
            <Button size="sm" className="bg-red-600 hover:bg-red-700">Follow</Button>
        </div>

        {/* PRODUCTS */}
        <div className="flex overflow-x-auto gap-2 p-2 bg-black border-b border-neutral-800">
            {products.map(product => (
                <LiveProductCard key={product.id} product={product} onAddToCart={addToCart} />
            ))}
        </div>

        {/* CHAT + CART */}
        <div className="flex flex-1 overflow-hidden">
            <LiveChat />
            <CartDrawer cartItems={cartItems} onCheckout={() => setIsPaymentModalOpen(true)} />
        </div>

        {/* PAYMENT (hidden popup) */}
        <PaymentModal isOpen={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen} />
        </div>
    </BuyerLayout>
  );
}
