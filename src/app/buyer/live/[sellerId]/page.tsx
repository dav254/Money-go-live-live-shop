
'use client';

import { BuyerLayout } from "@/components/layout/buyer-layout";
import { LiveChat } from "@/components/buyer/LiveChat";
import { LiveProductCard } from "@/components/buyer/LiveProductCard";
import { CartDrawer } from "@/components/buyer/CartDrawer";
import { PaymentModal } from "@/components/buyer/PaymentModal";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useEffect, useRef } from "react";
import type { Product, ChatMessage } from "@/lib/types";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { products } from "@/lib/placeholder-data";
import Image from "next/image";

// Mock data for demonstration
const mockSeller = {
  name: 'Live Seller Demo',
};

const mockFeaturedProducts = products.slice(0, 4);

export default function SellerRoom() {
  const params = useParams();
  const sellerId = params.sellerId as string;
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [cartItems, setCartItems] = useState<Product[]>([]);

  const isLoading = false; // No longer loading from backend

  const addToCart = (product: Product) => {
    setCartItems(prev => [...prev, product]);
  };

  const sellerName = mockSeller.name;

  if (isLoading) {
      return (
          <BuyerLayout>
               <div className="flex flex-col h-[calc(100vh-8rem)] bg-black text-white">
                    <Skeleton className="h-1/2 w-full" />
                    <Skeleton className="h-14 w-full" />
                    <div className="flex p-2 gap-2">
                        <Skeleton className="h-32 w-36" />
                        <Skeleton className="h-32 w-36" />
                        <Skeleton className="h-32 w-36" />
                    </div>
                     <div className="flex flex-1 overflow-hidden">
                        <Skeleton className="w-2/3" />
                        <Skeleton className="w-1/3" />
                    </div>
               </div>
          </BuyerLayout>
      )
  }

  return (
    <BuyerLayout>
        <div className="flex flex-col h-[calc(100vh-8rem)] bg-black text-white">

        {/* LIVE VIDEO AREA - Now a placeholder image */}
        <div className="relative h-1/2 bg-neutral-900 flex items-center justify-center border-b border-neutral-800">
             <Image
                src="https://picsum.photos/seed/live-stream/1280/720"
                alt="Live stream placeholder"
                fill
                className="object-cover"
                data-ai-hint="live stream"
             />
             <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* SELLER INFO */}
        <div className="p-2 flex justify-between items-center bg-neutral-800 border-b border-neutral-700">
            <div>
            <h2 className="font-bold">{sellerName}</h2>
            <p className="text-sm text-red-500">LIVE NOW</p>
            </div>
            <Button size="sm" className="bg-red-600 hover:bg-red-700">Follow</Button>
        </div>

        {/* PRODUCTS */}
        <div className="flex overflow-x-auto gap-2 p-2 bg-black border-b border-neutral-800">
            {mockFeaturedProducts.map(product => (
                <LiveProductCard key={product.id} product={product} onAddToCart={addToCart} />
            ))}
        </div>

        {/* CHAT + CART */}
        <div className="flex flex-1 overflow-hidden">
            <LiveChat liveSessionId={'mock-session-id'} />
            <CartDrawer cartItems={cartItems} onCheckout={() => setIsPaymentModalOpen(true)} />
        </div>

        {/* PAYMENT (hidden popup) */}
        <PaymentModal isOpen={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen} />
        </div>
    </BuyerLayout>
  );
}
