
'use client';

import type { Seller } from '@/lib/types';
import NextImage from 'next/image';
import { Button } from '@/components/ui/button';
import { MessageSquare, Plus, Share2 } from 'lucide-react';
import { SellerBadges } from './seller-badges';
import { ShopStoryHighlights } from './shop-story-highlights';
import { useUser, useFirestore, useUserProfile } from '@/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { Skeleton } from '../ui/skeleton';
import { useRouter } from 'next/navigation';


interface SellerHeaderProps {
  seller: Seller;
  isLoading?: boolean;
}

export function SellerHeader({ seller, isLoading }: SellerHeaderProps) {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const [isFollowing, setIsFollowing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (userProfile && userProfile.following && seller) {
      setIsFollowing(userProfile.following.includes(seller.id));
    }
  }, [userProfile, seller]);

  const handleFollow = async () => {
    if (!user) {
        toast({
            title: 'Authentication Required',
            description: 'Please log in to follow sellers.',
        });
        return;
    }
    if (!firestore || !seller) return;

    // Optimistic UI update
    setIsFollowing(!isFollowing);

    try {
        const token = await user.getIdToken();
        const response = await fetch('/api/follow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                sellerId: seller.id,
                action: isFollowing ? 'unfollow' : 'follow'
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update follow status.');
        }

        toast({
            title: !isFollowing ? 'Followed!' : 'Unfollowed',
            description: `You are now ${!isFollowing ? 'following' : 'no longer following'} ${seller.name}.`,
        });

    } catch (error) {
        console.error('Follow action failed:', error);
        // Revert optimistic update on failure
        setIsFollowing(isFollowing); 
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not complete the action. Please try again.',
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
    const q = query(chatsRef, where('participantIds', 'array-contains', user.uid));
    
    try {
        const querySnapshot = await getDocs(q);
        let existingChatId: string | null = null;

        querySnapshot.forEach(doc => {
            const chat = doc.data();
            if (chat.participantIds.includes(seller.id)) {
                existingChatId = doc.id;
            }
        });
        
        if (existingChatId) {
            router.push(`/messages?chatWith=${seller.id}`);
        } else {
            const newChatRef = doc(collection(firestore, 'chats'));
            await setDoc(newChatRef, {
                id: newChatRef.id,
                participantIds: [user.uid, seller.id],
                lastMessage: `Started a conversation with ${seller.name}`,
                lastMessageTimestamp: serverTimestamp()
            });
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

  const handleShare = () => {
    if (!seller) return;
    const url = `https://goearnvid.shop/sellers/${seller.id}`;
    navigator.clipboard.writeText(url).then(() => {
        toast({
            title: "Link Copied!",
            description: "A shareable link to this shop has been copied to your clipboard.",
        });
    }).catch(err => {
        console.error('Failed to copy: ', err);
        toast({
            variant: "destructive",
            title: "Failed to Copy",
            description: "Could not copy the link.",
        });
    });
  };
  
  const loading = isLoading || isUserLoading || isProfileLoading;
  
  if (loading || !seller) {
      return (
          <div className="border-b border-neutral-800 bg-neutral-950 pb-4">
              <div className="relative h-32 md:h-48 w-full bg-muted">
                <Skeleton className="h-full w-full" />
              </div>
               <div className="relative -mt-12 md:-mt-16 px-4 pb-6 sm:px-6 lg:px-8">
                 <div className="flex flex-col items-center text-center md:flex-row md:items-end md:text-left">
                    <Skeleton className="relative h-24 w-24 md:h-32 md:w-32 flex-shrink-0 rounded-full border-4 border-neutral-950" />
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
    <div className="border-b border-neutral-800 bg-neutral-950 pb-4">
      {/* Banner Image */}
      <div className="relative h-32 md:h-48 w-full bg-muted">
        <NextImage
          src={seller.banner?.imageUrl || 'https://picsum.photos/seed/banner/1200/400'}
          alt={`${seller.name}'s banner`}
          fill
          className="object-cover"
          priority
          data-ai-hint={seller.banner?.imageHint}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/50 to-transparent" />
      </div>

      <div className="relative -mt-12 md:-mt-16 px-4 pb-6 sm:px-6 lg:px-8">
        {/* Avatar and Main Info */}
        <div className="flex flex-col items-center text-center md:flex-row md:items-end md:text-left">
          <div className="relative h-24 w-24 md:h-32 md:w-32 flex-shrink-0 rounded-full border-4 border-neutral-950">
            <NextImage
              src={seller.avatar?.imageUrl || 'https://picsum.photos/seed/avatar/200'}
              alt={`${seller.name}'s avatar`}
              fill
              className="object-cover rounded-full"
              data-ai-hint={seller.avatar?.imageHint}
            />
          </div>
          <div className="mt-4 md:ml-6 md:mt-0">
            <h1 className="font-headline text-2xl md:text-3xl font-bold text-white">{seller.name}</h1>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-neutral-300 md:justify-start">
              <span>{seller.followers.toLocaleString()} followers</span>
              <span>&middot;</span>
              <span>{(seller.reviewsCount || 0).toLocaleString()} reviews</span>
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
             <Button variant="outline" className="border-neutral-700 hover:bg-neutral-800" onClick={handleShare}>
                <Share2 className="mr-2 h-4 w-4" /> Share
            </Button>
        </div>
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <ShopStoryHighlights highlights={[]} />
      </div>
    </div>
  );
}
