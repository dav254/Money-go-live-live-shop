'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import type { VideoFeedItem, Comment } from '@/lib/types';
import { VideoActions } from './video-actions';
import { ProductDrawer } from './product-drawer';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { ProductInfo } from '../live/product-info';
import { collection, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { CommentDrawer } from './comment-drawer';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface VideoCardProps {
  item: VideoFeedItem;
  onScroll?: (direction: 'up' | 'down') => void;
  isIntersecting: boolean;
}

export function VideoCard({ item, onScroll, isIntersecting }: VideoCardProps) {
  const allMedia = useMemo(() => {
    const media: { url: string; type: 'video' | 'image' }[] = [];
    const product = item.product;

    if (product) {
      if (product.videoUrl?.trim()) media.push({ url: product.videoUrl.trim(), type: 'video' });
      product.videoUrls?.forEach((url) => {
        const normalizedUrl = url?.trim();
        if (normalizedUrl && !media.some((mediaItem) => mediaItem.url === normalizedUrl)) {
          media.push({ url: normalizedUrl, type: 'video' });
        }
      });
      if (product.imageUrl?.trim() && !media.some((mediaItem) => mediaItem.url === product.imageUrl.trim())) {
        media.push({ url: product.imageUrl.trim(), type: 'image' });
      }
      product.imageUrls?.forEach((url) => {
        const normalizedUrl = url?.trim();
        if (normalizedUrl && !media.some((mediaItem) => mediaItem.url === normalizedUrl)) {
          media.push({ url: normalizedUrl, type: 'image' });
        }
      });
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

  useEffect(() => {
    if (!isIntersecting || allMedia.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentMediaIndex((prev) => (prev + 1) % allMedia.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isIntersecting, allMedia.length]);

  useEffect(() => {
    setCurrentMediaIndex(0);
  }, [allMedia]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || currentMedia?.type !== 'video') return;
    if (isIntersecting) {
      videoElement.play().catch(() => undefined);
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
        text,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userAvatar: user.photoURL || '',
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-black group">
      <AnimatePresence mode="wait">
        {currentMedia ? (
          <motion.div key={currentMedia.url} className="absolute inset-0 z-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
            {currentMedia.type === 'video' ? (
              <video ref={videoRef} src={currentMedia.url} className="h-full w-full object-contain" muted={isMuted} loop playsInline onClick={() => setIsMuted(!isMuted)} />
            ) : (
              <div className="relative h-full w-full">
                <Image src={currentMedia.url} alt={item.product.name || 'Product'} fill className="object-contain" priority />
              </div>
            )}
          </motion.div>
        ) : (
          <div className="absolute inset-0 z-0 flex items-center justify-center bg-neutral-950 px-6 text-center">
            <p className="text-sm font-medium text-neutral-500">No image or video uploaded for this product.</p>
          </div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40" />

      {allMedia.length > 1 && (
        <div className="absolute bottom-[114px] left-4 right-16 z-20 flex gap-1 px-1">
          {allMedia.map((_, i) => <div key={i} className={cn('h-0.5 flex-1 rounded-full transition-all duration-500', i === currentMediaIndex ? 'bg-primary glow-primary' : 'bg-white/20')} />)}
        </div>
      )}

      <div className="absolute bottom-6 left-4 right-16 z-10"><ProductInfo product={item.product} /></div>
      <VideoActions product={item.product} commentCount={comments?.length || 0} onProductClick={() => setIsDrawerOpen(true)} onCommentClick={() => setIsCommentDrawerOpen(true)} onScroll={onScroll} isMuted={isMuted} onMuteToggle={() => setIsMuted(!isMuted)} />
      <ProductDrawer product={item.product} isOpen={isDrawerOpen} onOpenChange={setIsDrawerOpen} />
      <CommentDrawer comments={comments || []} isLoading={areCommentsLoading} isOpen={isCommentDrawerOpen} onOpenChange={setIsCommentDrawerOpen} onAddComment={handleAddComment} />
    </div>
  );
}
