
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import type { VideoFeedItem, Comment } from '@/lib/types';
import { VideoInfo } from './video-info';
import { VideoActions } from './video-actions';
import { ProductDrawer } from './product-drawer';
import { Button } from '../ui/button';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { ProductInfo } from '../live/product-info';
import { collection, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { CommentDrawer } from './comment-drawer';
import { ChevronLeft, ChevronRight, Video, Layers, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getPlaceholderImage } from '@/lib/placeholder-images';

interface VideoCardProps {
  item: VideoFeedItem;
  onScroll?: (direction: 'up' | 'down') => void;
  isIntersecting: boolean;
}

export function VideoCard({ item, onScroll, isIntersecting }: VideoCardProps) {
  const allMedia = useMemo(() => {
    const media: {url: string, type: 'video' | 'image'}[] = [];
    
    if (item.product) {
        if (item.product.videoUrl && item.product.videoUrl.trim() !== "") {
          media.push({ url: item.product.videoUrl, type: 'video' });
        }
        if (item.product.videoUrls && Array.isArray(item.product.videoUrls)) {
          item.product.videoUrls.forEach(url => {
            if (url && url.trim() !== "" && !media.some(m => m.url === url)) {
              media.push({ url, type: 'video' });
            }
          });
        }
        
        if (item.product.imageUrl && item.product.imageUrl.trim() !== "") {
          if (!media.some(m => m.url === item.product.imageUrl)) {
            media.push({ url: item.product.imageUrl, type: 'image' });
          }
        }
        if (item.product.imageUrls && Array.isArray(item.product.imageUrls)) {
          item.product.imageUrls.forEach(url => {
            if (url && url.trim() !== "" && !media.some(m => m.url === url)) {
              media.push({ url, type: 'image' });
            }
          });
        }
    }
    
    // FALLBACK: If no product media found, show seller's profile image instead of a placeholder text
    if (media.length === 0) {
        const sellerAvatar = item.seller?.avatar?.imageUrl;
        const sellerBanner = item.seller?.banner?.imageUrl;
        
        // Prioritize actual user/seller images as backgrounds for "empty" products
        if (sellerAvatar && sellerAvatar.trim() !== "" && !sellerAvatar.includes('text=')) {
            media.push({ url: sellerAvatar, type: 'image' });
        } else if (sellerBanner && sellerBanner.trim() !== "" && !sellerBanner.includes('text=')) {
            media.push({ url: sellerBanner, type: 'image' });
        } else {
            media.push({ url: getPlaceholderImage(), type: 'image' });
        }
    }

    return media;
  }, [item.product, item.seller]);

  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCommentDrawerOpen, setIsCommentDrawerOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useUser();
  const firestore = useFirestore();
  
  const currentMedia = allMedia[currentMediaIndex];

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || currentMedia?.type !== 'video') return;

    if (isIntersecting) {
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                if (error.name !== 'AbortError') {
                    console.warn("Autoplay prevented:", error);
                }
            });
        }
    } else {
        videoElement.pause();
        videoElement.currentTime = 0;
    }
  }, [isIntersecting, currentMedia]);
  
  useEffect(() => {
    setCurrentMediaIndex(0);
  }, [item.product.id]);

  const commentsQuery = useMemoFirebase(() => {
    if (!firestore || !item.product.id) return null;
    return query(collection(firestore, 'products', item.product.id, 'comments'), orderBy('timestamp', 'asc'));
  }, [firestore, item.product.id]);

  const { data: comments, isLoading: areCommentsLoading } = useCollection<Comment>(commentsQuery);

  const handleAddComment = async (text: string) => {
    if (!user || !firestore || !item.product.id) return; 
    try {
      await addDoc(collection(firestore, 'products', item.product.id, 'comments'), {
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

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (videoRef.current) videoRef.current.muted = newMutedState;
  };
  
  const handleHorizontalScroll = (direction: 'left' | 'right') => {
    if (direction === 'left') {
      setCurrentMediaIndex((prev) => (prev > 0 ? prev - 1 : allMedia.length - 1));
    } else {
      setCurrentMediaIndex((prev) => (prev < allMedia.length - 1 ? prev + 1 : 0));
    }
  };

  const handleDismiss = () => {
      if (onScroll) onScroll('down');
  };

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      {/* Dismiss/X Button */}
      <Button 
        onClick={handleDismiss}
        variant="ghost" 
        size="icon" 
        className="absolute top-20 right-4 z-50 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md border border-white/10 shadow-2xl"
      >
        <X className="h-5 w-5" />
      </Button>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentMedia?.url}
          className="absolute inset-0 z-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {currentMedia?.type === 'video' ? (
            <video 
              ref={videoRef}
              src={currentMedia.url}
              className="h-full w-full object-contain" 
              poster={item.product.imageUrl || getPlaceholderImage()}
              muted={isMuted}
              loop 
              playsInline
              key={currentMedia.url}
              onClick={toggleMute}
            />
          ) : (
            <div className="relative h-full w-full">
                <Image
                src={currentMedia?.url || getPlaceholderImage()}
                alt={item.product.name || 'Product item'}
                fill
                sizes="100vw"
                className="object-contain"
                priority
                />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

      {allMedia.length > 1 && (
        <>
          <Button 
            onClick={() => handleHorizontalScroll('left')} 
            size="icon" 
            variant="ghost" 
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/10 hover:bg-black/40 text-white border border-white/5 h-12 w-12"
          >
            <ChevronLeft className="h-8 w-8 opacity-50" />
          </Button>
          <Button 
            onClick={() => handleHorizontalScroll('right')} 
            size="icon" 
            variant="ghost" 
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/10 hover:bg-black/40 text-white border border-white/5 h-12 w-12"
          >
            <ChevronRight className="h-8 w-8 opacity-50" />
          </Button>
        </>
      )}
      
      <VideoInfo seller={item.seller} />

      {/* Horizontal Navigation Line (Segmented Progress Bar) */}
      {allMedia.length > 1 && (
        <div className="absolute bottom-[104px] left-4 right-16 z-20 flex gap-1 px-1">
          {allMedia.map((_, i) => (
            <div 
              key={i} 
              onClick={() => setCurrentMediaIndex(i)}
              className={cn(
                "h-0.5 flex-1 rounded-full transition-all duration-300 cursor-pointer shadow-sm",
                i === currentMediaIndex ? "bg-primary glow-primary" : "bg-white/30"
              )}
            />
          ))}
        </div>
      )}

       <div className="absolute bottom-6 left-4 right-16 z-10 pointer-events-auto">
            {item.product && <ProductInfo product={item.product} />}
       </div>

      <VideoActions 
        product={item.product}
        commentCount={comments?.length || 0}
        onProductClick={() => setIsDrawerOpen(true)}
        onCommentClick={() => setIsCommentDrawerOpen(true)}
        onScroll={onScroll}
        isMuted={isMuted}
        onMuteToggle={toggleMute}
      />

      <ProductDrawer 
        product={item.product}
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      />
      
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
