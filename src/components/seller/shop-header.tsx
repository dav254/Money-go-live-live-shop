'use client';

import type { Seller } from '@/lib/types';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Share2, Facebook, Instagram, Twitter, MessageCircle, MessageSquare, Verified } from 'lucide-react';
import { SellerBadges } from './seller-badges';
import { ShopStoryHighlights } from './shop-story-highlights';
import { useUser, useFirestore, useUserProfile } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SellerHeaderProps {
  seller: Seller;
}

export function SellerHeader({ seller }: SellerHeaderProps) {
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (userProfile && userProfile.following && seller.id) {
      setIsFollowing(userProfile.following.includes(seller.id));
    }
  }, [userProfile, seller.id]);

  const handleFollow = async () => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Please log in to follow sellers.' });
      return;
    }

    const newFollowingState = !isFollowing;
    setIsFollowing(newFollowingState);

    try {
        const token = await user.getIdToken();
        const response = await fetch('/api/follow', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sellerId: seller.id,
                action: newFollowingState ? 'follow' : 'unfollow',
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to update follow status.');
        }

        toast({
            title: newFollowingState ? 'Followed!' : 'Unfollowed',
            description: `You are now ${newFollowingState ? 'following' : 'no longer following'} ${seller.name}.`,
        });

    } catch (error) {
        console.error('Error updating follow status:', error);
        setIsFollowing(!newFollowingState);
        toast({ variant: 'destructive', title: 'Something went wrong' });
    }
  };
  
    const handleMessageSeller = async () => {
        if (!user || !firestore) {
            toast({ title: 'Please log in', description: 'You need to be logged in to send a message.' });
            router.push('/login');
            return;
        }
        if (seller.id === user.uid) {
            toast({ title: 'Cannot start chat', description: 'You cannot message yourself.' });
            return;
        }

        const chatsRef = collection(firestore, 'chats');
        const q = query(chatsRef, where('participantIds', 'array-contains', user.uid));
        
        try {
            const querySnapshot = await getDocs(q);
            let existingChatId: string | null = null;
            querySnapshot.forEach(doc => {
                // Same guard as the live and request flows: a chat document is
                // not guaranteed to carry `participantIds`, and reading it
                // unguarded throws on any legacy record that omits it.
                const ids: string[] = doc.data().participantIds ?? [];
                if (ids.includes(seller.id)) {
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
                    lastMessage: 'Conversation started.',
                    lastMessageTimestamp: serverTimestamp(),
                });
                router.push(`/messages?chatWith=${seller.id}`);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not start chat.' });
        }
    };
  
  const handleShare = () => {
    const shopUrl = `https://goearnvid.shop/sellers/${seller.id}`;
    navigator.clipboard.writeText(shopUrl).then(() => {
      toast({
        title: "Link Copied!",
        description: "The shop link has been copied to your clipboard.",
      });
    }).catch(err => {
      console.error('Failed to copy shop link: ', err);
      toast({
        variant: "destructive",
        title: "Failed to Copy",
        description: "Could not copy the shop link.",
      });
    });
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
        <div className="flex flex-col items-center text-center md:flex-row md:items-end md:gap-6">
          <Avatar className="h-32 w-32 border-4 border-neutral-950 shadow-2xl">
            <AvatarImage src={seller.avatar.imageUrl} alt={seller?.name || 'Seller avatar'} />
            <AvatarFallback className="bg-neutral-800 text-2xl font-black">{seller.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="mt-4 md:mt-0 md:pb-4">
            <div className="flex items-center justify-center md:justify-start gap-2">
                <h1 className="font-headline text-3xl md:text-4xl font-black text-white uppercase tracking-tighter">{seller.name}</h1>
                {seller.isVerified && <Verified className="h-6 w-6 text-blue-400 fill-current" />}
            </div>
            <div className="flex items-center justify-center md:justify-start gap-4 text-sm text-neutral-400 mt-1">
              <span className="font-bold uppercase tracking-widest text-[10px]">{(seller.followers || 0).toLocaleString()} Followers</span>
            </div>
            <SellerBadges seller={seller} />
            
            <div className="flex items-center justify-center md:justify-start gap-3 mt-4">
                {seller.facebookUrl && (
                    <a href={seller.facebookUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 hover:bg-blue-600 rounded-lg text-white transition-all">
                        <Facebook className="h-4 w-4" />
                    </a>
                )}
                {seller.instagramUrl && (
                    <a href={seller.instagramUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 hover:bg-pink-600 rounded-lg text-white transition-all">
                        <Instagram className="h-4 w-4" />
                    </a>
                )}
                {seller.twitterUrl && (
                    <a href={seller.twitterUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 hover:bg-sky-500 rounded-lg text-white transition-all">
                        <Twitter className="h-4 w-4" />
                    </a>
                )}
                {seller.contactWhatsapp && (
                    <a href={`https://wa.me/${seller.contactWhatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 hover:bg-green-600 rounded-lg text-white transition-all">
                        <MessageCircle className="h-4 w-4" />
                    </a>
                )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center md:justify-start gap-3">
          <Button onClick={handleFollow} className={cn("h-11 px-8 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all", isFollowing ? "bg-neutral-800 text-white hover:bg-neutral-700" : "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20")}>
            {isFollowing ? 'FOLLOWING' : 'FOLLOW STORE'}
          </Button>
          <Button onClick={handleMessageSeller} variant="secondary" className="h-11 px-6 font-black uppercase tracking-widest text-[10px] rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10">
            <MessageSquare className="mr-2 h-3.5 w-3.5" />
            MESSAGE
          </Button>
          <Button onClick={handleShare} variant="secondary" className="h-11 px-6 font-black uppercase tracking-widest text-[10px] rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10">
            <Share2 className="mr-2 h-3.5 w-3.5" />
            SHARE SHOP
          </Button>
        </div>

        <ShopStoryHighlights highlights={[]} />
      </div>
    </div>
  );
}
