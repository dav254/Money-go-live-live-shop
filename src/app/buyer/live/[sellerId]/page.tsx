
'use client';

import { BuyerLayout } from "@/components/layout/buyer-layout";
import { LiveChat } from "@/components/buyer/LiveChat";
import { LiveProductCard } from "@/components/buyer/LiveProductCard";
import { CartDrawer } from "@/components/buyer/CartDrawer";
import { PaymentModal } from "@/components/buyer/PaymentModal";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { useCollection, useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
import type { LiveSession, Product, SellerShop, UserProfile } from "@/lib/types";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

export default function SellerRoom() {
  const params = useParams();
  const sellerId = params.sellerId as string;
  const firestore = useFirestore();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [cartItems, setCartItems] = useState<Product[]>([]);

  // Fetch the active live session for this seller
  const liveSessionQuery = useMemoFirebase(() => {
    if (!sellerId) return null;
    return query(
      collection(firestore, 'liveSessions'),
      where('sellerId', '==', sellerId),
      where('status', '==', 'live'),
      where('endTime', '==', null)
    );
  }, [firestore, sellerId]);

  const { data: liveSessions, isLoading: isSessionLoading } = useCollection<LiveSession>(liveSessionQuery);
  const liveSession = useMemo(() => (liveSessions && liveSessions.length > 0 ? liveSessions[0] : null), [liveSessions]);

  // Fetch the seller's shop and profile data
  const sellerShopRef = useMemoFirebase(() => doc(firestore, 'sellerShops', sellerId), [firestore, sellerId]);
  const sellerProfileRef = useMemoFirebase(() => doc(firestore, 'userProfiles', sellerId), [firestore, sellerId]);
  
  const { data: sellerShop, isLoading: isShopLoading } = useDoc<SellerShop>(sellerShopRef);
  const { data: sellerProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(sellerProfileRef);

  // Fetch the products featured in the live session
  const featuredProductsQuery = useMemoFirebase(() => {
    if (!liveSession || liveSession.productIds.length === 0) return null;
    return query(collection(firestore, 'products'), where('id', 'in', liveSession.productIds));
  }, [firestore, liveSession]);

  const { data: featuredProducts, isLoading: areProductsLoading } = useCollection<Product>(featuredProductsQuery);

  const isLoading = isSessionLoading || isShopLoading || isProfileLoading || areProductsLoading;

  const addToCart = (product: Product) => {
    setCartItems(prev => [...prev, product]);
  };

  const sellerName = sellerShop?.shopName || sellerProfile?.fullName || 'Seller';

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

  if (!liveSession) {
      return (
           <BuyerLayout>
                <div className="flex flex-col h-[calc(100vh-8rem)] bg-black text-white items-center justify-center">
                    <p className="text-neutral-400">This seller is not currently live.</p>
                </div>
            </BuyerLayout>
      )
  }


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
            <h2 className="font-bold">{sellerName}</h2>
            <p className="text-sm text-red-500">LIVE NOW</p>
            </div>
            <Button size="sm" className="bg-red-600 hover:bg-red-700">Follow</Button>
        </div>

        {/* PRODUCTS */}
        <div className="flex overflow-x-auto gap-2 p-2 bg-black border-b border-neutral-800">
            {featuredProducts && featuredProducts.map(product => (
                <LiveProductCard key={product.id} product={product} onAddToCart={addToCart} />
            ))}
        </div>

        {/* CHAT + CART */}
        <div className="flex flex-1 overflow-hidden">
            <LiveChat liveSessionId={liveSession.id} />
            <CartDrawer cartItems={cartItems} onCheckout={() => setIsPaymentModalOpen(true)} />
        </div>

        {/* PAYMENT (hidden popup) */}
        <PaymentModal isOpen={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen} />
        </div>
    </BuyerLayout>
  );
}

