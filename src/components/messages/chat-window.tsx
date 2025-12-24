'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Package, MoreVertical, Trash2, PlusCircle, Send, File, Download, Loader2, ArrowLeft } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { Progress } from '../ui/progress';


interface ChatWindowProps {
  chat: Chat | null;
  currentUser: User | null;
  onChatDeleted?: () => void;
  onBack?: () => void;
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

const MediaMessage = ({ message }: { message: ChatMessage }) => {
  if (!message.mediaUrl || !message.mediaMetadata) return null;

  const { name, type } = message.mediaMetadata;
  const isImage = type.startsWith('image/');
  const isVideo = type.startsWith('video/');

  if (isImage) {
    return (
      <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer">
        <Image
          src={message.mediaUrl}
          alt={name}
          width={200}
          height={200}
          className="max-w-xs rounded-lg border object-cover"
        />
      </a>
    );
  }

  if (isVideo) {
    return (
      <video
        src={message.mediaUrl}
        controls
        className="max-w-xs rounded-lg border"
        style={{ maxWidth: '250px' }}
      />
    );
  }

  return (
    <a
      href={message.mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex max-w-xs items-center gap-3 rounded-lg border bg-background p-3 shadow-sm hover:bg-muted"
    >
      <File className="h-8 w-8 flex-shrink-0 text-muted-foreground" />
      <div className="overflow-hidden">
        <p className="truncate font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground">{(message.mediaMetadata.size / 1024).toFixed(2)} KB</p>
      </div>
      <Download className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
    </a>
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
                                <Image src={product.imageUrl || '/placeholder.svg'} alt={product.name || 'Product Image'} fill className="object-cover" />
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

function playNotificationSound() {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
  gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.1); // Play for 100ms
}


export function ChatWindow({ chat, currentUser, onChatDeleted, onBack }: ChatWindowProps) {
  const [newMessage, setNewMessage] = useState('');
  const firestore = useFirestore();
  const { userProfile } = useUserProfile(currentUser?.uid);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const prevMessagesCountRef = useRef<number>(0);


  const messagesQuery = useMemoFirebase(() => {
    if (!chat || !firestore) return null;
    return query(collection(firestore, 'chats', chat.id, 'messages'), orderBy('timestamp', 'asc'));
  }, [firestore, chat]);

  const { data: messages, isLoading: isLoadingMessages } = useCollection<ChatMessage>(messagesQuery);
  
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }

    if (messages && messages.length > prevMessagesCountRef.current) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.senderId !== currentUser?.uid) {
        playNotificationSound();
      }
    }
    prevMessagesCountRef.current = messages ? messages.length : 0;

  }, [messages, currentUser?.uid]);

  const sendMessage = async (messageData: Partial<ChatMessage>) => {
      if (!chat || !currentUser || !firestore) return;
      
      const messagesCollectionRef = collection(firestore, 'chats', chat.id, 'messages');
      const fullMessageData = {
          senderId: currentUser.uid,
          timestamp: serverTimestamp(),
          ...messageData
      };

      await addDoc(messagesCollectionRef, fullMessageData).catch(error => {
          const permissionError = new FirestorePermissionError({
              path: messagesCollectionRef.path,
              operation: 'create',
              requestResourceData: fullMessageData
          });
          errorEmitter.emit('permission-error', permissionError);
          throw error; // Re-throw to be caught by the caller
      });
      
      const chatRef = doc(firestore, 'chats', chat.id);
      let lastMessageText = 'Sent a file';
      if (messageData.messageType === 'text') lastMessageText = messageData.messageText || '';
      if (messageData.messageType === 'product') lastMessageText = 'Shared a product';

      await updateDoc(chatRef, {
        lastMessage: lastMessageText,
        lastMessageTimestamp: serverTimestamp(),
      });
      
      // Create a notification for the recipient
      const recipientId = chat.participantIds.find(id => id !== currentUser.uid);
      if (recipientId) {
          const notificationsRef = collection(firestore, 'notifications');
          const senderName = userProfile?.fullName || 'Someone';
          await addDoc(notificationsRef, {
              userId: recipientId,
              type: 'message',
              title: `New message from ${senderName}`,
              message: lastMessageText,
              link: `/messages?chatWith=${currentUser.uid}`,
              status: 'unread',
              timestamp: serverTimestamp(),
          }).catch(error => {
              console.error("Failed to create notification:", error);
              // Do not throw an error here, as sending the message is the primary action.
          });
      }
  };

  const handleSendTextMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      await sendMessage({ 
          messageText: newMessage.trim(),
          messageType: 'text',
      });
      setNewMessage('');
    } catch (e) {
      // Error is already emitted, just show a toast.
      toast({ variant: 'destructive', title: 'Could not send message.' });
    }
  };
  
  const handleShareProduct = async (productId: string) => {
      try {
        await sendMessage({
            messageText: '',
            messageType: 'product',
            productId: productId,
        });
      } catch (e) {
        toast({ variant: 'destructive', title: 'Could not share product.' });
      }
  };

  const uploadToCloudinary = async (file: File): Promise<{ url: string, type: string }> => {
    const timestamp = Math.round((new Date()).getTime() / 1000);
    const paramsToSign = { timestamp };

    const signatureResponse = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paramsToSign }),
    });
    const { signature } = await signatureResponse.json();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || '');
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl, true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          setUploadProgress(progress);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const uploadedData = JSON.parse(xhr.responseText);
          resolve({ url: uploadedData.secure_url, type: file.type });
        } else {
          reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload.'));
      xhr.send(formData);
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadProgress(0);
    toast({ title: 'Uploading file...', description: file.name });

    try {
      const { url, type } = await uploadToCloudinary(file);
      await sendMessage({
        messageText: '',
        messageType: type.startsWith('image/') ? 'image' : type.startsWith('video/') ? 'video' : 'file',
        mediaUrl: url,
        mediaMetadata: {
          name: file.name,
          size: file.size,
          type: file.type,
        }
      });
      toast({ title: 'Upload complete!', description: `${file.name} sent.` });
    } catch (error) {
      console.error("Upload failed:", error);
      toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not upload your file. Please try again.' });
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };


  const triggerFileSelect = () => fileInputRef.current?.click();
  
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
    }
  };


  if (!chat || !currentUser) {
    return (
      <div className="hidden h-full flex-1 flex-col items-center justify-center bg-muted/20 md:flex">
        <p className="text-muted-foreground">Select a conversation to start chatting</p>
      </div>
    );
  }

  const otherParticipant = chat.otherParticipant;
  const isSeller = userProfile?.userRole === 'seller';

  return (
    <div className="flex h-full flex-col bg-background relative">
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
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

      <ScrollArea className="flex-1 bg-muted/10" ref={scrollAreaRef}>
        <div className="p-4 space-y-6 pb-24">
          {isLoadingMessages && <p className="text-center text-muted-foreground">Loading messages...</p>}
          {messages?.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.senderId === currentUser.uid ? "justify-end" : "justify-start")}>
                <div className={cn("flex max-w-sm flex-col gap-1", msg.senderId === currentUser.uid ? "items-end" : "items-start")}>
                    {msg.messageType === 'product' && msg.productId ? (
                        <SharedProductCard productId={msg.productId} />
                    ) : (msg.messageType === 'image' || msg.messageType === 'video' || msg.messageType === 'file') && msg.mediaUrl ? (
                        <MediaMessage message={msg} />
                    ) : msg.messageText ? (
                        <div className={cn(
                        "rounded-xl p-3 text-sm shadow-sm",
                        msg.senderId === currentUser.uid
                            ? "bg-primary text-primary-foreground rounded-br-none"
                            : "bg-card border rounded-bl-none"
                        )}>
                        <p>{msg.messageText}</p>
                        </div>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                        {msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="absolute bottom-0 left-0 right-0 border-t bg-background p-3">
        {uploadProgress !== null && (
          <div className="mb-2">
            <Progress value={uploadProgress} className="h-1" />
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); handleSendTextMessage(); }} className="relative">
            <div className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center">
                 <Button type="button" size="icon" variant="ghost" onClick={triggerFileSelect} disabled={uploadProgress !== null}>
                    {uploadProgress !== null ? <Loader2 className="h-5 w-5 animate-spin" /> : <PlusCircle className="h-5 w-5" />}
                 </Button>
                 <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} disabled={uploadProgress !== null} />
                {isSeller && (
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button type="button" size="icon" variant="ghost" disabled={uploadProgress !== null}>
                                <Package className="h-5 w-5" />
                            </Button>
                        </DialogTrigger>
                        <ShareProductDialog sellerId={currentUser.uid} onShare={handleShareProduct} />
                    </Dialog>
                )}
            </div>
          <Input
            placeholder="Type your message..."
            className={cn("pr-12", isSeller ? "pl-24" : "pl-12")}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={uploadProgress !== null}
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
            <Button type="submit" size="icon" variant="ghost" disabled={uploadProgress !== null}>
                <Send className="h-5 w-5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
