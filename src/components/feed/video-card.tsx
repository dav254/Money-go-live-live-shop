
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import type { VideoFeedItem, Comment } from '@/lib/types';
import { VideoInfo } from './video-info';
import { VideoActions } from './video-actions';
import { ProductDrawer } from './product-drawer';
import { Button } from '../ui/button';
import Link from 'next/link';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { ProductInfo } from '../live/product-info';
import { doc, increment, writeBatch, collection, addDoc, serverTimestamp, query, orderBy, updateDoc } from 'firebase/firestore';
import { CommentDrawer } from './comment-drawer';
import { WifiOff, ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface VideoCardProps {
  item: VideoFeedItem;
  onScroll?: (direction: 'up' | 'down') => void;
}

export function VideoCard({ item, onScroll }: VideoCardProps) {
  const allMedia = useMemo(() => {
    if (!item.product) return [];
    
    const media: {url: string, type: 'video' | 'image'}[] = [];
    // Prioritize video
    if (item.product.videoUrl) media.push({ url: item.product.videoUrl, type: 'video' as 'video' });
    if (item.product.videoUrls) media.push(...item.product.videoUrls.map(url => ({ url, type: 'video' as 'video' })));
    
    // Then add images
    if (item.product.imageUrl) media.push({ url: item.product.imageUrl, type: 'image' as 'image' });
    if (item.product.imageUrls) media.push(...item.product.imageUrls.map(url => ({ url, type: 'image' as 'image' })));
    
    // Remove duplicates just in case
    const uniqueMedia = Array.from(new Map(media.map(m => [m.url, m])).values());
    
    // Fallback if no media is present
    if (uniqueMedia.length === 0) {
        uniqueMedia.push({ url: 'https://picsum.photos/seed/placeholder/1000/1000', type: 'image' });
    }

    return uniqueMedia;
  }, [item.product]);

  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCommentDrawerOpen, setIsCommentDrawerOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { user } = useUser();
  const firestore = useFirestore();
  
  const currentMedia = allMedia[currentMediaIndex];

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || currentMedia.type !== 'video') return;

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
        if (!videoElement.muted) {
            videoElement.muted = true;
            setIsMuted(true);
        }
    }
  }, [isIntersecting, currentMedia]);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry.isIntersecting),
      { threshold: 0.5 }
    );

    const currentCardRef = cardRef.current;
    if (currentCardRef) observer.observe(currentCardRef);
    return () => { if (currentCardRef) observer.unobserve(currentCardRef); };
  }, []);
  
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
    <div ref={cardRef} className="relative h-full w-full bg-black">
      <AnimatePresence initial={false}>
        <motion.div
          key={currentMedia.url}
          className="absolute inset-0 z-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {currentMedia.type === 'video' ? (
            <video 
              ref={videoRef}
              src={currentMedia.url}
              className="h-full w-full object-contain" 
              poster={item.product.imageUrl}
              muted={isMuted}
              loop 
              playsInline
              key={currentMedia.url} // Force re-mount on src change
              onClick={toggleMute}
            />
          ) : (
            <Image
              src={currentMedia.url}
              alt={item.video.description || item.product.name || 'Product image'}
              fill
              sizes="100vw"
              className="object-contain"
              priority
              data-ai-hint={item.video.imageHint}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

       {!isOnline && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
          <WifiOff className="h-12 w-12 text-destructive" />
          <p className="mt-4 font-semibold text-white">Connection Lost</p>
          <p className="text-sm text-muted-foreground">Reconnecting...</p>
        </div>
      )}

      {allMedia.length > 1 && (
        <>
          <Button onClick={() => handleHorizontalScroll('left')} size="icon" variant="ghost" className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/50 hover:bg-black/70"><ChevronLeft className="h-6 w-6 text-white" /></Button>
          <Button onClick={() => handleHorizontalScroll('right')} size="icon" variant="ghost" className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/50 hover:bg-black/70"><ChevronRight className="h-6 w-6 text-white" /></Button>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-1">
            {allMedia.map((_, i) => (
                <div key={i} className={`h-1.5 w-6 rounded-full ${i === currentMediaIndex ? 'bg-white' : 'bg-white/50'}`}/>
            ))}
          </div>
        </>
      )}
      
      <VideoInfo seller={item.seller} />

       <div className="absolute bottom-24 left-4 z-20 pointer-events-auto flex flex-col gap-2 max-h-48 overflow-y-auto">
           {comments?.slice(-5).map(c => (
               <div key={c.id} className="bg-black/50 text-white px-3 py-2 rounded-xl text-sm shadow-lg backdrop-blur-sm max-w-xs">
                   <span className="font-bold mr-2">{c.userName}:</span>{c.text}
               </div>
           ))}
       </div>

       <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-auto w-full max-w-sm px-4">
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
