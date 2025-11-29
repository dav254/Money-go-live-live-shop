
'use client';

import type { Seller } from '@/lib/types';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MessageSquare, Plus, Share2 } from 'lucide-react';
import { SellerBadges } from './seller-badges';
import { ShopStoryHighlights } from './shop-story-highlights';
import { useUser, useFirestore, useUserProfile } from '@/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';

interface SellerHeaderProps {
  seller: Seller;
}

export function SellerHeader({ seller }: SellerHeaderProps) {
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (userProfile && userProfile.following && seller.id) {
      setIsFollowing(userProfile.following.includes(seller.id));
    }
  }, [userProfile, seller.id]);

  const handleApplyToResell = async () => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Please log in to apply.' });
      return;
    }
    setIsApplying(true);
    const applicationRef = doc(collection(firestore, 'resellerApplications'));
    try {
      await setDoc(applicationRef, {
        id: applicationRef.id,
        resellerId: user.uid,
        sellerId: seller.id,
        status: 'pending',
        applicationDate: serverTimestamp(),
      });
      toast({ title: 'Application Sent!', description: `Your request to resell for ${seller.name} has been sent.` });
    } catch (error) {
      console.error('Error creating reseller application:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not submit your application.' });
    } finally {
      setIsApplying(false);
    }
  };

  const handleFollow = async () => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Please log in to follow sellers.' });
      return;
    }

    const userProfileRef = doc(firestore, 'userProfiles', user.uid);
    const newFollowingState = !isFollowing;

    try {
      await updateDoc(userProfileRef, {
        following: newFollowingState ? arrayUnion(seller.id) : arrayRemove(seller.id),
      });
      // Note: We are not updating the seller's follower count here as that should
      // ideally be handled by a backend function for security and consistency.
      // The UI will update based on the user's "following" list.
      setIsFollowing(newFollowingState);
      toast({
        title: newFollowingState ? 'Followed!' : 'Unfollowed',
        description: `You are now ${newFollowingState ? 'following' : 'no longer following'} ${seller.name}.`,
      });
    } catch (error) {
      console.error('Error updating follow status:', error);
      toast({ variant: 'destructive', title: 'Something went wrong' });
    }
  };

  return (
    <div className="bg-neutral-950">
      <div className="relative h-48 md:h-64 w-full">
        <Image
          src={seller.banner.imageUrl}
          alt={`${seller.name}'s banner`}
          fill
          sizes="100vw"
          className="object-cover"
          priority
          data-ai-hint={seller.banner.imageHint}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 to-transparent" />
      </div>

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
        <div className="flex flex-col items-center text-center md:flex-row md:items-end md:text-left md:gap-6">
          <Avatar className="h-32 w-32 border-4 border-neutral-950">
            <AvatarImage src={seller.avatar.imageUrl} alt={seller.name} />
            <AvatarFallback>{seller.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="mt-4 md:mt-0 md:pb-4">
            <h1 className="font-headline text-3xl md:text-4xl font-bold">{seller.name}</h1>
            <div className="flex items-center justify-center md:justify-start gap-4 text-sm text-neutral-400 mt-1">
              <span>{seller.rating.toFixed(1)} Rating</span>
              <span className="font-bold">&middot;</span>
              <span>{seller.followers.toLocaleString()} Followers</span>
              <span className="font-bold">&middot;</span>
              <span>{seller.reviewsCount.toLocaleString()} Reviews</span>
            </div>
            <SellerBadges seller={seller} />
          </div>
        </div>

        <div className="mt-4 flex flex-col md:flex-row items-center justify-center md:justify-start gap-2">
          <Button onClick={handleFollow} className="w-full md:w-auto font-bold bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" />
            {isFollowing ? 'Following' : 'Follow'}
          </Button>
          {userProfile?.userRole === 'reseller' && (
            <Button onClick={handleApplyToResell} disabled={isApplying} variant="outline" className="w-full md:w-auto font-bold">
              {isApplying ? 'Submitting...' : 'Apply to Resell'}
            </Button>
          )}
          <Button variant="secondary" className="w-full md:w-auto font-bold">
            <MessageSquare className="mr-2 h-4 w-4" />
            Message
          </Button>
          <Button variant="secondary" className="w-full md:w-auto font-bold">
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        </div>

        <ShopStoryHighlights highlights={[]} />
      </div>
    </div>
  );
}
