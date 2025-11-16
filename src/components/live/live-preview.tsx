
'use client';

import React, { useEffect, useState, useRef } from 'react';
import type { Seller, Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

interface LivePreviewProps {
  // seller: Seller | null; // This was from before, now we fetch inside
  // products: Product[]; // This was from before, now we fetch inside
}

// A single-file React component for a mobile-first live shopping UI preview.
export function LivePreview({}: LivePreviewProps) {
  const [showProductDrawer, setShowProductDrawer] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [likeCount, setLikeCount] = useState(124);
  const heartsRef = useRef<any[]>([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  
  const { user } = useUser();
  const firestore = useFirestore();
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [seller, setSeller] = useState<Seller | null>(null); // We need seller info too

  // Fetch seller's products when user is available
  useEffect(() => {
    if (user && firestore) {
      const fetchProducts = async () => {
        const productsRef = collection(firestore, 'products');
        // Fetch the most recent product uploaded by this seller
        const q = query(productsRef, where('sellerId', '==', user.uid), orderBy('uploadDate', 'desc'), limit(10));
        const querySnapshot = await getDocs(q);

        const products: Product[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setSellerProducts(products);

        // TODO: Fetch seller profile based on user.uid to get seller name, avatar etc.
        // For now, we'll use a placeholder if we have products
        if (products.length > 0) {
            setSeller({
                id: user.uid,
                name: user.displayName || "Seller Store",
                avatar: { imageUrl: user.photoURL || 'https://picsum.photos/seed/avatar/50/50', imageHint: "seller avatar", id: 'avatar', description: 'seller avatar' },
                isVerified: true,
                rating: 5,
                reviewsCount: 0,
                followers: 0,
                location: "Online",
                joinedDate: new Date().toISOString(),
                bio: "A seller on MoneyGo.",
                banner: { imageUrl: 'https://picsum.photos/seed/banner/1200/400', imageHint: "store banner", id: 'banner', description: 'store banner' },
            });
        }
      };
      fetchProducts();
    }
  }, [user, firestore]);

  // Combine all product images and videos into a single playlist
  const mediaPlaylist = sellerProducts.flatMap(p => 
    (p.imageUrl ? [{ type: 'image', url: p.imageUrl, product: p }] : [])
  );

  useEffect(() => {
    // Simulate incoming comments
    const commentInterval = setInterval(() => {
      setComments(prev => {
        const nextId = prev.length > 0 ? prev[prev.length - 1].id + 1 : 1;
        const randomUser = ['Ali', 'Zuri', 'Ben', 'Maya'][Math.floor(Math.random() * 4)];
        const randomText = ['Nice!', 'I want one', 'How much?', 'Incredible price!'][Math.floor(Math.random() * 4)];
        return [...prev.slice(-4), { id: nextId, user: randomUser, text: randomText }];
      });
    }, 4500);

    return () => clearInterval(commentInterval);
  }, []);
  
  // Cycle through media playlist
   useEffect(() => {
    if (mediaPlaylist.length > 1) {
      const mediaInterval = setInterval(() => {
        setCurrentMediaIndex(prev => (prev + 1) % mediaPlaylist.length);
      }, 7000); // Change media every 7 seconds
      return () => clearInterval(mediaInterval);
    }
  }, [mediaPlaylist.length]);

  function spawnHeart(e: React.MouseEvent) {
    const x = e.clientX || window.innerWidth / 2;
    const y = e.clientY || window.innerHeight / 2;
    const id = Date.now();
    const heart = { id, x, y };
    heartsRef.current = [...heartsRef.current, heart];
    setTimeout(() => {
      heartsRef.current = heartsRef.current.filter(h => h.id !== id);
    }, 1200);
    setLikeCount(c => c + 1);
  }

  function handleShowProduct(product: Product) {
      setActiveProduct(product);
      setShowProductDrawer(true);
  }

  const currentMedia = mediaPlaylist[currentMediaIndex];

  return (
    <div className="h-full bg-background text-foreground font-sans">
      <main className="h-full flex items-stretch">
        <div className="relative w-full h-full">
          {/* Media Display */}
          <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden">
            {currentMedia ? (
                currentMedia.type === 'video' ? (
                    <video className="w-full h-full object-cover" src={currentMedia.url} poster="" autoPlay muted loop playsInline></video>
                ) : (
                    <img src={currentMedia.url} alt="Product" className="w-full h-full object-cover" />
                )
            ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground p-8 text-center">
                  <p>
                    No products found for your store. Go to the "Products" tab to upload your first item and see it here!
                  </p>
                </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

            {/* Top-left seller info */}
            {seller && (
              <div className="absolute left-4 top-4 flex items-center gap-3 bg-black/40 p-2 rounded-xl">
                <img src={seller.avatar.imageUrl} alt={seller.name} className="w-10 h-10 rounded-full border-2 border-white" />
                <div>
                  <div className="font-semibold text-white">{seller.name}</div>
                  <div className="text-xs text-gray-200 flex items-center gap-2">
                    <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-[11px] font-bold">LIVE</span>
                    <span>👁️ {Math.floor(Math.random() * 2000) + 500}</span>
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="ml-2 h-auto px-2 py-1 text-xs">+ Follow</Button>
              </div>
            )}

            {/* Right-side floating icons */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-30">
                <button onClick={spawnHeart} className="flex flex-col items-center gap-1 text-white">
                    <span className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-xl">❤️</span>
                    <span className="text-xs font-semibold">{likeCount}</span>
                </button>
                <button className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-xl">💬</button>
                <button className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-xl">↗️</button>
                {currentMedia && <button onClick={() => handleShowProduct(currentMedia.product)} className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-xl text-primary-foreground">🛒</button>}
                <button className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-xl">⭐</button>
            </div>

            {/* Floating hearts */}
            <div className="pointer-events-none absolute inset-0 z-40">
              {heartsRef.current.map(h => (
                <span key={h.id} style={{ left: h.x - 16, top: h.y - 40 }} className="absolute animate-pop text-2xl">❤️</span>
              ))}
            </div>

            {/* Comments feed */}
            <div className="absolute left-3 bottom-28 w-72 max-w-[50%] flex flex-col gap-2 z-30">
              {comments.map(c => (
                <div key={c.id} className="bg-black/50 text-white px-3 py-2 rounded-xl text-sm shadow-lg backdrop-blur-sm animate-fade-in">
                  <span className="font-semibold mr-1.5">{c.user}:</span>{c.text}
                </div>
              ))}
            </div>
            
            {/* Product Drawer (bottom) */}
            {activeProduct && (
                <div className={`absolute left-0 right-0 bottom-0 transition-transform duration-300 z-50 ${showProductDrawer ? 'translate-y-0' : 'translate-y-full'}`}>
                  <div className="mx-2 mb-2 bg-background/80 backdrop-blur-lg rounded-t-xl p-4 border-t border-border">
                    <div className="flex items-center gap-3">
                      <img src={activeProduct.imageUrl} alt={activeProduct.name} className="w-20 h-20 object-cover rounded-lg" />
                      <div className="flex-1">
                        <div className="font-bold text-lg">{activeProduct.name}</div>
                        <div className="text-sm text-primary font-semibold">{activeProduct.price} <span className="text-xs text-muted-foreground line-through ml-2">{activeProduct.wasPrice}</span></div>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" className="font-semibold">Buy Now</Button>
                          <Button size="sm" variant="secondary">Add to Cart</Button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">Limited stock: {activeProduct.stock} left</div>
                    <button onClick={() => setShowProductDrawer(false)} className="w-full mt-3 text-sm text-center text-muted-foreground hover:text-foreground">
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

      <style>{`
        @keyframes pop {
          0% { transform: translateY(0) scale(0.6); opacity: 0.9 }
          50% { transform: translateY(-50px) scale(1.05); opacity: 1 }
          100% { transform: translateY(-120px) scale(0.8); opacity: 0 }
        }
        .animate-pop { animation: pop 1.2s linear forwards }
        
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }

      `}</style>
    </div>
  );
}
