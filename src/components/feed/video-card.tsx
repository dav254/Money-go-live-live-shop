
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement && item.video.mediaType === 'video') {
      const handleCanPlay = () => {
        videoElement.play().catch(error => {
          // Autoplay was prevented, which is common. User interaction will be needed.
          console.error("Autoplay was prevented:", error);
        });
      };

      // Set the source
      if (videoElement.src !== item.video.imageUrl) {
        videoElement.src = item.video.imageUrl;
        videoElement.load();
      }

      // Add event listener to play when ready
      videoElement.addEventListener('canplay', handleCanPlay);

      // Clean up the event listener when the component unmounts or the video source changes
      return () => {
        videoElement.removeEventListener('canplay', handleCanPlay);
      };
    }
  }, [item.video.imageUrl, item.video.mediaType]);

  const commentsQuery = useMemoFirebase(() => {
    if (!firestore || !item.product.id) return null;
    return query(collection(firestore, 'products', item.product.id, 'comments'), orderBy('timestamp', 'asc'));
  }, [firestore, item.product.id]);

  const { data: comments, isLoading: areCommentsLoading } = useCollection<Comment>(commentsQuery);

  const handleLike = () => {
    if (!firestore || !item.product.id) return;
    const productRef = doc(firestore, 'products', item.product.id);
    
    // Non-blocking update for a simple action like a "like"
    const batch = writeBatch(firestore);
    batch.update(productRef, { likes: increment(1) });
    batch.commit().catch(console.error);
  };

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
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      // Set volume to 50% when unmuting for the first time
      if(isMuted && videoRef.current.volume === 1) {
          videoRef.current.volume = 0.5;
      }
    }
  };


  return (
    <div className="relative h-full w-full bg-black">
      {item.video.mediaType === 'video' ? (
        <video 
          ref={videoRef}
          src={item.video.imageUrl} // imageUrl now holds the media URL
          className="h-full w-full object-contain" 
          autoPlay 
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
        initialLikes={item.likes}
        commentCount={comments?.length || 0}
        onLike={handleLike}
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

    