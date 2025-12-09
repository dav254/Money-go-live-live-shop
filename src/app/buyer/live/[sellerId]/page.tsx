
'use client';

import { BuyerLayout } from "@/components/layout/buyer-layout";
import { LiveChat } from "@/components/buyer/LiveChat";
import { LiveProductCard } from "@/components/buyer/LiveProductCard";
import { CartDrawer } from "@/components/buyer/CartDrawer";
import { PaymentModal } from "@/components/buyer/PaymentModal";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useEffect, useRef } from "react";
import type { Product, ChatMessage, LiveSession } from "@/lib/types";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Image from "next/image";
import { Video } from 'lucide-react';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';

interface Heart {
  id: number;
  x: number;
  y: number;
}

interface Banner {
  id: number;
  text: string;
  type: 'deal' | 'giveaway';
}


export default function SellerRoom() {
  const params = useParams();
  const sellerId = params.sellerId as string;
  const firestore = useFirestore();
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [cartItems, setCartItems] = useState<Product[]>([]);
  const [hearts, setHearts] = useState<Heart[]>([]);
  const heartsRef = useRef<Heart[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);

  const liveSessionQuery = useMemoFirebase(() => {
    if (!firestore || !sellerId) return null;
    return query(collection(firestore, 'liveSessions'), where('sellerId', '==', sellerId), where('status', '==', 'live'));
  }, [firestore, sellerId]);

  // For this simplified version, we assume a seller has only one live session at a time.
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!liveSessionQuery) return;
    const unsub = onSnapshot(liveSessionQuery, (snapshot) => {
      if (!snapshot.empty) {
        const sessionData = snapshot.docs[0].data() as LiveSession;
        setLiveSession({ id: snapshot.docs[0].id, ...sessionData });
      } else {
        setLiveSession(null);
      }
      setIsLoading(false);
    });
    return () => unsub();
  }, [liveSessionQuery]);
  

  const pinnedProductRef = useMemoFirebase(() => {
    if (!firestore || !liveSession?.pinnedProductId) return null;
    return doc(firestore, 'products', liveSession.pinnedProductId);
  }, [firestore, liveSession?.pinnedProductId]);

  const { data: pinnedProduct } = useDoc<Product>(pinnedProductRef);

  const addToCart = (product: Product) => {
    setCartItems(prev => [...prev, product]);
  };
  
  const spawnHeart = () => {
    const x = Math.random() * window.innerWidth * 0.8 + window.innerWidth * 0.1;
    const y = window.innerHeight * 0.8;
    const id = Date.now();
    const heart = { id, x, y };
    heartsRef.current = [...heartsRef.current, heart];
    setHearts(heartsRef.current);

    setTimeout(() => {
      heartsRef.current = heartsRef.current.filter(h => h.id !== id);
      setHearts(heartsRef.current);
    }, 2000);
  };
  
  const showBanner = (text: string, type: 'deal' | 'giveaway') => {
      const id = Date.now();
      setBanner({ id, text, type });
      setTimeout(() => {
          setBanner(prev => (prev?.id === id ? null : prev));
      }, 5000);
  };

  const sellerName = liveSession?.title.replace("'s Live Show", "") || 'Seller';

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
        
        <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
            {hearts.map(h => (
            <span key={h.id} style={{ left: h.x - 16, top: h.y - 40 }} className="absolute animate-pop text-2xl">❤️</span>
            ))}
        </div>
        {banner && (
          <div
            key={banner.id}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 animate-in fade-in zoom-in-95"
          >
            <div className={`text-2xl md:text-4xl font-extrabold p-4 rounded-lg text-center shadow-2xl ${banner.type === 'deal' ? 'bg-yellow-400 text-black' : 'bg-pink-500 text-white'}`}>
              {banner.text}
            </div>
          </div>
        )}

        <div className="relative h-1/2 bg-neutral-900 flex items-center justify-center border-b border-neutral-800">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Video className="h-12 w-12" />
                <p>Seller's live video stream will appear here.</p>
            </div>
            <div className="absolute inset-0 bg-black/20" />
            {pinnedProduct && (
                 <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm p-2 rounded-lg border border-primary/50">
                    <LiveProductCard product={pinnedProduct} onAddToCart={addToCart} />
                 </div>
            )}
        </div>

        <div className="p-2 flex justify-between items-center bg-neutral-800 border-b border-neutral-700">
            <div>
            <h2 className="font-bold">{sellerName}</h2>
            <p className="text-sm text-red-500">LIVE NOW</p>
            </div>
            <Button size="sm" className="bg-red-600 hover:bg-red-700">Follow</Button>
        </div>

        <div className="flex overflow-x-auto gap-2 p-2 bg-black border-b border-neutral-800">
            {liveSession?.productIds?.map(productId => (
                <div key={productId}>TODO: Fetch and render product card</div>
            ))}
        </div>

        <div className="flex flex-1 overflow-hidden">
            <LiveChat liveSessionId={liveSession?.id || null} />
            <CartDrawer cartItems={cartItems} onCheckout={() => setIsPaymentModalOpen(true)} />
        </div>

        <PaymentModal isOpen={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen} />
        </div>
    </BuyerLayout>
  );
}
