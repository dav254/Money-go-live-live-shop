'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
    Package, 
    MoreVertical, 
    Trash2, 
    PlusCircle, 
    Send, 
    File, 
    Download, 
    Loader2, 
    ArrowLeft, 
    MessageSquare, 
    CheckCheck,
    Sparkles,
    BrainCircuit,
    Zap,
    ShieldCheck,
    X,
    TrendingUp,
    ChevronRight
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { Chat, ChatMessage, Product, UserProfile } from '@/lib/types';
import type { User } from 'firebase/auth';
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile, useDoc } from '@/firebase';
import { collection, addDoc, serverTimestamp, orderBy, query, where, doc, updateDoc, arrayUnion, getDoc, writeBatch } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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
import { useToast } from '@/hooks/use-toast';
import { Progress } from '../ui/progress';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '../ui/badge';

interface ChatWindowProps {
  chat: Chat | null;
  currentUser: User | null;
  onChatDeleted: () => void;
  onBack: () => void;
}

const SharedProductCard = ({ productId }: { productId: string }) => {
    const firestore = useFirestore();
    const productRef = useMemoFirebase(() => doc(firestore, 'products', productId), [firestore, productId]);
    const { data: product, isLoading } = useDoc<Product>(productRef);

    if (isLoading) return <div className="max-w-xs rounded-2xl border bg-background p-3 shadow-sm animate-pulse h-28 w-64"></div>;
    if (!product) return <div className="max-w-xs rounded-2xl border bg-background p-3 shadow-sm"><p className="text-xs text-muted-foreground italic">Product no longer available.</p></div>;

     return (
        <div className="max-w-xs rounded-2xl border bg-card p-3 shadow-lg hover:border-primary transition-all group overflow-hidden text-left">
            <div className="flex gap-3">
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border">
                     <Image src={product.imageUrl || 'https://picsum.photos/seed/product/150/150'} alt={product.name || 'product'} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="flex-1 min-w-0 text-left">
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
        <Image src={message.mediaUrl} alt={name} width={250} height={250} className="max-w-full h-auto object-cover hover:scale-105 transition-transform duration-500" />
      </a>
    );
  }
  if (isVideo) {
    return <video src={message.mediaUrl} controls className="max-w-[250px] rounded-2xl border shadow-xl bg-black" />;
  }
  return (
    <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex max-w-xs items-center gap-3 rounded-2xl border bg-card p-4 shadow-md hover:bg-muted transition-colors">
      <div className="p-2 bg-primary/10 rounded-lg"><File className="h-6 w-6 text-primary" /></div>
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
    const productsQuery = useMemoFirebase(() => query(collection(firestore, 'products'), where('sellerId', '==', sellerId)), [firestore, sellerId]);
    const { data: products, isLoading } = useCollection<Product>(productsQuery);

    return (
        <DialogContent className="sm:max-w-md rounded-3xl">
            <DialogHeader><DialogTitle className="font-black text-xl uppercase tracking-tighter">My Catalog</DialogTitle></DialogHeader>
            <ScrollArea className="h-96">
                <div className="space-y-3 p-2">
                    {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
                    {products?.map(product => (
                        <div key={product.id} className="flex items-center gap-4 p-3 rounded-2xl bg-muted/30 border border-transparent hover:border-primary/30 transition-all group text-left">
                            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border bg-black">
                                <Image src={product.imageUrl || '/placeholder.svg'} alt={product.name} fill className="object-cover group-hover:scale-110 transition-transform" />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
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

const AiNegotiationCopilot = ({ isOpen, onClose, onApplySuggestion }: { isOpen: boolean, onClose: () => void, onApplySuggestion: (text: string) => void }) => {
    if (!isOpen) return null;

    const suggestions = [
        { title: "Friendly Greeting", text: "Hi! Thanks for reaching out about this item. How can I help you today?" },
        { title: "Price Negotiation", text: "I can offer a small discount if you're ready to complete the purchase today. Would $XX work for you?" },
        { title: "Shipping Confirmation", text: "Yes, I can ship this to your location. It usually takes 2-3 business days." },
    ];

    return (
        <div className={cn(
            "fixed md:static inset-y-0 right-0 z-[60] w-80 bg-neutral-950 border-l border-white/10 shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right",
            !isOpen && "hidden"
        )}>
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-neutral-900/50">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-primary" />
                    <span className="font-black text-xs uppercase tracking-widest text-white">Negotiation AI</span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>
            
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase text-neutral-500 tracking-[0.2em]">Smart Suggestions</p>
                        <div className="space-y-3">
                            {suggestions.map((s, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => onApplySuggestion(s.text)}
                                    className="w-full text-left p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/30 hover:bg-white/10 transition-all group"
                                >
                                    <p className="text-[10px] font-black text-primary uppercase mb-1">{s.title}</p>
                                    <p className="text-xs text-neutral-300 line-clamp-2 leading-relaxed italic">"{s.text}"</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <Separator className="bg-white/5" />

                    <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" />
                            <p className="text-[10px] font-black uppercase text-primary tracking-widest">AI Strategy</p>
                        </div>
                        <p className="text-xs text-neutral-200 leading-relaxed">
                            Buyer is showing high interest. Suggest a time-limited discount to create urgency and close the deal.
                        </p>
                    </div>

                    <div className="space-y-2">
                         <p className="text-[10px] font-black uppercase text-neutral-500 tracking-[0.2em]">Deal Safeguard</p>
                         <div className="flex items-center gap-3 p-3 rounded-2xl bg-green-500/5 border border-green-500/10">
                            <ShieldCheck className="h-5 w-5 text-green-500 shrink-0" />
                            <p className="text-[10px] font-bold text-neutral-400">Keep transactions in Go Earn for protection.</p>
                         </div>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
};

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
  const [isAiOpen, setIsAiOpen] = useState(false);

  const messagesQuery = useMemoFirebase(() => {
    if (!chat || !firestore) return null;
    return query(collection(firestore, 'chats', chat.id, 'messages'), orderBy('timestamp', 'asc'));
  }, [firestore, chat]);

  const { data: serverMessages } = useCollection<ChatMessage>(messagesQuery);
  
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
    if (!chat || !currentUser || !firestore || !serverMessages) return;
    const unreadFromOther = serverMessages.filter(m => m.senderId !== currentUser.uid && !m.isRead);
    if (unreadFromOther.length > 0) {
        const batch = writeBatch(firestore);
        unreadFromOther.forEach(m => {
            batch.update(doc(firestore, 'chats', chat.id, 'messages', m.id), { isRead: true, readAt: serverTimestamp() });
        });
        batch.commit().catch(console.error);
    }
  }, [serverMessages, chat, currentUser, firestore]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [serverMessages, optimisticMessages]);

  const sendMessage = async (messageData: Partial<ChatMessage>) => {
      if (!chat || !currentUser || !firestore) return;
      const tempId = `temp-${Date.now()}`;
      setOptimisticMessages(prev => [...prev, { id: tempId, senderId: currentUser.uid, timestamp: new Date(), isOptimistic: true, ...messageData }]);

      try {
          await addDoc(collection(firestore, 'chats', chat.id, 'messages'), { senderId: currentUser.uid, timestamp: serverTimestamp(), isRead: false, ...messageData });
          await updateDoc(doc(firestore, 'chats', chat.id), { lastMessage: messageData.messageText || 'Sent a file', lastMessageTimestamp: serverTimestamp() });
      } catch (error) {
          setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
          throw error;
      }
  };

  const handleSendTextMessage = () => {
    if (!newMessage.trim()) return;
    const text = newMessage;
    setNewMessage('');
    sendMessage({ messageText: text.trim(), messageType: 'text' }).catch(() => setNewMessage(text));
  };

  const handleShareProduct = useCallback((productId: string) => {
    sendMessage({ messageType: 'product', productId }).catch(error => {
        console.error("Error sharing product:", error);
        toast({ variant: 'destructive', title: 'Share Failed' });
    });
  }, [chat, currentUser, firestore, toast]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;
    
    setUploadProgress(0);
    const storage = getStorage();
    const storageRef = ref(storage, `chats/${chat?.id}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
      (error) => {
        toast({ variant: 'destructive', title: 'Upload Failed' });
        setUploadProgress(null);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        const type = file.type;
        await sendMessage({ 
          messageText: '', 
          messageType: type.startsWith('image/') ? 'image' : type.startsWith('video/') ? 'video' : 'file', 
          mediaUrl: url, 
          mediaMetadata: { name: file.name, size: file.size, type: file.type } 
        });
        setUploadProgress(null);
      }
    );
  };

  if (!chat || !currentUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-muted/5 p-8 text-center h-full w-full">
        <div className="max-w-xs space-y-4">
            <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto">
                <MessageSquare className="h-10 w-10 text-primary opacity-20" />
            </div>
            <h3 className="font-black text-xl uppercase tracking-tighter">Your Inbox</h3>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-relaxed">Select a conversation to start messaging buyers or sellers.</p>
        </div>
      </div>
    );
  }

  const isOnline = otherParticipantProfile?.lastSeen ? (Date.now() - otherParticipantProfile.lastSeen.toMillis() < 120000) : false;
  const allMessages = [...(serverMessages || []), ...optimisticMessages];

  return (
    <div className="flex h-full w-full bg-background overflow-hidden relative">
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <div className="flex items-center justify-between border-b p-4 bg-card/30 backdrop-blur-xl shrink-0 z-10">
            <div className="flex items-center gap-4 overflow-hidden min-w-0">
            <Button variant="ghost" size="icon" className="md:hidden rounded-full shrink-0" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
            <div className="relative shrink-0">
                <Avatar className="h-10 w-10 border-2 border-primary/20 shadow-xl">
                    <AvatarImage src={otherParticipantProfile?.profilePictureUrl} />
                    <AvatarFallback className="bg-neutral-800 text-xs font-black uppercase">{otherParticipantProfile?.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 border-2 border-background rounded-full", isOnline ? "bg-green-500" : "bg-neutral-500")} />
            </div>
            <div className="overflow-hidden">
                <p className="font-black text-sm uppercase tracking-tight truncate leading-none mb-1">{otherParticipantProfile?.fullName}</p>
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest bg-muted px-1.5 py-0.5 rounded leading-none block w-fit truncate">
                    {isOnline ? 'Online' : otherParticipantProfile?.lastSeen ? `Seen ${formatDistanceToNow(otherParticipantProfile.lastSeen.toDate(), { addSuffix: true })}` : 'Offline'}
                </span>
            </div>
            </div>
            <div className="flex items-center gap-2">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsAiOpen(!isAiOpen)}
                    className={cn("rounded-full transition-colors", isAiOpen ? "bg-primary/20 text-primary" : "text-muted-foreground")}
                >
                    <Sparkles className="h-5 w-5" />
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-full shrink-0"><MoreVertical className="h-5 w-5" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-2xl shadow-2xl">
                    <DropdownMenuItem className="text-destructive font-bold" onClick={() => updateDoc(doc(firestore, 'chats', chat.id), { deletedFor: arrayUnion(currentUser.uid) }).then(onChatDeleted)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Chat
                    </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        <ScrollArea className="flex-1 w-full" ref={scrollAreaRef}>
            <div className="p-4 sm:p-6 space-y-8 pb-12 w-full max-w-4xl mx-auto">
            {allMessages.map((msg) => {
                const senderIsMe = msg.senderId === currentUser.uid;
                const alignRight = senderIsMe;
                return (
                    <div key={msg.id} className={cn("flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300", alignRight ? "justify-end" : "justify-start")}>
                        <div className={cn("flex flex-col gap-1.5 max-w-[85%] sm:max-w-[70%]", alignRight ? "items-end text-right" : "items-start text-left")}>
                            {msg.messageType === 'product' ? <SharedProductCard productId={msg.productId!} /> : (msg.mediaUrl ? <MediaMessage message={msg} /> : (
                                <div className={cn(
                                    "rounded-2xl px-4 py-3 text-sm font-medium leading-relaxed border shadow-sm break-words text-left", 
                                    alignRight ? "bg-primary text-white border-primary" : "bg-card text-foreground border-border"
                                )}>
                                    <p className="whitespace-pre-wrap">{msg.messageText}</p>
                                </div>
                            ))}
                            <div className={cn("flex items-center gap-2 px-1", alignRight ? "flex-row-reverse" : "flex-row")}>
                                <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">{msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}</span>
                                {senderIsMe && msg.isRead && (
                                    <span className="text-[8px] font-bold text-primary flex items-center gap-1">
                                        <CheckCheck className="h-2.5 w-2.5" /> Seen {msg.readAt?.toDate ? msg.readAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
            </div>
        </ScrollArea>

        <div className="p-4 border-t bg-card/30 backdrop-blur-xl shrink-0 z-10">
            {uploadProgress !== null && (
            <div className="mb-4 px-2 max-w-4xl mx-auto">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary mb-1.5 animate-pulse"><span>Sending Media...</span><span>{Math.round(uploadProgress)}%</span></div>
                <Progress value={uploadProgress} className="h-1 bg-primary/10" />
            </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); handleSendTextMessage(); }} className="relative flex items-center gap-2 max-w-4xl mx-auto w-full">
            <div className="flex items-center gap-1 shrink-0">
                <Avatar className="h-9 w-9 border-2 border-primary/20 shrink-0">
                    <AvatarImage src={userProfile?.profilePictureUrl} />
                    <AvatarFallback className="bg-neutral-800 text-xs font-black uppercase">{userProfile?.username?.charAt(0)}</AvatarFallback>
                </Avatar>
                
                {userProfile?.userRole === 'seller' && (
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button type="button" size="icon" variant="outline" className="h-9 w-9 rounded-xl border-white/5 shrink-0 bg-neutral-900/50">
                                <Package className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                        <ShareProductDialog sellerId={currentUser.uid} onShare={handleShareProduct} />
                    </Dialog>
                )}
                
                <Button 
                    type="button" 
                    size="icon" 
                    variant="outline" 
                    className={cn(
                        "h-9 w-9 rounded-xl border-white/5 shrink-0 transition-all",
                        isAiOpen ? "bg-primary/20 text-primary border-primary/30" : "bg-neutral-900/50"
                    )} 
                    onClick={() => setIsAiOpen(!isAiOpen)}
                >
                    <Sparkles className="h-4 w-4" />
                </Button>
            </div>

            <Input 
                placeholder={uploadProgress !== null ? "Uploading..." : "Write a message..."} 
                className="flex-1 h-11 border-2 border-white/5 bg-background/50 rounded-2xl focus-visible:ring-primary text-sm px-4" 
                value={newMessage} 
                onChange={(e) => setNewMessage(e.target.value)} 
                disabled={uploadProgress !== null} 
            />
            
            <Button type="submit" size="icon" className="h-11 w-11 rounded-full bg-primary hover:bg-primary/90 shrink-0 shadow-lg shadow-primary/20" disabled={uploadProgress !== null || !newMessage.trim()}>
                <Send className="h-4 w-4" />
            </Button>
            </form>
        </div>
      </div>

      <AiNegotiationCopilot 
        isOpen={isAiOpen} 
        onClose={() => setIsAiOpen(false)} 
        onApplySuggestion={(text) => {
            setNewMessage(text);
            setIsAiOpen(false);
            toast({ title: 'Suggestion Applied' });
        }}
      />
    </div>
  );
}

