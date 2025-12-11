
'use client';

import { Button } from '@/components/ui/button';
import { MessageCircle, Share2, ShoppingBag, Volume2, VolumeX, ChevronUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, errorEmitter } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { useRouter } from 'next/navigation';
import type { Product } from '@/lib/types';


interface VideoActionsProps {
  product: Product;
  commentCount?: number;
  onProductClick?: () => void;
  onCommentClick?: () => void;
  onScroll?: (direction: 'up' | 'down') => void;
  isMuted: boolean;
  onMuteToggle: () => void;
}

export function VideoActions({
  product,
  commentCount = 0,
  onProductClick,
  onCommentClick,
  onScroll,
  isMuted,
  onMuteToggle,
}: VideoActionsProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();


  const handleShare = () => {
    const url = `https://goearnvid.shop/products/${product.id}`;
    navigator.clipboard.writeText(url).then(() => {
        toast({
            title: "Link Copied!",
            description: "The product link has been copied to your clipboard.",
        });
    }).catch(err => {
        console.error('Failed to copy: ', err);
        toast({
            variant: "destructive",
            title: "Failed to Copy",
            description: "Could not copy the link to your clipboard.",
        });
    });
  };

  const handleSaveToWishlist = () => {
    if (!user || !firestore) {
      toast({
        title: 'Please Log In',
        description: 'You need to be logged in to save items to your wishlist.',
        action: <Button onClick={() => router.push('/login')}>Login</Button>,
      });
      return;
    }

    const wishlistItemRef = doc(firestore, 'userProfiles', user.uid, 'wishlist', product.id);
    
    // Create a simple object with just the necessary info.
    const wishlistItemData = {
      productId: product.id,
      addedAt: serverTimestamp(),
    };

    setDoc(wishlistItemRef, wishlistItemData)
      .then(() => {
        toast({
          title: 'Saved to Wishlist!',
          description: `${product.name} has been added to your wishlist.`,
        });
      })
      .catch(error => {
        // Emit a detailed error for debugging.
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: wishlistItemRef.path,
            operation: 'write',
            requestResourceData: wishlistItemData,
          })
        );
        // Show a generic message to the user.
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not save to wishlist. Please try again.'
        });
      });
  };


  const handleScrollClick = (direction: 'up' | 'down') => {
    if (typeof onScroll === 'function') {
      onScroll(direction);
    } else {
      console.error('[Studio Debug] onScroll prop is not a function in VideoActions');
    }
  };

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-20">
      <div className="flex flex-col items-center">
        <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70" onClick={() => handleScrollClick('up')}>
          <ChevronUp className="h-6 w-6 text-white" />
        </Button>
      </div>
      <div className="flex flex-col items-center">
        <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70" onClick={onCommentClick}>
          <MessageCircle className="h-6 w-6 text-white" />
        </Button>
        <span className="text-sm font-semibold text-white drop-shadow-md">{commentCount}</span>
      </div>
      <div className="flex flex-col items-center">
        <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70" onClick={handleShare}>
          <Share2 className="h-6 w-6 text-white" />
        </Button>
      </div>
       <div className="flex flex-col items-center">
        <Button size="icon" variant="ghost" className="rounded-full bg-primary h-12 w-12 hover:bg-primary/80" onClick={onProductClick}>
          <ShoppingBag className="h-6 w-6 text-primary-foreground" />
        </Button>
      </div>
      <div className="flex flex-col items-center">
        <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70" onClick={onMuteToggle}>
          {isMuted ? <VolumeX className="h-6 w-6 text-white" /> : <Volume2 className="h-6 w-6 text-white" />}
        </Button>
      </div>
       <div className="flex flex-col items-center">
        <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70" onClick={() => handleScrollClick('down')}>
          <ChevronDown className="h-6 w-6 text-white" />
        </Button>
      </div>
    </div>
  );
}
