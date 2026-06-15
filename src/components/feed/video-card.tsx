
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
import { X, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getPlaceholderImage } from '@/lib/placeholder-images';

interface VideoCardProps {
  item: VideoFeedItem;
  onScroll?: (direction: 'up' | 'down') => void;
  isIntersecting: boolean;
}

/**
 * Discovery Feed Hub: High-fidelity media cycling node.
 * Automatically rotates through all product media (images + videos) to maximize engagement.
 */
export function VideoCard({ item, onScroll, isIntersecting }: VideoCardProps) {
  // Intelligent Media Aggregator: Unifies all product assets into a single discoverable stream.
  const allMedia = useMemo(() => {
    const media: {url: string, type: 'video' | 'image'}[] = [];
    if (item.product) {
        // 1. Gather primary video
        if (item.product.videoUrl && item.product.videoUrl.trim() !== "") {
          media.push({ url: item.product.videoUrl, type: 'video' });
        }
        // 2. Gather video array
        if (item.product.videoUrls && Array.isArray(item.product.videoUrls)) {
          item.product.videoUrls.forEach(url => {
            if (url && url.trim() !== "" && !media.some(m => m.url === url)) {
              media.push({ url, type: 'video' });
            }
          });
        }
        // 3. Gather primary image
        if (item.product.imageUrl && item.product.imageUrl.trim() !== "") {
          if (!media.some(m => m.url === item.product.imageUrl)) {
            media.push({ url: item.product.imageUrl, type: 'image' });
          }
        }
        // 4. Gather image gallery
        if (item.product.imageUrls && Array.isArray(item.product.imageUrls)) {
          item.product.imageUrls.forEach(url => {
            if (url && url.trim() !== "" && !media.some(m => m.url === url)) {
              media.push({ url, type: 'image' });
            }
          });
        }
    }
    // Fallback if no media exists
    if (media.length === 0) media.push({ url: getPlaceholderImage(), type: 'image' });
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

  // Automated Cycling Engine: Rotates through media stack every 6 seconds when visible.
  useEffect(() => {
    if (!isIntersecting || allMedia.length <= 1) return;
    const interval = setInterval(() => {
        setCurrentMediaIndex((prev) => (prev + 1) % allMedia.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isIntersecting, allMedia.length]);

  // Real-time Video Playback Sync
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || currentMedia?.type !== 'video') return;
    if (isIntersecting) {
        videoElement.play().catch(() => {});
    } else {
        videoElement.pause();
        videoElement.currentTime = 0;
    }
  }, [isIntersecting, currentMedia]);

  const commentsQuery = useMemoFirebase(() => {
    if (!firestore || !item.product.id) return null;
    return query(collection(firestore, 'products', item.product.id, 'comments'), orderBy('timestamp', 'asc'));
  }, [firestore, item.product.id]);

  const { data: comments, isLoading: areCommentsLoading } = useCollection<Comment>(commentsQuery);

  const handleAddComment = async (text: string) => {
    if (!user || !firestore || !item.product.id) return; 
    try {
      await addDoc(collection(firestore, 'products', item.product.id, 'comments'), {
        text, userId: user.uid, userName: user.displayName || 'Anonymous',
        userAvatar: user.photoURL || `https://picsum.photos/seed/${user.uid}/40`,
        timestamp: serverTimestamp(),
      });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="relative h-full w-full bg-black overflow-hidden group">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentMedia?.url}
          className="absolute inset-0 z-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {currentMedia?.type === 'video' ? (
            <video 
              ref={videoRef}
              src={currentMedia.url}
              className="h-full w-full object-contain" 
              muted={isMuted}
              loop 
              playsInline
              onClick={() => setIsMuted(!isMuted)}
            />
          ) : (
            <div className="relative h-full w-full">
                <Image src={currentMedia?.url} alt="Product" fill className="object-contain" priority />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 pointer-events-none" />

      {/* Progress Bars for Media Stack */}
      {allMedia.length > 1 && (
        <div className="absolute bottom-[114px] left-4 right-16 z-20 flex gap-1 px-1">
          {allMedia.map((_, i) => (
            <div key={i} className={cn("h-0.5 flex-1 rounded-full transition-all duration-500", i === currentMediaIndex ? "bg-primary glow-primary" : "bg-white/20")} />
          ))}
        </div>
      )}

       <div className="absolute bottom-6 left-4 right-16 z-10">
            <ProductInfo product={item.product} />
       </div>

      <VideoActions 
        product={item.product}
        commentCount={comments?.length || 0}
        onProductClick={() => setIsDrawerOpen(true)}
        onCommentClick={() => setIsCommentDrawerOpen(true)}
        onScroll={onScroll}
        isMuted={isMuted}
        onMuteToggle={() => setIsMuted(!isMuted)}
      />

      <ProductDrawer product={item.product} isOpen={isDrawerOpen} onOpenChange={setIsDrawerOpen} />
      <CommentDrawer comments={comments || []} isLoading={areCommentsLoading} isOpen={isCommentDrawerOpen} onOpenChange={setIsCommentDrawerOpen} onAddComment={handleAddComment} />
    </div>
  );
}
