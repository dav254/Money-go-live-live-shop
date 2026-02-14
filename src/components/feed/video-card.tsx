
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
import { ChevronLeft, ChevronRight, Video, Layers } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getPlaceholderImage } from '@/lib/placeholder-images';

interface VideoCardProps {
  item: VideoFeedItem;
  onScroll?: (direction: 'up' | 'down') => void;
  isIntersecting: boolean;
}

export function VideoCard({ item, onScroll, isIntersecting }: VideoCardProps) {
  // Collect all available media for the product to ensure nothing is hidden
  const allMedia = useMemo(() => {
    if (!item.product) return [{ url: getPlaceholderImage(), type: 'image' as const }];
    
    const media: {url: string, type: 'video' | 'image'}[] = [];
    
    // 1. Add all valid videos
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
    
    // 2. Add all valid images
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
    
    if (media.length === 0) {
        media.push({ url: getPlaceholderImage(), type: 'image' });
    }

    return media;
  }, [item.product]);

  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCommentDrawerOpen, setIsCommentDrawerOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useUser();
  const firestore = useFirestore();
  
  const currentMedia = allMedia[currentMediaIndex];

  // Auto-Cycle Media: If it's a static image, maybe move to next after 5s?
  // For now, we'll keep it manual but make thumbnails very prominent.

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

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      {/* Main Media Container */}
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

      {/* Navigation Layer */}
      {allMedia.length > 1 && (
        <>
          <Button 
            onClick={() => handleHorizontalScroll('left')} 
            size="icon" 
            variant="ghost" 
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/20 hover:bg-black/50 text-white border border-white/10 h-12 w-12"
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
          <Button 
            onClick={() => handleHorizontalScroll('right')} 
            size="icon" 
            variant="ghost" 
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/20 hover:bg-black/50 text-white border border-white/10 h-12 w-12"
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
          
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 p-2 rounded-full bg-black/20 backdrop-blur-md">
            {allMedia.map((_, i) => (
                <div 
                    key={i} 
                    className={cn(
                        "h-1.5 transition-all rounded-full",
                        i === currentMediaIndex ? "w-6 bg-primary shadow-lg shadow-primary/50" : "w-1.5 bg-white/30"
                    )}
                />
            ))}
          </div>
        </>
      )}
      
      <VideoInfo seller={item.seller} />

       {/* Media Thumbnails - HUD Style */}
       {allMedia.length > 1 && (
           <div className="absolute bottom-32 left-4 right-16 z-20 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
               {allMedia.map((media, index) => (
                   <button
                    key={index}
                    onClick={() => setCurrentMediaIndex(index)}
                    className={cn(
                        "relative h-14 w-14 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all transform hover:scale-105",
                        index === currentMediaIndex ? "border-primary scale-110 shadow-xl" : "border-white/10 opacity-60 grayscale-[50%]"
                    )}
                   >
                       {media.type === 'video' ? (
                           <div className="relative h-full w-full bg-neutral-800">
                               <video src={media.url} className="h-full w-full object-cover" muted />
                               <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                   <Video className="h-4 w-4 text-white drop-shadow-md" />
                               </div>
                           </div>
                       ) : (
                           <Image src={media.url || getPlaceholderImage()} alt="Preview" fill className="object-cover" />
                       )}
                   </button>
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
