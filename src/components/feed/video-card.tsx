
'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { VideoFeedItem, Comment } from '@/lib/types';
import { VideoInfo } from './video-info';
import { VideoActions } from './video-actions';
import { ProductDrawer } from './product-drawer';
import { Button } from '../ui/button';
import Link from 'next/link';
import { useFirestore, useUser } from '@/firebase';
import { ProductInfo } from '../live/product-info';
import { doc, increment, writeBatch, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { CommentDrawer } from './comment-drawer';

interface VideoCardProps {
  item: VideoFeedItem;
  onScroll?: (direction: 'up' | 'down') => void;
}

export function VideoCard({ item, onScroll }: VideoCardProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCommentDrawerOpen, setIsCommentDrawerOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>(item.comments || []);
  const { user } = useUser();
  const firestore = useFirestore();

  const handleLike = () => {
    if (!firestore || !item.product.id) return;
    const productRef = doc(firestore, 'products', item.product.id);
    
    // Non-blocking update
    const batch = writeBatch(firestore);
    batch.update(productRef, { likes: increment(1) });
    batch.commit().catch(console.error);
  };

  const handleAddComment = async (text: string) => {
    if (!user) return; // Or prompt to login

    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      user: {
        name: user.displayName || 'Anonymous',
        avatar: {
          id: 'user-avatar',
          imageUrl: user.photoURL || 'https://picsum.photos/seed/avatar/40',
          description: 'User avatar',
          imageHint: 'user avatar'
        }
      },
      text: text,
    };

    setComments(prev => [...prev, newComment]);

    // This is where you would save the comment to Firestore.
    // Since there's no comments subcollection in the schema yet, this part is for demonstration.
    // try {
    //   const commentsRef = collection(firestore, 'products', item.product.id, 'comments');
    //   await addDoc(commentsRef, {
    //     text: newComment.text,
    //     userId: user.uid,
    //     userName: newComment.user.name,
    //     userAvatar: newComment.user.avatar.imageUrl,
    //     timestamp: serverTimestamp(),
    //   });
    // } catch (e) {
    //   console.error("Error adding comment: ", e);
    // }
  };


  return (
    <div className="relative h-full w-full bg-black">
      {item.video.mediaType === 'video' ? (
        <video 
          src={item.video.imageUrl} // imageUrl now holds the media URL
          className="h-full w-full object-cover" 
          autoPlay 
          muted 
          loop 
          playsInline
          key={item.video.imageUrl}
        />
      ) : (
        <Image
          src={item.video.imageUrl}
          alt={item.video.description || item.product.name || 'Product image'}
          fill
          className="object-cover"
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
        initialLikes={item.likes}
        commentCount={comments.length}
        onLike={handleLike}
        onProductClick={() => setIsDrawerOpen(true)}
        onCommentClick={() => setIsCommentDrawerOpen(true)}
        onScroll={onScroll}
      />

      <ProductDrawer 
        product={item.product}
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      />
      
      <CommentDrawer
        comments={comments}
        isOpen={isCommentDrawerOpen}
        onOpenChange={setIsCommentDrawerOpen}
        onAddComment={handleAddComment}
      />
    </div>
  );
}
