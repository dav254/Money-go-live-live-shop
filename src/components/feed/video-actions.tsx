'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { MessageCircle, Share2, ShoppingBag, Heart, Bookmark, Send } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useUserProfile } from '@/firebase';
import { doc, increment, arrayUnion, arrayRemove, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/utils';

interface VideoActionsProps {
  product: Product;
  commentCount?: number;
  onProductClick?: () => void;
  onCommentClick?: () => void;
  messageHref?: string;
}

export function VideoActions({
  product,
  commentCount = 0,
  onProductClick,
  onCommentClick,
  messageHref,
}: VideoActionsProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const router = useRouter();

  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(product.likes || 0);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (userProfile?.wishlist?.includes(product.id)) setIsSaved(true);
    else setIsSaved(false);
  }, [userProfile, product.id]);

  const handleLike = async () => {
    if (!user || !firestore) {
      toast({
        title: 'Please log in to like videos.',
        action: <Button onClick={() => router.push('/login')}>Login</Button>,
      });
      return;
    }

    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikeCount((prev) => (newIsLiked ? prev + 1 : prev - 1));

    const productRef = doc(firestore, 'products', product.id);

    try {
      await updateDoc(productRef, { likes: increment(newIsLiked ? 1 : -1) });
    } catch (error) {
      console.error('Error updating like: ', error);
      setIsLiked(!newIsLiked);
      setLikeCount((prev) => (newIsLiked ? prev - 1 : prev + 1));
      toast({
        variant: 'destructive',
        title: 'Something went wrong',
        description: "Your like could not be saved.",
      });
    }
  };

  const handleSave = async () => {
    if (!user || !firestore) {
      toast({
        title: 'Please log in to save items.',
        action: <Button onClick={() => router.push('/login')}>Login</Button>,
      });
      return;
    }

    const newIsSaved = !isSaved;
    setIsSaved(newIsSaved);

    const userProfileRef = doc(firestore, 'userProfiles', user.uid);

    try {
      await updateDoc(userProfileRef, {
        wishlist: newIsSaved ? arrayUnion(product.id) : arrayRemove(product.id),
      });
      toast({
        title: newIsSaved ? 'Saved to Wishlist!' : 'Removed from Wishlist',
        description: newIsSaved
          ? "You can view this in your Saved Items."
          : 'Item has been removed.',
      });
    } catch (error) {
      console.error('Error updating wishlist: ', error);
      setIsSaved(!newIsSaved);
      toast({
        variant: 'destructive',
        title: 'Action Failed',
        description: "Could not update your wishlist.",
      });
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/products/${product.id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        toast({
          title: 'Link Copied!',
          description: 'The product link has been copied to your clipboard.',
        });
      })
      .catch((err) => {
        console.error('Failed to copy: ', err);
      });
  };

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-20">
      <div className="flex flex-col items-center">
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70"
          onClick={handleLike}
        >
          <Heart className={cn('h-6 w-6 text-white transition-colors', isLiked && 'fill-red-500 text-red-500')} />
        </Button>
        <span className="text-[10px] font-black text-white uppercase drop-shadow-md mt-1">
          {likeCount.toLocaleString()}
        </span>
      </div>

      <div className="flex flex-col items-center">
        <Button
          size="icon"
          variant="ghost"
          aria-label={isSaved ? 'Remove from saved' : 'Save'}
          aria-pressed={isSaved}
          className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70"
          onClick={handleSave}
        >
          <Bookmark className={cn('h-6 w-6 text-white transition-colors', isSaved && 'fill-primary text-primary')} />
        </Button>
      </div>

      <div className="flex flex-col items-center">
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70"
          onClick={onCommentClick}
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </Button>
        <span className="text-[10px] font-black text-white uppercase drop-shadow-md mt-1">{commentCount}</span>
      </div>

      <div className="flex flex-col items-center">
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70"
          onClick={handleShare}
        >
          <Share2 className="h-6 w-6 text-white" />
        </Button>
      </div>

      {messageHref && (
        <div className="flex flex-col items-center">
          <Button asChild size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70">
            <Link
              href={messageHref}
              aria-label={`Message the seller about ${product.name || 'this product'}`}
            >
              <Send className="h-6 w-6 text-white" />
            </Link>
          </Button>
          <span className="text-[10px] font-black text-white uppercase drop-shadow-md mt-1">CHAT</span>
        </div>
      )}

      <div className="flex flex-col items-center">
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full bg-primary h-12 w-12 hover:bg-primary/80 shadow-xl shadow-primary/20"
          onClick={onProductClick}
        >
          <ShoppingBag className="h-6 w-6 text-primary-foreground" />
        </Button>
      </div>
    </div>
  );
}
