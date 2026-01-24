'use client';

import { Button } from '@/components/ui/button';
import { MessageCircle, Share2, ShoppingBag, Volume2, VolumeX, ChevronUp, ChevronDown, Heart } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useUserProfile } from '@/firebase';
import { doc, writeBatch, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
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
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const router = useRouter(); // For redirecting non-logged-in users
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(product.likes || 0);

  // Set the initial liked state based on the user's profile
  useEffect(() => {
    if (userProfile?.wishlist?.includes(product.id)) {
      setIsLiked(true);
    } else {
      setIsLiked(false);
    }
  }, [userProfile, product.id]);

  const handleLike = async () => {
    if (!user || !firestore) {
        toast({
            title: "Please log in to like videos.",
            action: <Button onClick={() => router.push('/login')}>Login</Button>
        });
        return;
    }
    
    const newIsLiked = !isLiked;

    // Optimistic UI updates
    setIsLiked(newIsLiked);
    setLikeCount(prev => newIsLiked ? prev + 1 : prev - 1);

    const productRef = doc(firestore, 'products', product.id);
    const userProfileRef = doc(firestore, 'userProfiles', user.uid);

    try {
        const batch = writeBatch(firestore);
        
        if (newIsLiked) {
            batch.update(productRef, { likes: increment(1) });
            batch.update(userProfileRef, { wishlist: arrayUnion(product.id) });
        } else {
            batch.update(productRef, { likes: increment(-1) });
            batch.update(userProfileRef, { wishlist: arrayRemove(product.id) });
        }

        await batch.commit();

    } catch (error) {
        console.error("Error updating like: ", error);
        // Revert optimistic updates on failure
        setIsLiked(!newIsLiked);
        setLikeCount(prev => newIsLiked ? prev - 1 : prev + 1);
        toast({
            variant: "destructive",
            title: "Something went wrong",
            description: "Your like could not be saved. Please try again.",
        });
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/products/${product.id}`;
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
        <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70" onClick={handleLike}>
          <Heart className={`h-6 w-6 text-white transition-colors ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
        </Button>
        <span className="text-sm font-semibold text-white drop-shadow-md">{likeCount.toLocaleString()}</span>
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
