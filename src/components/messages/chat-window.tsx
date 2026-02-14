'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Package, MoreVertical, Trash2, PlusCircle, Send, File, Download, Loader2, ArrowLeft, MessageSquare } from 'lucide-react';
import type { Chat, ChatMessage, Product, UserProfile } from '@/lib/types';
import type { User } from 'firebase/auth';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, useUserProfile, useDoc } from '@/firebase';
import { collection, addDoc, serverTimestamp, orderBy, query, where, doc, updateDoc, arrayUnion, getDocs } from 'firebase/firestore';
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
import Link from 'next/link';


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
        return <div className="max-w-xs rounded-lg border bg-background p-3 shadow-sm animate-pulse h-28 w-64"></div>;
    }
    
    if (!product) {
        return <div className="max-w-xs rounded-lg border bg-background p-3 shadow-sm"><p className="text-xs text-muted-foreground">Product unavailable.</p></div>
    }

     return (
        <div className="max-w-xs rounded-lg border bg-background p-3 shadow-md hover:border-primary transition-colors cursor-pointer">
            <div className="flex gap-3">
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border">
                     <Image src={product.imageUrl || 'https://picsum.photos/seed/product/150/150'} alt={product.name || 'product image'} fill className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs truncate">{product.name}</p>
                    <p className="text-sm font-black text-primary">${product.price.toLocaleString()}</p>
                    <Button size="sm" className="mt-1.5 h-7 w-full text-[10px] font-bold uppercase tracking-wider" asChild>
                        <Link href={`/products/${product.id}`}>View Deal</Link>
                    </Button>
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
          className="max-w-xs rounded-lg border object-cover shadow-sm hover:opacity-90 transition-opacity"
        />
      </a>
    );
  }

  if (isVideo) {
    return (
      <video
        src={message.mediaUrl}
        controls
        className="max-w-xs rounded-lg border shadow-sm"
        style={{ maxWidth: '250px' }}
      />
    );
  }

  return (
    <a
      href={message.mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex max-w-xs items-center gap-3 rounded-lg border bg-background p-3 shadow-sm hover:bg-muted transition-colors"
    >
      <File className="h-8 w-8 flex-shrink-0 text-muted-foreground" />
      <div className="overflow-hidden">
        <p className="truncate font-semibold text-sm">{name}</p>
        <p className="text-[10px] text-muted-foreground uppercase font-bold">{(message.mediaMetadata.size / 1024).toFixed(2)} KB</p>
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
                    {isLoading && <p className="text-center text-sm text-muted-foreground py-10">Loading catalog...</p>}
                    {products && products.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">No products found.</p>}
                    {products?.map(product => (
                        <div key={product.id} className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted transition-colors border border-transparent hover:border-border">
                            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border bg-muted">
                                <Image src={product.imageUrl || '/placeholder.svg'} alt={product.name || 'Product Image'} fill className="object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate">{product.name}</p>
                                <p className="text-sm font-black text-primary">${product.price.toLocaleString()}</p>
                            </div>
                            <DialogClose asChild>
                                <Button size="sm" variant="outline" className="font-bold text-xs uppercase" onClick={() => onShare(product.id)}>Share</Button>
                            </DialogClose>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </DialogContent>
    )
}

function playNotificationSound() {
  if (typeof window === 'undefined') return;
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (e) {}
}


export function ChatWindow({ chat, currentUser, onChatDeleted, onBack }: ChatWindowProps) {
  const [newMessage, setNewMessage] = useState('');
  const firestore = useFirestore();
  const { userProfile } = useUserProfile(currentUser?.uid);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [otherParticipantProfile, setOtherParticipantProfile] = useState<UserProfile | null>(null);
  const prevMessagesCountRef = useRef<number>(0);


  const messagesQuery = useMemoFirebase(() => {
    if (!chat || !firestore) return null;
    return query(collection(firestore, 'chats', chat.id, 'messages'), orderBy('timestamp', 'asc'));
  }, [firestore, chat]);

  const { data: messages, isLoading: isLoadingMessages } = useCollection<ChatMessage>(messagesQuery);
  
  useEffect(() => {
    if (chat && currentUser && firestore) {
        const otherId = chat.participantIds.find(id => id !== currentUser.uid);
        if (otherId) {
            getDoc(doc(firestore, 'userProfiles', otherId)).then(snap => {
                if (snap.exists()) setOtherParticipantProfile(snap.data() as UserProfile);
            });
        }
    }
  }, [chat, currentUser, firestore]);

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
          throw error;
      });
      
      const chatRef = doc(firestore, 'chats', chat.id);
      let lastMessageText = 'Sent a file';
      if (messageData.messageType === 'text') lastMessageText = messageData.messageText || '';
      if (messageData.messageType === 'product') lastMessageText = 'Shared a product';

      await updateDoc(chatRef, {
        lastMessage: lastMessageText,
        lastMessageTimestamp: serverTimestamp(),
      });
      
      const recipientId = chat.participantIds.find(id => id !== currentUser.uid);
      if (recipientId) {
          const notificationsRef = collection(firestore, 'notifications');
          const senderName = userProfile?.shopName || userProfile?.fullName || 'Someone';
          await addDoc(notificationsRef, {
              userId: recipientId,
              type: 'message',
              title: `New message from ${senderName}`,
              message: lastMessageText,
              link: `/messages?chatWith=${currentUser.uid}`,
              status: 'unread',
              timestamp: serverTimestamp(),
          }).catch(() => {});
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
        <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground text-sm font-medium uppercase tracking-widest">Select a session to chat</p>
      </div>
    );
  }

  const isSellerPortal = userProfile?.userRole === 'seller';

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b p-3 bg-card/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-9 w-9 border-2 border-primary/20">
            <AvatarImage src={otherParticipantProfile?.profilePictureUrl} alt={otherParticipantProfile?.fullName} />
            <AvatarFallback className="bg-muted text-xs font-bold">{otherParticipantProfile?.fullName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="overflow-hidden">
            <p className="font-black text-sm uppercase tracking-tight truncate">{otherParticipantProfile?.fullName}</p>
            <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{otherParticipantProfile?.userRole}</span>
            </div>
          </div>
        </div>
        <AlertDialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Chat Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <AlertDialogTrigger asChild>
                <DropdownMenuItem className="text-destructive font-bold">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Conversation
                </DropdownMenuItem>
              </AlertDialogTrigger>
            </DropdownMenuContent>
          </DropdownMenu>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will only delete the chat from your view. The other person will still see the conversation.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteChat} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <ScrollArea className="flex-1 bg-muted/5" ref={scrollAreaRef}>
        <div className="p-4 space-y-6">
          {isLoadingMessages && (
              <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
          )}
          {messages?.map((msg) => {
            const senderIsCurrentUser = msg.senderId === currentUser.uid;
            
            // MARKETPLACE PERSPECTIVE ALIGNMENT:
            // The sender's role determines position. 
            // We need to know the role of the sender of THIS specific message.
            const isMsgFromBuyerOrReseller = (senderIsCurrentUser && (userProfile?.userRole === 'buyer' || userProfile?.userRole === 'reseller')) ||
                                            (!senderIsCurrentUser && (otherParticipantProfile?.userRole === 'buyer' || otherParticipantProfile?.userRole === 'reseller'));
            
            // Buyers/Resellers = Always Right (Primary Color)
            // Sellers/Admins = Always Left (Card Color)
            const alignRight = isMsgFromBuyerOrReseller;
            const roleLabel = senderIsCurrentUser ? userProfile?.userRole : otherParticipantProfile?.userRole;
            
            return (
                <div key={msg.id} className={cn("flex", alignRight ? "justify-end" : "justify-start")}>
                    <div className={cn("flex max-w-[85%] flex-col gap-1", alignRight ? "items-end" : "items-start")}>
                        {msg.messageType === 'product' && msg.productId ? (
                            <SharedProductCard productId={msg.productId} />
                        ) : (msg.messageType === 'image' || msg.messageType === 'video' || msg.messageType === 'file') && msg.mediaUrl ? (
                            <MediaMessage message={msg} />
                        ) : msg.messageText ? (
                            <div className={cn(
                            "rounded-2xl p-3 text-sm shadow-sm font-medium leading-relaxed border",
                            alignRight
                                ? "bg-primary text-primary-foreground rounded-tr-none border-primary shadow-primary/10"
                                : "bg-card text-card-foreground rounded-tl-none border-border shadow-black/5"
                            )}>
                            <p>{msg.messageText}</p>
                            </div>
                        ) : null}
                        <div className="flex items-center gap-2 px-1">
                            <span className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground/60">
                                {roleLabel}
                            </span>
                            <span className="text-[9px] font-medium text-muted-foreground/40">
                                {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                        </div>
                    </div>
                </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="bg-card/30 p-4 border-t">
        {uploadProgress !== null && (
          <div className="mb-3 px-2">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-primary mb-1">
                <span>Uploading...</span>
                <span>{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} className="h-1" />
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendTextMessage();
          }}
          className="relative flex items-center rounded-2xl bg-card p-2 border-2 border-border shadow-xl ring-offset-background focus-within:border-primary/50 transition-colors"
        >
          <div className="flex items-center gap-1 px-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={triggerFileSelect}
              disabled={uploadProgress !== null}
            >
              {uploadProgress !== null ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <PlusCircle className="h-5 w-5" />
              )}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
              disabled={uploadProgress !== null}
            />
            {isSellerPortal && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors"
                    disabled={uploadProgress !== null}
                  >
                    <Package className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <ShareProductDialog
                  sellerId={currentUser.uid}
                  onShare={handleShareProduct}
                />
              </Dialog>
            )}
          </div>
          <Input
            placeholder={uploadProgress !== null ? "Please wait..." : "Type your message..."}
            className="flex-1 border-0 bg-transparent h-10 focus-visible:ring-0 focus-visible:ring-offset-0 font-medium"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={uploadProgress !== null}
          />
          <div className="px-1">
            <Button
              type="submit"
              size="icon"
              className="h-10 w-10 rounded-xl bg-primary shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
              disabled={uploadProgress !== null || !newMessage.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}