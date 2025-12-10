
'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { BuyerLayout } from "@/components/layout/buyer-layout";
import { LiveProductCard } from "@/components/buyer/LiveProductCard";
import { Button } from "@/components/ui/button";
import type { Product, CartItem, Order, LiveSession, ChatMessage, Chat, UserProfile } from "@/lib/types";
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, useDoc } from '@/firebase';
import { collection, query, where, doc, setDoc, serverTimestamp, writeBatch, getDocs, deleteDoc, updateDoc, addDoc, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";
import { FirestorePermissionError } from "@/firebase/errors";
import { Skeleton } from "@/components/ui/skeleton";
import { CartDrawer } from "@/components/buyer/CartDrawer";
import { Card } from "@/components/ui/card";
import { PrivateChat } from "@/components/messages/private-chat";
import { AnimatePresence, motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { LiveActivityFeed } from '@/components/studio/LiveActivityFeed';

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


export default function SellerRoom() {
  const params = useParams();
  const sellerId = params.sellerId as string;
  
  const [pinnedProduct, setPinnedProduct] = useState<Product | null>(null);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  
  const [hearts, setHearts] = useState<any[]>([]);
  const heartsRef = useRef<any[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);


  // Find the active live session for this seller
  const liveSessionQuery = useMemoFirebase(() => {
    if (!sellerId) return null;
    return query(collection(firestore, 'liveSessions'), where('sellerId', '==', sellerId), where('status', '==', 'live'), limit(1));
  }, [firestore, sellerId]);

  const { data: liveSessions, isLoading: isLiveSessionLoading } = useCollection<LiveSession>(liveSessionQuery);
  const liveSession = liveSessions?.[0];

  // WebRTC Connection Logic
  useEffect(() => {
    if (!liveSession || !liveSession.offer || !firestore || pc) return;

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
    
    const offerDescription = new RTCSessionDescription(liveSession.offer);
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


  // Fetch all products for the current seller (can be optimized later if needed)
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
  
  // Real-time listener for the live session document to get updates
  useEffect(() => {
    if (!liveSession?.id) {
      setPinnedProduct(null);
      return;
    }
    const sessionRef = doc(firestore, 'liveSessions', liveSession.id);
    const unsubscribe = onSnapshot(sessionRef, (doc) => {
        const sessionData = doc.data() as LiveSession;
        if (sessionData && sessionData.pinnedProductId && products) {
            const product = products.find(p => p.id === sessionData.pinnedProductId);
            setPinnedProduct(product || null);
        } else {
            setPinnedProduct(null);
        }
    });
    
    // Listen for live events like hearts
    const eventsRef = collection(firestore, 'liveSessions', liveSession.id, 'events');
    const eventsQuery = query(eventsRef, where('timestamp', '>', new Date()));
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const event = change.doc.data();
                if (event.type === 'like') {
                     spawnHeart();
                }
            }
        });
    });

    return () => {
        unsubscribe();
        unsubscribeEvents();
    };
  }, [liveSession, products, firestore]);
  
  const handleCheckout = async () => {
    if (!user || !firestore || !cartItems || cartItems.length === 0) {
      toast({ variant: 'destructive', title: 'Your cart is empty.' });
      return;
    }
    
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

  const spawnHeart = useCallback(() => {
    const id = Date.now();
    const x = Math.random() * 50 + 25; // Random horizontal position
    const newHeart = { id, x };
    heartsRef.current = [...heartsRef.current, newHeart];
    setHearts(heartsRef.current);

    setTimeout(() => {
      heartsRef.current = heartsRef.current.filter(h => h.id !== id);
      setHearts(heartsRef.current);
    }, 2000);
  }, []);
  
  const handleLike = async () => {
    spawnHeart(); // Instant visual feedback
    if (!liveSession || !user) return;
    
    const eventsRef = collection(firestore, 'liveSessions', liveSession.id, 'events');
    try {
      await addDoc(eventsRef, {
        type: 'like',
        text: `${user.displayName || 'A viewer'} liked the stream.`,
        userId: user.uid,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
        console.error("Failed to send like event", error);
    }
  };


  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Main content area */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
            {/* Left/Main Panel: Video and Product Shelf */}
            <div className="lg:col-span-8 xl:col-span-9 flex flex-col h-full bg-black">
                {/* Live Video */}
                <div className="flex-1 relative bg-black flex items-center justify-center min-h-0">
                    <video ref={videoRef} className="h-full w-full object-contain" autoPlay playsInline />
                    {pinnedProduct && (
                        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm p-2 rounded-lg border border-primary/50">
                            <LiveProductCard product={pinnedProduct} />
                        </div>
                    )}
                    {/* Hearts Animation Overlay */}
                    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
                        <AnimatePresence>
                        {hearts.map(h => (
                            <motion.div
                            key={h.id}
                            initial={{ y: 0, opacity: 1, scale: 0.5 }}
                            animate={{ y: -500, opacity: 0, scale: 1.5 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 2, ease: "easeOut" }}
                            style={{ left: `${h.x}%` }}
                            className="absolute bottom-0"
                            >
                            <Heart className="h-8 w-8 text-red-500 fill-red-500" />
                            </motion.div>
                        ))}
                        </AnimatePresence>
                    </div>
                </div>
                 {/* Like button */}
                <div className="absolute bottom-20 right-4 lg:right-[calc(25%+1rem)] z-50">
                    <Button onClick={handleLike} size="icon" variant="ghost" className="rounded-full bg-black/50 h-14 w-14 hover:bg-black/70">
                        <Heart className="h-8 w-8 text-white" />
                    </Button>
                </div>

                {/* Bottom Section: Shelf and Cart */}
                <div className="flex-shrink-0 flex border-t border-neutral-700">
                    <Card className="rounded-none border-0 flex-1 bg-neutral-900/50">
                        <div className="p-3">
                            <h3 className="font-bold mb-2 text-sm">🛍️ Product Shelf</h3>
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
                    <div className="w-full max-w-xs border-l border-neutral-700">
                        <CartDrawer cartItems={cartItems || []} onCheckout={handleCheckout} />
                    </div>
                </div>
            </div>

            {/* Right Panel: Chat */}
            <div className="lg:col-span-4 xl:col-span-3 h-full hidden md:flex flex-col">
                <PrivateChat sellerId={sellerId} sellerName="Seller" />
            </div>
        </div>
    </div>
  );
}

