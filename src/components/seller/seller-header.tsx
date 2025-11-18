
'use client';

import type { Seller } from '@/lib/types';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SellerBadges } from './seller-badges';
import { Star, Share2, MessageCircle } from 'lucide-react';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';


interface SellerHeaderProps {
  seller: Seller;
}

export function SellerHeader({ seller }: SellerHeaderProps) {
  const { user, isLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const handleChat = async () => {
    if (isLoading) return;

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

  const theme = seller.themeSettings || {};
  const accentColorClass = theme.accentColor ? `bg-${theme.accentColor}-500` : 'bg-primary';
  const buttonStyleClass = {
      'rounded': 'rounded-full',
      'square': 'rounded-none',
      'soft': 'rounded-lg'
  }[theme.buttonStyle || 'rounded'];


  return (
    <div className={cn("relative w-full", theme.darkMode ? 'dark text-white' : 'text-foreground')}>
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
            <div className="mt-2 flex items-center justify-center gap-4 text-neutral-300 md:justify-start">
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                <span className="font-semibold">{seller.rating}</span>
                <span>({seller.reviewsCount.toLocaleString()})</span>
              </div>
              <span className="font-semibold">{seller.followers.toLocaleString()} Followers</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex w-full flex-wrap justify-center gap-2 md:ml-auto md:mt-0 md:w-auto md:flex-nowrap">
            <Button className={cn("flex-1 text-white hover:bg-neutral-200 md:flex-initial font-bold", accentColorClass, buttonStyleClass)}>Follow</Button>
            <Button onClick={handleChat} variant="outline" className={cn("flex-1 border-neutral-700 bg-black/50 hover:bg-neutral-800 md:flex-initial font-bold", buttonStyleClass)}>
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
