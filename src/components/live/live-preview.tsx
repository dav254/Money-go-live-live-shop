
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { Seller, Product, Comment } from '@/lib/types';
import { VideoInfo } from '@/components/feed/video-info';
import { VideoActions } from '@/components/feed/video-actions';
import { ProductInfo } from './product-info';
import { ProductDrawer } from '@/components/feed/product-drawer';
import Image from 'next/image';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Send } from 'lucide-react';
import { CommentDrawer } from '@/components/feed/comment-drawer';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';


// --- Floating Hearts Animation --- //
interface Heart {
  id: number;
  x: number;
  y: number;
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
  const [isCommentDrawerOpen, setIsCommentDrawerOpen] = useState(false);
  const [hearts, setHearts] = useState<Heart[]>([]);
  const heartsRef = useRef<Heart[]>([]);
  const { user } = useUser();
  const firestore = useFirestore();
  const [newComment, setNewComment] = useState('');

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

  const commentsQuery = useMemoFirebase(() => {
    if (!firestore || !currentProduct?.id) return null;
    return query(collection(firestore, 'products', currentProduct.id, 'comments'), orderBy('timestamp', 'asc'));
  }, [firestore, currentProduct]);

  const { data: comments, isLoading: areCommentsLoading } = useCollection<Comment>(commentsQuery);

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
  
  const handleAddComment = async (text: string) => {
    if (!user || !firestore || !currentProduct) return;

    const commentsRef = collection(firestore, 'products', currentProduct.id, 'comments');
    
    try {
      await addDoc(commentsRef, {
        text: text,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userAvatar: user.photoURL || `https://picsum.photos/seed/${user.uid}/40`,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.error("Error adding comment: ", e);
    }
  };


  useEffect(() => {
    setCurrentMediaIndex(0);
  }, [products]);

  return (
    <div className="relative h-full w-full bg-black text-white font-sans flex flex-col">
      
      {/* Hearts Animation */}
      <div className="pointer-events-none absolute inset-0 z-50">
          {hearts.map(h => (
          <span key={h.id} style={{ left: h.x - 16, top: h.y - 40 }} className="absolute animate-pop text-2xl">❤️</span>
          ))}
      </div>

      {/* Main Content Area */}
      <div className="relative w-full h-full flex-1">
          {/* Media Display */}
          <div className="absolute inset-0 z-0 w-full h-full bg-black flex items-center justify-center overflow-hidden">
              {currentMedia ? (
              currentMedia.type === 'video' ? (
                  <video className="w-full h-full object-cover" src={currentMedia.url} poster="" autoPlay muted loop playsInline key={currentMedia.url}></video>
              ) : (
                  <Image src={currentMedia.url} alt="Product" fill className="object-cover" key={currentMedia.url} unoptimized />
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
                      commentCount={comments?.length || 0}
                      productId={currentProduct.id}
                      onLike={spawnHeart}
                      onProductClick={() => setIsDrawerOpen(true)}
                      onCommentClick={() => setIsCommentDrawerOpen(true)}
                      onScroll={handleScroll} 
                  />
              </div>
          )}

          {/* Comments Feed (Bottom Left) */}
          <div className="absolute bottom-24 left-4 z-20 pointer-events-auto flex flex-col gap-2 max-h-48 overflow-y-auto">
              {comments?.slice(-5).map(c => (
                  <div key={c.id} className="bg-black/50 text-white px-3 py-2 rounded-xl text-sm shadow-lg backdrop-blur-sm max-w-xs">
                      <span className="font-bold mr-2">{c.userName}:</span>{c.text}
                  </div>
              ))}
          </div>

          {/* Product Info (Bottom Center) */}
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 pointer-events-auto w-full max-w-sm px-4">
              {currentProduct && <ProductInfo product={currentProduct} />}
          </div>
      </div>
      
        {/* Comment Input at the bottom */}
         <form onSubmit={(e) => {
            e.preventDefault();
            if (newComment.trim()) {
                handleAddComment(newComment.trim());
                setNewComment('');
            }
        }} className="p-4 bg-black/50 backdrop-blur-sm z-20 flex items-center gap-2">
            <Input 
                placeholder="Add a comment..." 
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-400"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
            />
            <Button type="submit" size="icon" variant="ghost">
                <Send className="h-5 w-5" />
            </Button>
        </form>

      {/* Product Drawer */}
      {currentProduct && (
          <ProductDrawer 
              product={currentProduct} 
              isOpen={isDrawerOpen} 
              onOpenChange={setIsDrawerOpen} 
          />
      )}
      <CommentDrawer
        comments={comments || []}
        isLoading={areCommentsLoading}
        isOpen={isCommentDrawerOpen}
        onOpenChange={setIsCommentDrawerOpen}
        onAddComment={handleAddComment}
      />
    </div>
  );
}
