
'use client';

import { useState, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { MoreVertical, Package, Phone, Send, Video } from 'lucide-react';
import type { Chat, ChatMessage, Product, UserProfile } from '@/lib/types';
import type { User } from 'firebase/auth';
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, useUserProfile } from '@/firebase';
import { collection, addDoc, serverTimestamp, orderBy, query, where } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import Image from 'next/image';

interface ChatWindowProps {
  chat: Chat | null;
  currentUser: User | null;
}

const ProductCard = () => (
     <div className="max-w-xs rounded-lg border bg-background p-3 shadow-sm">
        <div className="flex gap-3">
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md">
                <Avatar className="h-full w-full rounded-none">
                     <AvatarImage src="https://picsum.photos/seed/handbag/150/150" alt="product" />
                </Avatar>
            </div>
            <div>
                <p className="font-semibold">Classic Leather Handbag</p>
                <p className="text-sm font-bold text-primary">KES 850</p>
                <Button size="sm" className="mt-1 h-7">View Product</Button>
            </div>
        </div>
    </div>
);


const ShareProductDialog = ({ sellerId }: { sellerId: string }) => {
    const firestore = useFirestore();

    const productsQuery = useMemoFirebase(() => {
        return query(collection(firestore, 'products'), where('sellerId', '==', sellerId));
    }, [firestore, sellerId]);

    const { data: products, isLoading } = useCollection<Product>(productsQuery);

    return (
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Share a Product</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-96">
                <div className="space-y-4 p-4">
                    {isLoading && <p>Loading your products...</p>}
                    {products && products.length === 0 && <p>You have no products to share.</p>}
                    {products?.map(product => (
                        <div key={product.id} className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted">
                            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md">
                                <Image src={product.image?.imageUrl || '/placeholder.svg'} alt={product.name || 'Product image'} fill className="object-cover" />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold">{product.name}</p>
                                <p className="text-sm text-primary">{product.price.toLocaleString()}</p>
                            </div>
                            <Button size="sm">Share</Button>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </DialogContent>
    )
}


export function ChatWindow({ chat, currentUser }: ChatWindowProps) {
  const [newMessage, setNewMessage] = useState('');
  const firestore = useFirestore();
  const { userProfile } = useUserProfile(currentUser?.uid);

  const messagesQuery = useMemoFirebase(() => {
    if (!chat) return null;
    return query(collection(firestore, 'chats', chat.id, 'messages'), orderBy('timestamp', 'asc'));
  }, [firestore, chat]);

  const { data: messages, isLoading: isLoadingMessages } = useCollection<ChatMessage>(messagesQuery);
  
  const handleSendMessage = async () => {
    if (!chat || !currentUser || !newMessage.trim()) return;

    const messagesCollectionRef = collection(firestore, 'chats', chat.id, 'messages');
    const messageData = {
      senderId: currentUser.uid,
      messageText: newMessage.trim(),
      timestamp: serverTimestamp(),
    };

    try {
      addDoc(messagesCollectionRef, messageData).catch(error => {
          const permissionError = new FirestorePermissionError({
              path: messagesCollectionRef.path,
              operation: 'create',
              requestResourceData: messageData
          });
          errorEmitter.emit('permission-error', permissionError);
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };


  if (!chat || !currentUser) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center bg-muted/20">
        <p className="text-muted-foreground">Select a conversation to start chatting</p>
      </div>
    );
  }

  const otherParticipant = chat.otherParticipant;
  const isSeller = userProfile?.userRole === 'seller';

  return (
    <div className="flex h-full flex-1 flex-col">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 border">
            <AvatarImage src={otherParticipant?.profilePictureUrl} alt={otherParticipant?.fullName} />
            <AvatarFallback>{otherParticipant?.fullName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{otherParticipant?.fullName}</p>
            <p className="text-sm text-muted-foreground">Online</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 bg-muted/10">
        <div className="p-4 space-y-6">
          {isLoadingMessages && <p className="text-center text-muted-foreground">Loading messages...</p>}
          {messages?.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.senderId === currentUser.uid ? "justify-end" : "justify-start")}>
              <div className={cn("flex max-w-sm flex-col gap-1", msg.senderId === currentUser.uid ? "items-end" : "items-start")}>
                <div className={cn(
                  "rounded-xl p-3 text-sm shadow-sm",
                  msg.senderId === currentUser.uid
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-card border rounded-bl-none"
                )}>
                  <p>{msg.messageText}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
            {/* Placeholder for shared product */}
             <div className="flex justify-start">
                <ProductCard />
            </div>
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t bg-background p-3">
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="relative">
             {isSeller && (
                <Dialog>
                    <DialogTrigger asChild>
                         <Button type="button" size="icon" variant="ghost" className="absolute left-1 top-1/2 -translate-y-1/2">
                            <Package className="h-5 w-5" />
                        </Button>
                    </DialogTrigger>
                    <ShareProductDialog sellerId={currentUser.uid} />
                </Dialog>
             )}
          <Input
            placeholder="Type your message..."
            className={cn("pr-12", isSeller ? "pl-12" : "pl-4")}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
            <Button type="submit" size="sm">Send</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
