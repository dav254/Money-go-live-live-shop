
'use client';

import { useState, useRef, useEffect } from 'react';
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

interface VideoCardProps {
  item: VideoFeedItem;
  onScroll?: (direction: 'up' | 'down') => void;
}

export function VideoCard({ item, onScroll }: VideoCardProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCommentDrawerOpen, setIsCommentDrawerOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (isIntersecting) {
        videoElement.play().catch(error => {
            console.error("Autoplay was prevented:", error);
        });
    } else {
        videoElement.pause();
        videoElement.currentTime = 0; // Reset video on scroll away
        setIsMuted(true); // Mute when out of view
        videoElement.muted = true;
    }
  }, [isIntersecting, item.video.imageUrl]);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      { threshold: 0.5 } // Trigger when 50% of the video is visible
    );

    const currentCardRef = cardRef.current;
    if (currentCardRef) {
      observer.observe(currentCardRef);
    }

    return () => {
      if (currentCardRef) {
        observer.unobserve(currentCardRef);
      }
    };
  }, []);

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
    if (videoRef.current) {
      videoRef.current.muted = newMutedState;
    }
  };


  return (
    <div ref={cardRef} className="relative h-full w-full bg-black">
      {item.video.mediaType === 'video' ? (
        <video 
          ref={videoRef}
          src={item.video.imageUrl} // imageUrl now holds the media URL
          className="h-full w-full object-contain" 
          muted={isMuted}
          loop 
          playsInline
          key={item.video.imageUrl}
          onClick={toggleMute}
        />
      ) : (
        <Image
          src={item.video.imageUrl}
          alt={item.video.description || item.product.name || 'Product image'}
          fill
          sizes="100vw"
          className="object-contain"
          priority
          data-ai-hint={item.video.imageHint}
          key={item.video.imageUrl}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
      
      <VideoInfo seller={item.seller} viewers={item.viewers} />

       {/* Product Info (Bottom Center) */}
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
