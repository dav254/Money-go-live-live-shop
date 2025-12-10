
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
  
  const [chatId, setChatId] = useState<string | null>(null);

  // Effect to find the existing chat between the buyer and seller
  useEffect(() => {
    if (!user || !firestore || !sellerId) return;

    const findChat = async () => {
        const chatsRef = collection(firestore, 'chats');
        // This query requires a composite index on participantIds and lastMessageTimestamp
        const q = query(
            chatsRef, 
            where('participantIds', 'array-contains', user.uid),
        );
        const querySnapshot = await getDocs(q);
        let existingChatId: string | null = null;
        querySnapshot.forEach(doc => {
            if (doc.data().participantIds.includes(sellerId)) {
                existingChatId = doc.id;
            }
        });
        setChatId(existingChatId);
    };

    findChat();
  }, [user, firestore, sellerId]);



  return (
    <BuyerLayout>
        <div className="flex flex-col md:flex-row h-[calc(100vh-8rem)]">
        
        {/* Live Video */}
        <div className="flex-1 bg-black flex items-center justify-center border-r border-neutral-700">
            <p className="text-white">[Live Video Feed]</p>
            {pinnedProduct && (
                 <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm p-2 rounded-lg border border-primary/50">
                    <LiveProductCard product={pinnedProduct} />
                </div>
            )}
        </div>

        {/* Right Panel */}
        <div className="w-full md:w-1/3 bg-neutral-800 flex flex-col">
            
            {/* Product Shelf */}
            <div className="p-3 border-b border-neutral-700">
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

            {/* Chat */}
            <div className="flex-1 min-h-0">
                 <PrivateChat sellerId={sellerId} sellerName="Seller" />
            </div>
        </div>
    </div>
    </BuyerLayout>
  );
}
