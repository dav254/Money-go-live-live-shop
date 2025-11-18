
'use client';

import type { Seller } from '@/lib/types';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SellerBadges } from './seller-badges';
import { Star, Share2, MessageCircle, Check } from 'lucide-react';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError, useUserProfile } from '@/firebase';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, addDoc, serverTimestamp, writeBatch, doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';


interface SellerHeaderProps {
  seller: Seller;
}

export function SellerHeader({ seller }: SellerHeaderProps) {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(true);

  useEffect(() => {
    // Determine if the current user is following this seller
    setIsFollowLoading(true);
    if (userProfile && userProfile.following?.includes(seller.id)) {
      setIsFollowing(true);
    } else {
      setIsFollowing(false);
    }
    setIsFollowLoading(false);
  }, [userProfile, seller.id]);


  const handleFollow = async () => {
    if (isUserLoading || isProfileLoading) return;
    if (!user || !userProfile) {
        router.push('/login?redirect=/sellers/' + seller.id);
        return;
    }
    if (user.uid === seller.id) {
        toast({ title: "You cannot follow yourself." });
        return;
    }
    
    setIsFollowLoading(true);

    const userProfileRef = doc(firestore, 'userProfiles', user.uid);
    const sellerShopRef = doc(firestore, 'sellerShops', seller.id);
    
    try {
        if (isFollowing) {
            // Unfollow logic
            await updateDoc(userProfileRef, { following: arrayRemove(seller.id) });
            await updateDoc(sellerShopRef, { followers: increment(-1) });
            toast({ title: `Unfollowed ${seller.name}` });
            setIsFollowing(false);
        } else {
            // Follow logic
            await updateDoc(userProfileRef, { following: arrayUnion(seller.id) });
            await updateDoc(sellerShopRef, { followers: increment(1) });
            toast({ title: `You are now following ${seller.name}` });
            setIsFollowing(true);
        }
    } catch (error) {
        console.error("Error following/unfollowing seller:", error);
        toast({ variant: 'destructive', title: 'Something went wrong', description: 'Could not update your follow status. Please try again.' });
    } finally {
        setIsFollowLoading(false);
    }
  };


  const handleChat = async () => {
    if (isUserLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }
    
    if (user.uid === seller.id) {
        toast({ title: "This is your own shop", description: "You cannot start a chat with yourself." });
        return;
    }

    const chatsRef = collection(firestore, 'chats');
    
    // Check for existing chat
    const q1 = query(chatsRef, where('participantIds', '==', [user.uid, seller.id]));
    const q2 = query(chatsRef, where('participantIds', '==', [seller.id, user.uid]));

    const [querySnapshot1, querySnapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const existingChat = [...querySnapshot1.docs, ...querySnapshot2.docs];

    if (existingChat.length > 0) {
      // Chat already exists, redirect to messages page
      router.push('/messages');
    } else {
      // Create a new chat document
      const newChatData = {
        participantIds: [user.uid, seller.id],
        lastMessage: `Started a chat with ${seller.name}`,
        lastMessageTimestamp: serverTimestamp(),
      };

      // Non-blocking write with contextual error handling
      addDoc(chatsRef, newChatData)
        .then(async (newChatRef) => {
            // Also update the chat document with its own ID for easier reference
            const chatDocRef = doc(firestore, "chats", newChatRef.id);
            const batch = writeBatch(firestore);
            batch.update(chatDocRef, { id: newChatRef.id });
            await batch.commit();

            toast({ title: 'Chat started!', description: `You can now message ${seller.name}.`});
            router.push('/messages');
        })
        .catch((error) => {
            console.error('Error starting chat:', error);
            const permissionError = new FirestorePermissionError({
                path: chatsRef.path,
                operation: 'create',
                requestResourceData: newChatData
            });
            errorEmitter.emit('permission-error', permissionError);
            // We don't toast here because the global listener will throw.
        });
    }
  };

  return (
    <div className="relative w-full text-foreground">
      {/* Banner Image */}
      <div className="relative h-48 w-full md:h-64">
        <Image
          src={seller.banner.imageUrl}
          alt={`${seller.name}'s banner`}
          fill
          className="object-cover"
          data-ai-hint={seller.banner.imageHint}
          priority // Eager load the largest image
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
      </div>

      {/* Main Content */}
      <div className="relative -mt-12 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center md:flex-row md:items-end md:text-left">
          
          {/* Avatar */}
          <Avatar className="h-24 w-24 border-4 border-background md:h-32 md:w-32">
            <AvatarImage src={seller.avatar.imageUrl} alt={seller.name} data-ai-hint={seller.avatar.imageHint} />
            <AvatarFallback>{seller.name ? seller.name.slice(0, 2).toUpperCase() : 'S'}</AvatarFallback>
          </Avatar>

          {/* Seller Info */}
          <div className="mt-4 md:ml-6 md:mt-0">
            <div className="flex items-center justify-center gap-2 md:justify-start">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">{seller.name}</h1>
            </div>
            <div className="mt-2 flex items-center justify-center gap-4 text-neutral-300">
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                <span className="font-semibold text-white">{seller.rating}</span>
                <span className="text-white">({seller.reviewsCount.toLocaleString()})</span>
              </div>
              <span className="font-semibold text-white">{seller.followers.toLocaleString()} Followers</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex w-full flex-wrap justify-center gap-2 md:ml-auto md:mt-0 md:w-auto md:flex-nowrap">
            <Button
              onClick={handleFollow}
              disabled={isFollowLoading || user?.uid === seller.id}
              variant={isFollowing ? 'secondary' : 'default'}
              className="flex-1 md:flex-initial font-bold rounded-full text-white bg-primary hover:bg-primary/90"
            >
              {isFollowing ? (
                <>
                  <Check className="mr-2 h-4 w-4" /> Following
                </>
              ) : (
                'Follow'
              )}
            </Button>
            <Button onClick={handleChat} variant="outline" className="flex-1 border-neutral-700 bg-black/50 hover:bg-neutral-800 md:flex-initial font-bold rounded-full">
              <MessageCircle className="mr-2 h-4 w-4" /> Chat
            </Button>
            <Button variant="ghost" size="icon" className="hover:bg-neutral-800">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Bio and Badges */}
        <div className="mt-6 max-w-4xl mx-auto md:mx-0">
            <p className="text-center text-neutral-300 md:text-left">{seller.bio}</p>
            <SellerBadges seller={seller} />
        </div>
      </div>
    </div>
  );
}
