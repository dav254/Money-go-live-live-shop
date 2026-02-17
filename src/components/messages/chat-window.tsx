
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Package, MoreVertical, Trash2, PlusCircle, Send, File, Download, Loader2, ArrowLeft, MessageSquare, Reply } from 'lucide-react';
import type { Chat, ChatMessage, Product, UserProfile } from '@/lib/types';
import type { User } from 'firebase/auth';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, useUserProfile, useDoc } from '@/firebase';
import { collection, addDoc, serverTimestamp, orderBy, query, where, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
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
        return <div className="max-w-xs rounded-2xl border bg-background p-3 shadow-sm animate-pulse h-28 w-64"></div>;
    }
    
    if (!product) {
        return <div className="max-w-xs rounded-2xl border bg-background p-3 shadow-sm"><p className="text-xs text-muted-foreground italic">Product no longer available.</p></div>
    }

     return (
        <div className="max-w-xs rounded-2xl border bg-card p-3 shadow-lg hover:border-primary transition-all group overflow-hidden">
            <div className="flex gap-3">
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border">
                     <Image src={product.imageUrl || 'https://picsum.photos/seed/product/150/150'} alt={product.name || 'product image'} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-black text-[10px] uppercase tracking-widest text-primary mb-1">Deal Shared</p>
                    <p className="font-bold text-xs truncate mb-1">{product.name}</p>
                    <p className="text-sm font-black text-foreground">${product.price.toLocaleString()}</p>
                    <Button size="sm" className="mt-2 h-7 w-full text-[10px] font-black uppercase tracking-widest" asChild>
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
      <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border shadow-xl">
        <Image
          src={message.mediaUrl}
          alt={name}
          width={250}
          height={250}
          className="max-w-full h-auto object-cover hover:scale-105 transition-transform duration-500"
        />
      </a>
    );
  }

  if (isVideo) {
    return (
      <video
        src={message.mediaUrl}
        controls
        className="max-w-[250px] rounded-2xl border shadow-xl bg-black"
      />
    );
  }

  return (
    <a
      href={message.mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex max-w-xs items-center gap-3 rounded-2xl border bg-card p-4 shadow-md hover:bg-muted transition-colors"
    >
      <div className="p-2 bg-primary/10 rounded-lg">
        <File className="h-6 w-6 text-primary" />
      </div>
      <div className="overflow-hidden flex-1">
        <p className="truncate font-bold text-sm">{name}</p>
        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{(message.mediaMetadata.size / 1024).toFixed(2)} KB</p>
      </div>
      <Download className="h-4 w-4 text-muted-foreground" />
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
        <DialogContent className="sm:max-w-md rounded-3xl">
            <DialogHeader>
                <DialogTitle className="font-black text-xl uppercase tracking-tighter">My Catalog</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-96">
                <div className="space-y-3 p-2">
                    {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
                    {products && products.length === 0 && <p className="text-center text-xs text-muted-foreground py-12 uppercase font-bold tracking-widest">No active products</p>}
                    {products?.map(product => (
                        <div key={product.id} className="flex items-center gap-4 p-3 rounded-2xl bg-muted/30 border border-transparent hover:border-primary/30 transition-all group">
                            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border bg-black">
                                <Image src={product.imageUrl || '/placeholder.svg'} alt={product.name || 'Product Image'} fill className="object-cover group-hover:scale-110 transition-transform" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate">{product.name}</p>
                                <p className="text-xs font-black text-primary">${product.price.toLocaleString()}</p>
                            </div>
                            <DialogClose asChild>
                                <Button size="sm" className="font-black text-[10px] uppercase tracking-widest px-4 h-8" onClick={() => onShare(product.id)}>Send</Button>
                            </DialogClose>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </DialogContent>
    )
}

export function ChatWindow({ chat, currentUser, onChatDeleted, onBack }: ChatWindowProps) {
  const [newMessage, setNewMessage] = useState('');
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([]);
  const firestore = useFirestore();
  const { userProfile } = useUserProfile(currentUser?.uid);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [otherParticipantProfile, setOtherParticipantProfile] = useState<UserProfile | null>(null);


  const messagesQuery = useMemoFirebase(() => {
    if (!chat || !firestore) return null;
    return query(collection(firestore, 'chats', chat.id, 'messages'), orderBy('timestamp', 'asc'));
  }, [firestore, chat]);

  const { data: serverMessages, isLoading: isLoadingMessages } = useCollection<ChatMessage>(messagesQuery);
  
  useEffect(() => {
    if (serverMessages) setOptimisticMessages([]);
  }, [serverMessages]);

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
  }, [serverMessages, optimisticMessages]);

  const sendMessage = async (messageData: Partial<ChatMessage>) => {
      if (!chat || !currentUser || !firestore) return;
      
      const messageText = messageData.messageText?.trim() || '';
      const tempId = `temp-${Date.now()}`;
      
      const optimisticMsg = {
          id: tempId,
          senderId: currentUser.uid,
          timestamp: new Date(),
          isOptimistic: true,
          ...messageData
      };
      setOptimisticMessages(prev => [...prev, optimisticMsg]);

      const messagesCollectionRef = collection(firestore, 'chats', chat.id, 'messages');
      const fullMessageData = {
          senderId: currentUser.uid,
          timestamp: serverTimestamp(),
          ...messageData
      };

      try {
          await addDoc(messagesCollectionRef, fullMessageData);
          
          const chatRef = doc(firestore, 'chats', chat.id);
          let lastMessageText = 'Sent a file';
          if (messageData.messageType === 'text') lastMessageText = messageText;
          if (messageData.messageType === 'product') lastMessageText = 'Shared a product';

          await updateDoc(chatRef, {
            lastMessage: lastMessageText,
            lastMessageTimestamp: serverTimestamp(),
          });
      } catch (error) {
          setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
          const permissionError = new FirestorePermissionError({
              path: messagesCollectionRef.path,
              operation: 'create',
              requestResourceData: fullMessageData
          });
          errorEmitter.emit('permission-error', permissionError);
          throw error;
      }
  };

  const handleSendTextMessage = async () => {
    if (!newMessage.trim()) return;
    const text = newMessage;
    setNewMessage('');
    try {
      await sendMessage({ 
          messageText: text.trim(),
          messageType: 'text',
      });
    } catch (e) {
      setNewMessage(text);
      toast({ variant: 'destructive', title: 'Network error.' });
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

  const handleReplyTag = (name: string) => {
      setNewMessage(prev => `@${name} ${prev}`);
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
    } catch (error) {
      console.error("Upload failed:", error);
      toast({ variant: 'destructive', title: 'Upload Failed' });
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
      <div className="hidden h-full flex-1 flex-col items-center justify-center bg-muted/10 md:flex rounded-r-2xl">
        <div className="p-10 rounded-full bg-primary/5 mb-6">
            <MessageSquare className="h-16 w-16 text-primary/20" />
        </div>
        <p className="text-neutral-500 text-xs font-black uppercase tracking-[0.2em]">Select a Session to Chat</p>
      </div>
    );
  }

  const isSellerPortal = userProfile?.userRole === 'seller';
  const allMessages = [...(serverMessages || []), ...optimisticMessages];

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4 bg-card/30 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="md:hidden rounded-full" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="relative">
            <Avatar className="h-10 w-10 border-2 border-primary/20 shadow-xl">
                <AvatarImage src={otherParticipantProfile?.profilePictureUrl} alt={otherParticipantProfile?.fullName} />
                <AvatarFallback className="bg-neutral-800 text-xs font-black uppercase">{otherParticipantProfile?.fullName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 border-2 border-background rounded-full" />
          </div>
          <div className="overflow-hidden">
            <p className="font-black text-sm uppercase tracking-tight truncate leading-none mb-1">{otherParticipantProfile?.fullName}</p>
            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest bg-muted px-1.5 py-0.5 rounded leading-none">{otherParticipantProfile?.userRole}</span>
          </div>
        </div>
        <AlertDialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl shadow-2xl">
              <DropdownMenuLabel className="font-black uppercase text-[10px] tracking-widest opacity-50">Conversation</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <AlertDialogTrigger asChild>
                <DropdownMenuItem className="text-destructive font-bold focus:bg-destructive/10 focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Conversation
                </DropdownMenuItem>
              </AlertDialogTrigger>
            </DropdownMenuContent>
          </DropdownMenu>
          <AlertDialogContent className="rounded-3xl border-white/10">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-black uppercase tracking-tighter">Permanently Delete?</AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                This will only delete the chat from your view. The other person will still see the conversation. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteChat} className="bg-red-600 hover:bg-red-700 rounded-xl font-black uppercase text-[10px]">Delete Forever</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="p-6 space-y-8 pb-12">
          {isLoadingMessages && allMessages.length === 0 && (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary/50" /></div>
          )}
          {allMessages.map((msg) => {
            const senderIsCurrentUser = msg.senderId === currentUser.uid;
            const senderProfile = senderIsCurrentUser ? userProfile : otherParticipantProfile;
            
            // Layout Logic: Providers (Sellers/Admins) LEFT, Customers (Buyers/Resellers) RIGHT
            const isProvider = senderProfile?.userRole === 'seller' || senderProfile?.userRole === 'admin';
            const alignRight = !isProvider;
            
            return (
                <div key={msg.id} className={cn("flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300", alignRight ? "justify-end pl-12" : "justify-start pr-12")}>
                    <div className={cn("flex flex-col gap-1.5", alignRight ? "items-end text-right" : "items-start text-left")}>
                        {msg.messageType === 'product' && msg.productId ? (
                            <SharedProductCard productId={msg.productId} />
                        ) : (msg.messageType === 'image' || msg.messageType === 'video' || msg.messageType === 'file') && msg.mediaUrl ? (
                            <MediaMessage message={msg} />
                        ) : msg.messageText ? (
                            <div className={cn(
                            "rounded-2xl px-4 py-3 text-sm font-medium leading-relaxed border shadow-sm relative group max-w-xs sm:max-w-md",
                            alignRight
                                ? "bg-primary text-white rounded-tr-none border-primary shadow-primary/20"
                                : "bg-card text-foreground rounded-tl-none border-border shadow-black/5"
                            )}>
                            {!senderIsCurrentUser && (
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className={cn("absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full bg-background border shadow-md", alignRight ? "-left-10" : "-right-10")}
                                    onClick={() => handleReplyTag(senderProfile?.fullName || '')}
                                >
                                    <Reply className="h-3 w-3" />
                                </Button>
                            )}
                            <p className="whitespace-pre-wrap">{msg.messageText}</p>
                            </div>
                        ) : null}
                        <div className={cn("flex items-center gap-2 px-1", alignRight ? "flex-row-reverse" : "flex-row")}>
                            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">{senderProfile?.fullName}</span>
                            <span className="text-[8px] font-medium text-muted-foreground/30">
                                {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                            </span>
                        </div>
                    </div>
                </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t bg-card/30 backdrop-blur-xl">
        {uploadProgress !== null && (
          <div className="mb-4 px-2">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary mb-1.5 animate-pulse">
                <span>Sending Media...</span>
                <span>{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} className="h-1 bg-primary/10" />
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendTextMessage();
          }}
          className="relative flex items-center gap-2 max-w-4xl mx-auto w-full"
        >
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-11 w-11 rounded-2xl hover:bg-primary/10 hover:text-primary transition-all border-white/5"
              onClick={triggerFileSelect}
              disabled={uploadProgress !== null}
            >
              {uploadProgress !== null ? <Loader2 className="h-5 w-5 animate-spin" /> : <PlusCircle className="h-5 w-5" />}
            </Button>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} disabled={uploadProgress !== null} />
            {isSellerPortal && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-11 w-11 rounded-2xl hover:bg-blue-500/10 hover:text-blue-500 transition-all border-white/5"
                    disabled={uploadProgress !== null}
                  >
                    <Package className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <ShareProductDialog sellerId={currentUser.uid} onShare={handleShareProduct} />
              </Dialog>
            )}
          </div>
          <Input
            placeholder={uploadProgress !== null ? "Uploading..." : "Write a message..."}
            className="flex-1 h-11 border-2 border-white/5 bg-background/50 rounded-2xl focus-visible:ring-primary focus-visible:border-primary px-4 font-medium"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={uploadProgress !== null}
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 rounded-2xl bg-primary shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
            disabled={uploadProgress !== null || !newMessage.trim()}
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
