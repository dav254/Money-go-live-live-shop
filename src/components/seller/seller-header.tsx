
'use client';

import type { Seller } from '@/lib/types';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Heart, MessageSquare, Plus, Share2 } from 'lucide-react';
import { SellerBadges } from './seller-badges';
import { ShopStoryHighlights } from './shop-story-highlights';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { useEffect, useState } from 'react';
import { Skeleton } from '../ui/skeleton';
import { useRouter } from 'next/navigation';


interface SellerHeaderProps {
  seller: Seller;
  isLoading?: boolean;
}

export function SellerHeader({ seller, isLoading }: SellerHeaderProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { userProfile } = useUserProfile(user?.uid);
  const [isFollowing, setIsFollowing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (userProfile && userProfile.following && seller) {
      setIsFollowing(userProfile.following.includes(seller.id));
    }
  }, [userProfile, seller]);

  const handleFollow = async () => {
    if (!user || !firestore || !seller) {
      toast({
        variant: 'destructive',
        title: 'Please log in to follow sellers.',
      });
      return;
    }

    const userProfileRef = doc(firestore, 'userProfiles', user.uid);
    const newFollowingState = !isFollowing;

    try {
      await updateDoc(userProfileRef, {
        following: newFollowingState
          ? arrayUnion(seller.id)
          : arrayRemove(seller.id),
      });
      setIsFollowing(newFollowingState);
      toast({
        title: newFollowingState ? 'Followed!' : 'Unfollowed',
        description: `You are now ${newFollowingState ? 'following' : 'no longer following'} ${seller.name}.`,
      });
    } catch (error) {
      console.error('Error updating follow status:', error);
      toast({
        variant: 'destructive',
        title: 'Something went wrong',
      });
    }
  };

  const handleMessage = async () => {
    if (!user || !firestore || !seller || user.uid === seller.id) {
        if (user && seller && user.uid === seller.id) {
            toast({
                variant: 'default',
                title: 'This is your own shop',
                description: "You cannot message yourself.",
            });
        } else {
            toast({
                variant: 'destructive',
                title: 'Please log in to message sellers.',
            });
        }
        return;
    }

    const chatsRef = collection(firestore, 'chats');
    // Firestore doesn't support array-contains-all, so we query for one participant and filter locally.
    // A more robust solution might involve a composite key of sorted participant IDs.
    const q = query(chatsRef, where('participantIds', 'array-contains', user.uid));
    
    try {
        const querySnapshot = await getDocs(q);
        let existingChat = null;

        querySnapshot.forEach(doc => {
            const chat = doc.data();
            if (chat.participantIds.includes(seller.id)) {
                existingChat = { id: doc.id, ...chat };
            }
        });
        
        if (existingChat) {
            // Chat exists, navigate to it. Pass seller ID to pre-select it on messages page.
            router.push(`/messages?chatWith=${seller.id}`);
        } else {
            // Chat doesn't exist, create it.
            const newChatRef = doc(collection(firestore, 'chats'));
            await setDoc(newChatRef, {
                id: newChatRef.id,
                participantIds: [user.uid, seller.id],
                lastMessage: `Started a conversation with ${seller.name}`,
                lastMessageTimestamp: serverTimestamp()
            });
             // Navigate to the new chat.
            router.push(`/messages?chatWith=${seller.id}`);
        }

    } catch (error) {
        console.error('Error handling message action:', error);
        toast({
            variant: 'destructive',
            title: 'Could not start chat',
            description: 'There was an error trying to start a conversation. Please try again later.'
        });
    }
  };
  
  if (isLoading || !seller) {
      return (
          <div className="relative w-full bg-neutral-900 text-white">
              <div className="relative h-48 w-full md:h-64">
                <Skeleton className="h-full w-full" />
              </div>
               <div className="relative -mt-16 px-4 pb-6 sm:px-6 lg:px-8">
                 <div className="flex flex-col items-center text-center md:flex-row md:items-end md:text-left">
                    <Skeleton className="relative h-32 w-32 flex-shrink-0 rounded-full border-4 border-neutral-900" />
                     <div className="mt-4 md:ml-6 md:mt-0 space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                 </div>
               </div>
          </div>
      )
  }


  return (
    <div className="relative w-full bg-neutral-900 text-white">
      {/* Banner Image */}
      <div className="relative h-48 w-full md:h-64">
        <Image
          src={seller.banner?.imageUrl || 'https://picsum.photos/seed/banner/1200/400'}
          alt={`${seller.name}'s banner`}
          fill
          className="object-cover"
          priority
          data-ai-hint={seller.banner?.imageHint}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/50 to-transparent" />
      </div>

      <div className="relative -mt-16 px-4 pb-6 sm:px-6 lg:px-8">
        {/* Avatar and Main Info */}
        <div className="flex flex-col items-center text-center md:flex-row md:items-end md:text-left">
          <div className="relative h-32 w-32 flex-shrink-0 rounded-full border-4 border-neutral-900">
            <Image
              src={seller.avatar?.imageUrl || 'https://picsum.photos/seed/avatar/200'}
              alt={`${seller.name}'s avatar`}
              fill
              className="object-cover rounded-full"
              data-ai-hint={seller.avatar?.imageHint}
            />
          </div>
          <div className="mt-4 md:ml-6 md:mt-0">
            <h1 className="font-headline text-3xl font-bold text-white">{seller.name}</h1>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-neutral-300 md:justify-start">
              <span>{(seller.followers || 0).toLocaleString()} followers</span>
              <span>&middot;</span>
              <span>{(seller.reviewsCount || 0).toLocaleString()} reviews</span>
              <span>&middot;</span>
              <span>{(seller.rating || 0).toFixed(1)} <span className="text-yellow-400">★</span></span>
            </div>
          </div>
        </div>

        {/* Badges */}
        <SellerBadges seller={seller} />

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 md:justify-start">
            <Button onClick={handleFollow} variant={isFollowing ? 'secondary' : 'default'} className="bg-primary hover:bg-primary/90">
                <Plus className={`mr-2 h-4 w-4 transition-transform ${isFollowing ? 'rotate-45' : ''}`} />
                {isFollowing ? 'Following' : 'Follow'}
            </Button>
            <Button variant="outline" className="border-neutral-700 hover:bg-neutral-800" onClick={handleMessage}>
                <MessageSquare className="mr-2 h-4 w-4" /> Message
            </Button>
             <Button variant="outline" className="border-neutral-700 hover:bg-neutral-800">
                <Share2 className="mr-2 h-4 w-4" /> Share
            </Button>
             <Button variant="outline" className="border-neutral-700 hover:bg-neutral-800">
                <Heart className="mr-2 h-4 w-4" /> Wishlist
            </Button>
        </div>
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <ShopStoryHighlights highlights={[]} />
      </div>
    </div>
  );
}
