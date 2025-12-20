
'use client';

import { Button } from '@/components/ui/button';
import { MessageCircle, Share2, ShoppingBag, Volume2, VolumeX, ChevronUp, ChevronDown, Heart } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError, useUserProfile } from '@/firebase';
import { doc, setDoc, serverTimestamp, deleteDoc, updateDoc, increment } from 'firebase/firestore';
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
  const { userProfile } = useUserProfile(user?.uid);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
      // Check if the product is in the user's wishlist
      if (userProfile?.wishlist?.includes(product.id)) {
          setIsLiked(true);
      } else {
          setIsLiked(false);
      }
  }, [userProfile, product.id]);


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

  const handleLikeToggle = async () => {
    if (!user || !firestore) {
      toast({
        title: 'Please Log In',
        description: 'You need to be logged in to save items to your wishlist.',
        action: <Button onClick={() => router.push('/login')}>Login</Button>,
      });
      return;
    }

    const wishlistItemRef = doc(firestore, 'userProfiles', user.uid, 'wishlist', product.id);
    const productRef = doc(firestore, 'products', product.id);
    
    const newLikedState = !isLiked;
    setIsLiked(newLikedState); // Optimistically update UI

    try {
        if (newLikedState) {
            // Add to wishlist and increment like count
            await setDoc(wishlistItemRef, {
              productId: product.id,
              addedAt: serverTimestamp(),
            });
            await updateDoc(productRef, { likes: increment(1) });
            toast({ title: 'Saved to Wishlist!' });
        } else {
            // Remove from wishlist and decrement like count
            await deleteDoc(wishlistItemRef);
            await updateDoc(productRef, { likes: increment(-1) });
            toast({ title: 'Removed from Wishlist' });
        }
    } catch (e) {
        setIsLiked(!newLikedState); // Revert UI on error
        console.error("Error updating wishlist:", e);
        toast({ variant: 'destructive', title: 'Something went wrong', description: 'Could not update your wishlist.'});
    }
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
        <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70" onClick={handleLikeToggle}>
          <Heart className={`h-6 w-6 text-white transition-colors ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
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
