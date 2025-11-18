
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Package, MoreVertical, Trash2, PlusCircle, History, Send } from 'lucide-react';
import type { Chat, ChatMessage, Product, UserProfile } from '@/lib/types';
import type { User } from 'firebase/auth';
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, useUserProfile, useDoc } from '@/firebase';
import { collection, addDoc, serverTimestamp, orderBy, query, where, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '../ui/dialog';
import Image from 'next/image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"


interface ChatWindowProps {
  chat: Chat | null;
  currentUser: User | null;
  onChatDeleted?: () => void;
}

const SharedProductCard = ({ productId }: { productId: string }) => {
    const firestore = useFirestore();
    const productRef = useMemoFirebase(() => doc(firestore, 'products', productId), [firestore, productId]);
    const { data: product, isLoading } = useDoc<Product>(productRef);

    if (isLoading) {
        return <div className="max-w-xs rounded-lg border bg-background p-3 shadow-sm animate-pulse h-28"></div>;
    }
    
    if (!product) {
        return <div className="max-w-xs rounded-lg border bg-background p-3 shadow-sm"><p>This product is no longer available.</p></div>
    }

     return (
        <div className="max-w-xs rounded-lg border bg-background p-3 shadow-sm">
            <div className="flex gap-3">
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md">
                     <Image src={product.imageUrl || 'https://picsum.photos/seed/product/150/150'} alt={product.name || 'product image'} fill className="object-cover" />
                </div>
                <div>
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-sm font-bold text-primary">{product.price.toLocaleString()}</p>
                    <Button size="sm" className="mt-1 h-7">View Product</Button>
                </div>
            </div>
        </div>
    );
};


const ShareProductDialog = ({ sellerId, onShare }: { sellerId: string; onShare: (productId: string) => void }) => {
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
                                <Image src={product.image?.imageUrl || '/placeholder.svg'} alt={product.name || "Product Image"} fill className="object-cover" />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold">{product.name}</p>
                                <p className="text-sm text-primary">{product.price.toLocaleString()}</p>
                            </div>
                            <DialogClose asChild>
                                <Button size="sm" onClick={() => onShare(product.id)}>Share</Button>
                            </DialogClose>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </DialogContent>
    )
}


export function ChatWindow({ chat, currentUser, onChatDeleted }: ChatWindowProps) {
  const [newMessage, setNewMessage] = useState('');
  const firestore = useFirestore();
  const { userProfile } = useUserProfile(currentUser?.uid);

  const messagesQuery = useMemoFirebase(() => {
    if (!chat) return null;
    return query(collection(firestore, 'chats', chat.id, 'messages'), orderBy('timestamp', 'asc'));
  }, [firestore, chat]);

  const { data: messages, isLoading: isLoadingMessages } = useCollection<ChatMessage>(messagesQuery);
  
  const sendMessage = async (messageData: Partial<ChatMessage>) => {
      if (!chat || !currentUser) return;
      
      const messagesCollectionRef = collection(firestore, 'chats', chat.id, 'messages');
      const fullMessageData = {
          senderId: currentUser.uid,
          timestamp: serverTimestamp(),
          ...messageData
      };

      addDoc(messagesCollectionRef, fullMessageData).catch(error => {
          const permissionError = new FirestorePermissionError({
              path: messagesCollectionRef.path,
              operation: 'create',
              requestResourceData: fullMessageData
          });
          errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleSendTextMessage = async () => {
    if (!newMessage.trim()) return;
    await sendMessage({ 
        messageText: newMessage.trim(),
        messageType: 'text',
    });
    setNewMessage('');
  };
  
  const handleShareProduct = async (productId: string) => {
      await sendMessage({
          messageText: '',
          messageType: 'product',
          productId: productId,
      });
  };
  
  const handleDeleteChat = async () => {
    if (!chat || !currentUser) return;
    const chatRef = doc(firestore, 'chats', chat.id);
    try {
      await updateDoc(chatRef, {
        deletedFor: arrayUnion(currentUser.uid)
      });
      onChatDeleted?.();
    } catch (error) {
      console.error("Error deleting chat:", error);
      // Optionally show a toast notification on failure
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
        <AlertDialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Chat Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <AlertDialogTrigger asChild>
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Chat
                </DropdownMenuItem>
              </AlertDialogTrigger>
            </DropdownMenuContent>
          </DropdownMenu>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will only delete the chat from your view. The other person will still see the conversation. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteChat}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 bg-muted/10">
        <div className="p-4 space-y-6">
          {isLoadingMessages && <p className="text-center text-muted-foreground">Loading messages...</p>}
          {messages?.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.senderId === currentUser.uid ? "justify-end" : "justify-start")}>
                {msg.messageType === 'product' && msg.productId ? (
                   <SharedProductCard productId={msg.productId} />
                ) : (
                  msg.messageText && (
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
                  )
                )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t bg-background p-3">
        <form onSubmit={(e) => { e.preventDefault(); handleSendTextMessage(); }} className="relative">
             {isSeller && (
                <Dialog>
                    <DialogTrigger asChild>
                         <Button type="button" size="icon" variant="ghost" className="absolute left-1 top-1/2 -translate-y-1/2">
                            <Package className="h-5 w-5" />
                        </Button>
                    </DialogTrigger>
                    <ShareProductDialog sellerId={currentUser.uid} onShare={handleShareProduct} />
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

    