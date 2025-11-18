
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { Seller, Product } from '@/lib/types';
import { VideoInfo } from '@/components/feed/video-info';
import { VideoActions } from '@/components/feed/video-actions';
import { ProductInfo } from './product-info';
import { ProductDrawer } from '@/components/feed/product-drawer';
import Image from 'next/image';

// --- Floating Hearts Animation --- //
interface Heart {
  id: number;
  x: number;
  y: number;
}

// --- Simulated Comments --- //
interface Comment {
    id: number;
    user: string;
    text: string;
    time: string;
}

interface LivePreviewProps {
  seller: Seller;
  products: Product[];
}

interface MediaItem {
  url: string;
  type: 'image' | 'video';
  productId: string;
}

export function LivePreview({ seller, products }: LivePreviewProps) {
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [hearts, setHearts] = useState<Heart[]>([]);
  const heartsRef = useRef<Heart[]>([]);
  const [comments, setComments] = useState<Comment[]>([
    { id: 1, user: 'John', text: 'Is this available?', time: 'now' },
    { id: 2, user: 'Amina', text: 'How much for delivery to CBD?', time: '2s' }
  ]);

  const allMedia = useMemo(() => {
    const media: MediaItem[] = [];
    products.forEach(product => {
      if (product.videoUrls && product.videoUrls.length > 0) {
        product.videoUrls.forEach(url => media.push({ url, type: 'video', productId: product.id }));
      }
      if (product.imageUrls && product.imageUrls.length > 0) {
        product.imageUrls.forEach(url => media.push({ url, type: 'image', productId: product.id }));
      }
    });
    return media;
  }, [products]);

  const currentMedia = allMedia.length > 0 ? allMedia[currentMediaIndex] : null;
  const currentProduct = products.find(p => p.id === currentMedia?.productId);

  const handleNext = () => {
    if (allMedia.length > 0) {
      setCurrentMediaIndex((prevIndex) => (prevIndex + 1) % allMedia.length);
    }
  };

  const handlePrevious = () => {
    if (allMedia.length > 0) {
      setCurrentMediaIndex((prevIndex) => (prevIndex - 1 + allMedia.length) % allMedia.length);
    }
  };
  
  const handleScroll = (direction: 'up' | 'down') => {
    if (direction === 'up') {
        handlePrevious();
    } else {
        handleNext();
    }
  };

  const spawnHeart = (e: React.MouseEvent<HTMLButtonElement>) => {
    const x = e.clientX || window.innerWidth / 2;
    const y = e.clientY || window.innerHeight / 2;
    const id = Date.now();
    const heart = { id, x, y };
    heartsRef.current = [...heartsRef.current, heart];
    setHearts(heartsRef.current);

    setTimeout(() => {
      heartsRef.current = heartsRef.current.filter(h => h.id !== id);
      setHearts(heartsRef.current);
    }, 1200);
  };

  useEffect(() => {
    setCurrentMediaIndex(0);

    const commentInterval = setInterval(() => {
        setComments(prev => {
            const nextId = prev.length ? prev[prev.length - 1].id + 1 : 1;
            const users = ['Ali', 'Zuri', 'Ben', 'Maya'];
            const texts = ['Nice!', 'I want one', 'Where from?', 'Say price'];
            return [...prev.slice(-4), { 
                id: nextId, 
                user: users[Math.floor(Math.random() * users.length)], 
                text: texts[Math.floor(Math.random() * texts.length)], 
                time: 'now' 
            }];
        });
    }, 4500);

    return () => clearInterval(commentInterval);
  }, [products]);

  return (
    <div className="relative h-full w-full bg-black text-white font-sans">
      
      {/* Hearts Animation */}
      <div className="pointer-events-none absolute inset-0 z-50">
          {hearts.map(h => (
          <span key={h.id} style={{ left: h.x - 16, top: h.y - 40 }} className="absolute animate-pop text-2xl">❤️</span>
          ))}
      </div>

      {/* Main Content Area */}
      <div className="relative w-full h-full">
          {/* Media Display */}
          <div className="absolute inset-0 z-0 w-full h-full bg-black flex items-center justify-center overflow-hidden">
              {currentMedia ? (
              currentMedia.type === 'video' ? (
                  <video className="w-full h-full object-contain" src={currentMedia.url} poster="" autoPlay muted loop playsInline key={currentMedia.url}></video>
              ) : (
                  <Image src={currentMedia.url} alt="Product" fill className="object-contain" key={currentMedia.url} unoptimized />
              )
              ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground p-8 text-center">
                  <p>No media to display. Upload products with images or videos to get started.</p>
              </div>
              )}
          </div>

          {/* --- OVERLAYS --- */}
          
          {/* Top Overlay: Seller Info */}
          <div className="absolute top-4 left-4 z-10 pointer-events-auto">
              <VideoInfo seller={seller} viewers={1234} />
          </div>

          {/* Right Side Actions */}
          {currentProduct && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 pointer-events-auto">
                  <VideoActions 
                      initialLikes={currentProduct.likes || 0}
                      onLike={spawnHeart}
                      onProductClick={() => setIsDrawerOpen(true)} 
                      onScroll={handleScroll} 
                  />
              </div>
          )}

          {/* Comments Feed (Bottom Left) */}
          <div className="absolute bottom-24 left-4 z-20 pointer-events-auto flex flex-col gap-2 max-h-48 overflow-y-auto">
              {comments.map(c => (
                  <div key={c.id} className="bg-black/50 text-white px-3 py-2 rounded-xl text-sm shadow-lg backdrop-blur-sm max-w-xs">
                      <span className="font-bold mr-2">{c.user}:</span>{c.text}
                  </div>
              ))}
          </div>

          {/* Product Info (Bottom Center) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-auto w-full max-w-sm px-4">
              {currentProduct && <ProductInfo product={currentProduct} />}
          </div>
      </div>

      {/* Product Drawer */}
      {currentProduct && (
          <ProductDrawer 
              product={currentProduct} 
              isOpen={isDrawerOpen} 
              onOpenChange={setIsDrawerOpen} 
          />
      )}
    </div>
  );
}
