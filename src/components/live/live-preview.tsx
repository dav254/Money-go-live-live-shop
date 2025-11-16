
'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Heart, MessageCircle, Share2, ShoppingBag, Star, Eye } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { Product, Seller } from '@/lib/types';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { Skeleton } from '../ui/skeleton';

const sampleComments = [{
    id: 1, user: 'John', text: 'Is this available?',
  }, {
    id: 2, user: 'Amina', text: 'How much for delivery to CBD?',
}];


export function LivePreview() {
  const { user } = useUser();
  const { userProfile: seller, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const firestore = useFirestore();

  const [showProduct, setShowProduct] = useState(false);
  const [comments, setComments] = useState(sampleComments);
  const [likeCount, setLikeCount] = useState(124);
  const heartsRef = useRef<{ id: number; x: number; y: number }[]>([]);
  const [_, setForceUpdate] = useState(0); // To force re-render for hearts

  // Query for the latest product from the current seller
  const productsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'products'),
      where('sellerId', '==', user.uid),
      orderBy('uploadDate', 'desc'),
      limit(1)
    );
  }, [firestore, user]);

  const { data: products, isLoading: isProductsLoading } = useCollection<Product>(productsQuery);
  const product = products?.[0];

  useEffect(() => {
    // simulate incoming comments
    const t = setInterval(() => {
      setComments(prev => {
        const nextId = prev.length ? prev[prev.length-1].id + 1 : 1;
        return [...prev.slice(-4), { id: nextId, user: ['Ali','Zuri','Ben','Maya'][Math.floor(Math.random()*4)], text: ['Nice!','I want one','Where from?','Say price'][Math.floor(Math.random()*4)] }];
      });
    }, 4500);
    return () => clearInterval(t);
  }, []);

  function spawnHeart(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    const x = e.clientX || window.innerWidth/2;
    const y = e.clientY || window.innerHeight/2;
    const id = Date.now();
    const heart = { id, x, y };
    heartsRef.current = [...heartsRef.current, heart];
    setForceUpdate(val => val + 1);

    setTimeout(() => {
      heartsRef.current = heartsRef.current.filter(h => h.id !== id);
      setForceUpdate(val => val + 1);
    }, 1200);
    setLikeCount(c => c + 1);
  }

  const isLoading = isProfileLoading || isProductsLoading;
  
  if (isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  return (
    <div className="h-full bg-background text-foreground font-body">
      <main className="h-full flex items-stretch">
        <div className="relative w-full h-full">
          {/* Video / Placeholder */}
          <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden">
            {product?.imageUrl ? (
              <Image 
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover opacity-70"
              />
            ) : (
              <div className="text-center text-muted-foreground">
                <p>Your live stream will appear here.</p>
                <p className="text-sm">Upload a product to get started.</p>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

            {/* Top-left seller info */}
            {seller && (
                <div className="absolute left-4 top-4 md:top-4 flex items-center gap-3 bg-black/40 p-2 rounded-xl backdrop-blur-sm z-30">
                <Avatar className="h-10 w-10 border-2 border-white">
                    <AvatarImage src={seller.profilePictureUrl} alt={seller.username} />
                    <AvatarFallback>{seller.username?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="text-sm">
                    <div className="font-headline font-bold text-white">{seller.fullName}</div>
                    <div className="text-xs text-gray-200 flex items-center gap-2 mt-1">
                    <Badge variant="destructive" className="h-5 text-xs font-bold uppercase tracking-wider">LIVE</Badge>
                    <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        <span>1.3k</span>
                    </div>
                    </div>
                </div>
                <Button size="sm" variant="outline" className="ml-2 bg-transparent text-white border-white hover:bg-white/20 hover:text-white h-8">
                    + Follow
                </Button>
                </div>
            )}

            {/* Right-side floating icons */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-30">
              <div className="flex flex-col items-center">
                <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70" onClick={spawnHeart}>
                  <Heart className="h-6 w-6 text-white" />
                </Button>
                <span className="text-sm font-semibold text-white drop-shadow-md">{likeCount}</span>
              </div>
              <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70">
                <MessageCircle className="h-6 w-6 text-white" />
              </Button>
              <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70">
                <Share2 className="h-6 w-6 text-white" />
              </Button>
              <Button size="icon" variant="ghost" className="rounded-full bg-primary h-12 w-12 hover:bg-primary/80" onClick={()=>setShowProduct(true)} disabled={!product}>
                <ShoppingBag className="h-6 w-6 text-primary-foreground" />
              </Button>
              <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70">
                <Star className="h-6 w-6 text-white" />
              </Button>
            </div>

            {/* Floating hearts */}
            <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
              {heartsRef.current.map(h => (
                <span key={h.id} style={{ left: h.x-16, top: h.y-40 }} className="absolute animate-pop text-2xl text-red-500">
                  <Heart fill="currentColor" className="w-8 h-8" />
                </span>
              ))}
            </div>

            {/* Comments feed (left-bottom) */}
            <div className="absolute left-3 bottom-28 w-72 max-w-[60%] md:max-w-[44%] flex flex-col gap-2 z-30">
              {comments.map(c => (
                <div key={c.id} className="bg-black/50 text-white px-3 py-2 rounded-xl text-sm shadow backdrop-blur-sm animate-in fade-in slide-in-from-left-4 duration-500"> 
                  <span className="font-semibold mr-2">{c.user}:</span>{c.text}
                </div>
              ))}
            </div>

            {/* View Shop button (bottom-left) */}
             <Button variant="secondary" className="absolute left-4 bottom-6 bg-black/50 hover:bg-black/70 z-30">View Shop</Button>

            {/* Product Drawer (bottom) */}
            {product && (
                <div className={`absolute left-0 right-0 bottom-0 transition-transform duration-500 ease-out z-50 ${showProduct ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="mx-auto max-w-md">
                    <div className="mx-3 mb-3 bg-card/90 border-t-2 border-primary backdrop-blur-md rounded-t-2xl p-4">
                    <div className="flex items-start gap-4">
                        <div className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                            <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
                        </div>
                        <div className="flex-1">
                        <h3 className="font-headline font-semibold text-lg">{product.name}</h3>
                        <div className="text-xl font-bold text-primary mt-1">
                            {product.price.toLocaleString()}
                            {product.wasPrice && (
                                <span className="text-sm text-muted-foreground line-through ml-2">{product.wasPrice.toLocaleString()}</span>
                            )}
                        </div>
                        <div className="mt-2 flex gap-2">
                            <Button size="sm" className="font-semibold flex-1">Buy Now</Button>
                            <Button size="sm" variant="secondary" className="flex-1">Add to Cart</Button>
                        </div>
                        </div>
                    </div>

                    <button onClick={() => setShowProduct(false)} className="w-full mt-3 text-sm text-center text-muted-foreground hover:text-foreground">
                        Swipe down to close
                    </button>
                    </div>

                    {/* small nav area below drawer to simulate app nav */}
                    <div className="h-16 bg-background/90 backdrop-blur-sm" />
                </div>
                </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
