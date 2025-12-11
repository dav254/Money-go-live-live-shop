

'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import type { Product, CartItem, Order, LiveSession, UserProfile, SellerShop } from "@/lib/types";
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, useDoc } from '@/firebase';
import { collection, query, where, doc, setDoc, serverTimestamp, writeBatch, getDocs, deleteDoc, updateDoc, addDoc, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";
import { FirestorePermissionError } from "@/firebase/errors";
import { Skeleton } from "@/components/ui/skeleton";
import { CartDrawer } from "@/components/buyer/CartDrawer";
import { Card } from "@/components/ui/card";
import { ChatSystem } from "@/components/messages/chat-system";
import { ScrollArea } from '@/components/ui/scroll-area';
import { LiveProductCard } from '@/components/buyer/LiveProductCard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Timestamp } from 'firebase/firestore';
import { BuyerLayout } from '@/components/layout/buyer-layout';


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

// WebRTC Configuration
const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};

interface LiveSessionWithSeller extends LiveSession {
  seller: UserProfile & { shop?: SellerShop };
}

function LiveRoomPage() {
  const params = useParams();
  const sellerId = params.sellerId as string;
  
  const [pinnedProduct, setPinnedProduct] = useState<Product | null>(null);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);

  // Find the active live session for this seller
  const liveSessionQuery = useMemoFirebase(() => {
    if (!sellerId || !firestore) return null;
    return query(collection(firestore, 'liveSessions'), where('sellerId', '==', sellerId), where('status', '==', 'live'), limit(1));
  }, [firestore, sellerId]);

  const { data: liveSessions, isLoading: isLiveSessionLoading } = useCollection<LiveSession>(liveSessionQuery);
  const liveSession = liveSessions?.[0];
  const liveSessionId = liveSession?.id;

  // WebRTC Connection Logic
  useEffect(() => {
    if (!liveSession || !('offer' in liveSession) || !firestore || pc) return;

    const peerConnection = new RTCPeerConnection(servers);
    setPc(peerConnection);

    peerConnection.ontrack = (event) => {
        if (videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
        }
    };

    const answerCandidatesRef = collection(firestore, 'liveSessions', liveSession.id, 'answerCandidates');
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            addDoc(answerCandidatesRef, event.candidate.toJSON());
        }
    };
    
    const offerDescription = new RTCSessionDescription(liveSession.offer as RTCSessionDescriptionInit);
    peerConnection.setRemoteDescription(offerDescription).then(async () => {
        const answerDescription = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answerDescription);

        const answer = {
            type: answerDescription.type,
            sdp: answerDescription.sdp,
        };

        const sessionRef = doc(firestore, 'liveSessions', liveSession.id);
        await updateDoc(sessionRef, { answer });
    });
    
    const offerCandidatesRef = collection(firestore, 'liveSessions', liveSession.id, 'offerCandidates');
    onSnapshot(offerCandidatesRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                peerConnection.addIceCandidate(candidate);
            }
        });
    });

    return () => {
        peerConnection.close();
    };

  }, [liveSession, firestore, pc]);


  // Fetch only the products featured in the live session
    const featuredProductsQuery = useMemoFirebase(() => {
        if (!firestore || !liveSession?.productIds || liveSession.productIds.length === 0) return null;
        // Firestore 'in' query is limited to 30 items
        return query(collection(firestore, 'products'), where('__name__', 'in', liveSession.productIds.slice(0, 30)));
    }, [firestore, liveSession]);

    const { data: featuredProducts, isLoading: areProductsLoading } = useCollection<Product>(featuredProductsQuery);


  // Fetch Cart Items
  const cartItemsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'userProfiles', user.uid, 'cart');
  }, [user, firestore]);
  const { data: cartItems } = useCollection<CartItem>(cartItemsQuery);
  
  // Real-time listener for the live session document to get pinned product updates
    useEffect(() => {
        if (!liveSession?.id || !firestore) {
            setPinnedProduct(null);
            return;
        }
        
        const unsubscribe = onSnapshot(doc(firestore, 'liveSessions', liveSession.id), (docSnapshot) => {
            const sessionData = docSnapshot.data() as LiveSession;
            if (sessionData && sessionData.pinnedProductId) {
                // We fetch the single pinned product document
                const productRef = doc(firestore, 'products', sessionData.pinnedProductId);
                onSnapshot(productRef, (productDoc) => {
                    if (productDoc.exists()) {
                        setPinnedProduct({ id: productDoc.id, ...productDoc.data() } as Product);
                    } else {
                        setPinnedProduct(null);
                    }
                });
            } else {
                setPinnedProduct(null);
            }
        });

        return () => unsubscribe();
    }, [liveSession, firestore]);
  
  const handleCheckout = async () => {
    if (!user || !firestore || !cartItems || cartItems.length === 0) {
      toast({ variant: 'destructive', title: 'Your cart is empty.' });
      return;
    }

    const newOrderRef = doc(collection(firestore, 'orders'));

    const sellerId = cartItems[0].sellerId;
    const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const shippingCost = 10; 
    const totalAmount = subtotal + shippingCost;
    
    const orderItems = cartItems.map(item => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        imageUrl: item.imageUrl
    }));

    try {
      const batch = writeBatch(firestore);

      const newOrderData: Partial<Order> = {
        id: newOrderRef.id,
        buyerId: user.uid,
        sellerId: sellerId,
        items: orderItems,
        subtotal: subtotal,
        shippingCost: shippingCost,
        totalAmount: totalAmount,
        orderDate: serverTimestamp() as any,
        shippingAddress: '123 Placeholder Lane, Nairobi', // Placeholder
        orderStatus: 'pending',
        paymentMethod: 'pending',
      };

      batch.set(newOrderRef, newOrderData);

      cartItems.forEach(item => {
        const itemInCartRef = doc(firestore, 'userProfiles', user.uid, 'cart', item.productId);
        batch.delete(itemInCartRef);
      });

      await batch.commit();

      toast({ title: 'Order Created!', description: 'Redirecting to checkout...' });
      router.push(`/checkout/${newOrderRef.id}`);

    } catch (error) {
      console.error("Error creating order:", error);
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: newOrderRef.path,
        operation: 'create',
        requestResourceData: { orderItems: orderItems.length },
      }));
    }
  };

  const handleDeleteItem = async (productId: string) => {
    if (!user || !firestore) return;
    const itemRef = doc(firestore, 'userProfiles', user.uid, 'cart', productId);
    try {
        await deleteDoc(itemRef);
        toast({ title: 'Item removed from cart.' });
    } catch (e) {
        console.error("Error removing item from cart: ", e);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not remove item.' });
    }
  };

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Main Content: Video, Product Shelf */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Video Player */}
        <div className="relative flex-1 bg-black">
          <video ref={videoRef} className="h-full w-full object-contain" autoPlay playsInline />
          <div className="absolute top-3 left-3 flex gap-2">
            {liveSession && (
                <div className="px-2 py-1 rounded text-xs font-semibold bg-red-600 animate-pulse flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-white"></div>
                    LIVE
                </div>
            )}
          </div>
          <div className="absolute bottom-4 left-4 max-w-sm w-full pr-8">
            {pinnedProduct && (
              <div className="mt-2 bg-black/60 backdrop-blur-sm p-2 rounded-lg border border-primary/50">
                <LiveProductCard product={pinnedProduct} />
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section: Product Shelf & Cart */}
        <div className="flex h-48 flex-shrink-0 border-t border-neutral-700 bg-neutral-900/50">
          <div className="flex-1 p-3">
            <h3 className="mb-2 text-sm font-bold">🛍️ Product Shelf</h3>
            <ScrollArea className="h-[calc(100%-2rem)]">
              <div className="flex gap-2 pb-2">
                {areProductsLoading ? (
                  <ProductShelfSkeleton />
                ) : featuredProducts && featuredProducts.length > 0 ? (
                  featuredProducts.map((p) => (
                    <div key={p.id} className="flex flex-col items-center">
                      <LiveProductCard product={p} />
                    </div>
                  ))
                ) : (
                  <p className="p-4 text-center text-sm text-neutral-400">
                    Seller has not featured any products.
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
          <div className="w-full max-w-xs border-l border-neutral-700">
            <CartDrawer
              cartItems={cartItems || []}
              onCheckout={handleCheckout}
              onDeleteItem={handleDeleteItem}
            />
          </div>
        </div>
      </div>

      {/* Right Panel: Chat System */}
      <div className="w-full flex-shrink-0 lg:w-[380px] lg:border-l lg:border-neutral-800">
        <ChatSystem />
      </div>
    </div>
  );
}


export default function SellerRoomWrapper() {
  return (
    <BuyerLayout fullWidth>
      <LiveRoomPage />
    </BuyerLayout>
  )
}

    
