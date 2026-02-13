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
import { ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getPlaceholderImage } from '@/lib/placeholder-images';

interface VideoCardProps {
  item: VideoFeedItem;
  onScroll?: (direction: 'up' | 'down') => void;
  isIntersecting: boolean;
}

export function VideoCard({ item, onScroll, isIntersecting }: VideoCardProps) {
  // Collect all available media for the product
  const allMedia = useMemo(() => {
    if (!item.product) return [];
    
    const media: {url: string, type: 'video' | 'image'}[] = [];
    
    // Add primary video if exists
    if (item.product.videoUrl) {
      media.push({ url: item.product.videoUrl, type: 'video' });
    }
    
    // Add additional videos
    if (item.product.videoUrls && Array.isArray(item.product.videoUrls)) {
      item.product.videoUrls.forEach(url => {
        if (url && !media.some(m => m.url === url)) {
          media.push({ url, type: 'video' });
        }
      });
    }
    
    // Add primary image
    if (item.product.imageUrl) {
      if (!media.some(m => m.url === item.product.imageUrl)) {
        media.push({ url: item.product.imageUrl, type: 'image' });
      }
    }
    
    // Add additional images
    if (item.product.imageUrls && Array.isArray(item.product.imageUrls)) {
      item.product.imageUrls.forEach(url => {
        if (url && !media.some(m => m.url === url)) {
          media.push({ url, type: 'image' });
        }
      });
    }
    
    // Fallback if no media is present
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

  // Handle Autoplay and Muting
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || currentMedia?.type !== 'video') return;

    if (isIntersecting) {
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                if (error.name !== 'AbortError') {
                    console.error("Autoplay was prevented:", error);
                }
            });
        }
    } else {
        videoElement.pause();
        videoElement.currentTime = 0;
    }
  }, [isIntersecting, currentMedia]);
  
  // Reset media index when product changes
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

    const commentsRef = collection(firestore, 'products', item.product.id, 'comments');
    
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
          transition={{ duration: 0.3 }}
        >
          {currentMedia?.type === 'video' ? (
            <video 
              ref={videoRef}
              src={currentMedia.url}
              className="h-full w-full object-contain" 
              poster={item.product.imageUrl}
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

      {/* Overlay Gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40 pointer-events-none" />

      {/* Horizontal Navigation Controls */}
      {allMedia.length > 1 && (
        <>
          <Button 
            onClick={() => handleHorizontalScroll('left')} 
            size="icon" 
            variant="ghost" 
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/30 hover:bg-black/50 text-white"
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
          <Button 
            onClick={() => handleHorizontalScroll('right')} 
            size="icon" 
            variant="ghost" 
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/30 hover:bg-black/50 text-white"
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
          
          {/* Media Indicators (Dots) */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 p-2 rounded-full bg-black/20 backdrop-blur-sm">
            {allMedia.map((_, i) => (
                <div 
                    key={i} 
                    className={cn(
                        "h-1.5 transition-all rounded-full",
                        i === currentMediaIndex ? "w-6 bg-primary" : "w-1.5 bg-white/50"
                    )}
                />
            ))}
          </div>
        </>
      )}
      
      {/* Seller Info (Top Left) */}
      <VideoInfo seller={item.seller} />

      {/* Comments Feed Snippet (Bottom Left) */}
       <div className="absolute bottom-40 left-4 z-20 pointer-events-none flex flex-col gap-2 max-h-32 overflow-hidden">
           {comments?.slice(-3).map(c => (
               <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                key={c.id} 
                className="bg-black/40 text-white px-3 py-1.5 rounded-xl text-xs shadow-lg backdrop-blur-md max-w-[240px] border border-white/5"
               >
                   <span className="font-bold mr-2 text-primary">{c.userName}:</span>{c.text}
               </motion.div>
           ))}
       </div>

       {/* Media Previews / Thumbnails (Bottom Left, above product info) */}
       {allMedia.length > 1 && (
           <div className="absolute bottom-32 left-4 z-20 flex gap-2">
               {allMedia.map((media, index) => (
                   <button
                    key={index}
                    onClick={() => setCurrentMediaIndex(index)}
                    className={cn(
                        "relative h-12 w-12 rounded-lg overflow-hidden border-2 transition-all transform hover:scale-110",
                        index === currentMediaIndex ? "border-primary scale-110 shadow-lg" : "border-white/20 opacity-70"
                    )}
                   >
                       {media.type === 'video' ? (
                           <div className="relative h-full w-full bg-neutral-800">
                               <video src={media.url} className="h-full w-full object-cover" muted />
                               <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                   <Video className="h-4 w-4 text-white" />
                               </div>
                           </div>
                       ) : (
                           <Image src={media.url} alt="Preview" fill className="object-cover" />
                       )}
                   </button>
               ))}
           </div>
       )}

       {/* Floating Product Info Card (Bottom) */}
       <div className="absolute bottom-6 left-4 right-16 z-10 pointer-events-auto">
            {item.product && <ProductInfo product={item.product} />}
       </div>

      {/* Side Action Buttons */}
      <VideoActions 
        product={item.product}
        commentCount={comments?.length || 0}
        onProductClick={() => setIsDrawerOpen(true)}
        onCommentClick={() => setIsCommentDrawerOpen(true)}
        onScroll={onScroll}
        isMuted={isMuted}
        onMuteToggle={toggleMute}
      />

      {/* Overlays/Drawers */}
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
