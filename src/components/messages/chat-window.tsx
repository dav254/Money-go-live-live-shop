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

    if (isLoading) return <div className="max-w-[200px] rounded-xl border bg-background p-2 shadow-sm animate-pulse h-24 w-full"></div>;
    if (!product) return <div className="max-w-[200px] rounded-xl border bg-background p-2 shadow-sm"><p className="text-[10px] text-muted-foreground italic text-left">Product unavailable.</p></div>;

     return (
        <div className="max-w-[220px] rounded-xl border bg-card p-2 shadow-md hover:border-primary transition-all group overflow-hidden text-left">
            <div className="flex gap-2">
                <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border">
                     <Image src={product.imageUrl || 'https://picsum.photos/seed/product/150/150'} alt={product.name || 'product'} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                    <p className="font-black text-[8px] uppercase tracking-widest text-primary mb-0.5">DEAL</p>
                    <p className="font-bold text-[11px] truncate mb-0.5 leading-none">{product.name}</p>
                    <p className="text-xs font-black text-foreground">${product.price.toLocaleString()}</p>
                    <Button size="sm" className="mt-1.5 h-6 w-full text-[9px] font-black uppercase tracking-widest px-2" asChild>
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
      <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border shadow-lg">
        <Image src={message.mediaUrl} alt={name} width={200} height={200} className="max-w-full h-auto object-cover hover:scale-105 transition-transform duration-500" />
      </a>
    );
  }
  if (isVideo) {
    return <video src={message.mediaUrl} controls className="max-w-[200px] rounded-xl border shadow-lg bg-black" />;
  }
  return (
    <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex max-w-[200px] items-center gap-2 rounded-xl border bg-card p-3 shadow-md hover:bg-muted transition-colors">
      <div className="p-1.5 bg-primary/10 rounded-lg"><File className="h-4 w-4 text-primary" /></div>
      <div className="overflow-hidden flex-1">
        <p className="truncate font-bold text-xs">{name}</p>
        <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">{(message.mediaMetadata.size / 1024).toFixed(1)} KB</p>
      </div>
      <Download className="h-3 w-3 text-muted-foreground" />
    </a>
  );
};

const ShareProductDialog = ({ sellerId, onShare }: { sellerId: string; onShare: (productId: string) => void }) => {
    const firestore = useFirestore();
    const productsQuery = useMemoFirebase(() => query(collection(firestore, 'products'), where('sellerId', '==', sellerId)), [firestore, sellerId]);
    const { data: products, isLoading } = useCollection<Product>(productsQuery);

    return (
        <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader><DialogTitle className="font-black text-lg uppercase tracking-tighter">My Catalog</DialogTitle></DialogHeader>
            <ScrollArea className="h-80">
                <div className="space-y-2 p-2">
                    {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
                    {products?.map(product => (
                        <div key={product.id} className="flex items-center gap-3 p-2 rounded-xl bg-muted/30 border border-transparent hover:border-primary/30 transition-all group text-left">
                            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border bg-black">
                                <Image src={product.imageUrl || '/placeholder.svg'} alt={product.name} fill className="object-cover group-hover:scale-110 transition-transform" />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="font-bold text-xs truncate leading-none mb-1">{product.name}</p>
                                <p className="text-[10px] font-black text-primary">${product.price.toLocaleString()}</p>
                            </div>
                            <DialogClose asChild>
                                <Button size="sm" className="font-black text-[9px] uppercase tracking-widest px-3 h-7" onClick={() => onShare(product.id)}>Send</Button>
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
        { title: "Friendly Greeting", text: "Hi! Thanks for reaching out. How can I help you?" },
        { title: "Price Nudge", text: "I can offer a small discount if we close this deal today. Thoughts?" },
        { title: "Shipping", text: "Yes, I can ship this to you. Takes 2-3 business days." },
    ];

    return (
        <div className={cn(
            "fixed md:static inset-y-0 right-0 z-[60] w-72 bg-neutral-950 border-l border-white/10 shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right",
            !isOpen && "hidden"
        )}>
            <div className="p-3 border-b border-white/5 flex items-center justify-between bg-neutral-900/50">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-primary" />
                    <span className="font-black text-[10px] uppercase tracking-widest text-white">AI COPILOT</span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
            </div>
            
            <ScrollArea className="flex-1">
                <div className="p-3 space-y-5">
                    <div className="space-y-1.5">
                        <p className="text-[9px] font-black uppercase text-neutral-500 tracking-[0.2em]">SUGGESTIONS</p>
                        <div className="space-y-2">
                            {suggestions.map((s, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => onApplySuggestion(s.text)}
                                    className="w-full text-left p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-primary/30 hover:bg-white/10 transition-all group"
                                >
                                    <p className="text-[9px] font-black text-primary uppercase mb-0.5">{s.title}</p>
                                    <p className="text-[11px] text-neutral-300 line-clamp-2 leading-tight italic">"{s.text}"</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <Separator className="bg-white/5" />

                    <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <Zap className="h-3.5 w-3.5 text-primary" />
                            <p className="text-[9px] font-black uppercase text-primary tracking-widest">STRATEGY</p>
                        </div>
                        <p className="text-[11px] text-neutral-200 leading-tight">
                            High intent buyer. Suggest a quick deal to build momentum.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                         <p className="text-[9px] font-black uppercase text-neutral-500 tracking-[0.2em]">SAFEGUARD</p>
                         <div className="flex items-center gap-2 p-2.5 rounded-xl bg-green-500/5 border border-green-500/10">
                            <ShieldCheck className="h-4 w-4 text-green-500 shrink-0" />
                            <p className="text-[9px] font-bold text-neutral-400 leading-none">Keep payments inside Go Earn.</p>
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
        <div className="max-w-xs space-y-3">
            <div className="p-3 bg-primary/10 rounded-full w-fit mx-auto">
                <MessageSquare className="h-8 w-8 text-primary opacity-30" />
            </div>
            <h3 className="font-black text-lg uppercase tracking-tighter">Your Inbox</h3>
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
        <div className="flex items-center justify-between border-b p-3 bg-card/30 backdrop-blur-xl shrink-0 z-10">
            <div className="flex items-center gap-3 overflow-hidden min-w-0">
            <Button variant="ghost" size="icon" className="md:hidden rounded-full shrink-0 h-8 w-8" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
            <div className="relative shrink-0">
                <Avatar className="h-9 w-9 border-2 border-primary/10 shadow-lg">
                    <AvatarImage src={otherParticipantProfile?.profilePictureUrl} />
                    <AvatarFallback className="bg-neutral-800 text-[10px] font-black uppercase">{otherParticipantProfile?.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 border-2 border-background rounded-full", isOnline ? "bg-green-500" : "bg-neutral-500")} />
            </div>
            <div className="overflow-hidden">
                <p className="font-black text-xs uppercase tracking-tight truncate leading-none mb-1">{otherParticipantProfile?.fullName}</p>
                <span className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest leading-none block truncate">
                    {isOnline ? 'Online' : otherParticipantProfile?.lastSeen ? `Seen ${formatDistanceToNow(otherParticipantProfile.lastSeen.toDate(), { addSuffix: true })}` : 'Offline'}
                </span>
            </div>
            </div>
            <div className="flex items-center gap-1.5">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsAiOpen(!isAiOpen)}
                    className={cn("rounded-full h-8 w-8 transition-colors", isAiOpen ? "bg-primary/10 text-primary" : "text-muted-foreground")}
                >
                    <Sparkles className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-full h-8 w-8 shrink-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-2xl">
                    <DropdownMenuItem className="text-destructive text-xs font-bold" onClick={() => updateDoc(doc(firestore, 'chats', chat.id), { deletedFor: arrayUnion(currentUser.uid) }).then(onChatDeleted)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Chat
                    </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        <ScrollArea className="flex-1 w-full" ref={scrollAreaRef}>
            <div className="p-3 sm:p-5 space-y-6 pb-12 w-full max-w-3xl mx-auto">
            {allMessages.map((msg) => {
                const senderIsMe = msg.senderId === currentUser.uid;
                const alignRight = senderIsMe;
                return (
                    <div key={msg.id} className={cn("flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300", alignRight ? "justify-end" : "justify-start")}>
                        <div className={cn("flex flex-col gap-1 max-w-[85%] sm:max-w-[70%]", alignRight ? "items-end text-right" : "items-start text-left")}>
                            {msg.messageType === 'product' ? <SharedProductCard productId={msg.productId!} /> : (msg.mediaUrl ? <MediaMessage message={msg} /> : (
                                <div className={cn(
                                    "rounded-xl px-3 py-2 text-[13px] font-medium leading-snug border shadow-sm break-words text-left", 
                                    alignRight ? "bg-primary text-white border-primary" : "bg-card text-foreground border-border"
                                )}>
                                    <p className="whitespace-pre-wrap">{msg.messageText}</p>
                                </div>
                            ))}
                            <div className={cn("flex items-center gap-1.5 px-1 opacity-40", alignRight ? "flex-row-reverse" : "flex-row")}>
                                <span className="text-[9px] font-black uppercase tracking-tighter">{msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}</span>
                                {senderIsMe && msg.isRead && (
                                    <span className="text-[9px] font-black uppercase text-primary flex items-center gap-0.5">
                                        <CheckCheck className="h-2 w-2" /> SEEN
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
            </div>
        </ScrollArea>

        <div className="p-2 sm:p-3 border-t bg-card/30 backdrop-blur-xl shrink-0 z-10 w-full overflow-hidden">
            {uploadProgress !== null && (
            <div className="mb-2 px-1 max-w-3xl mx-auto">
                <div className="flex justify-between text-[8px] font-black uppercase tracking-[0.2em] text-primary mb-1 animate-pulse"><span>SENDING...</span><span>{Math.round(uploadProgress)}%</span></div>
                <Progress value={uploadProgress} className="h-0.5 bg-primary/10" />
            </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); handleSendTextMessage(); }} className="flex items-center gap-1.5 w-full max-w-3xl mx-auto">
            <div className="flex items-center gap-1 shrink-0">
                <Avatar className="h-8 w-8 border border-primary/10 shrink-0">
                    <AvatarImage src={userProfile?.profilePictureUrl} />
                    <AvatarFallback className="bg-neutral-800 text-[9px] font-black uppercase">{userProfile?.username?.charAt(0)}</AvatarFallback>
                </Avatar>
                
                {userProfile?.userRole === 'seller' && (
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button type="button" size="icon" variant="outline" className="h-8 w-8 rounded-lg border-white/5 shrink-0 bg-neutral-900/50">
                                <Package className="h-3.5 w-3.5" />
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
                        "h-8 w-8 rounded-lg border-white/5 shrink-0 transition-all",
                        isAiOpen ? "bg-primary/20 text-primary border-primary/30" : "bg-neutral-900/50"
                    )} 
                    onClick={() => setIsAiOpen(!isAiOpen)}
                >
                    <Sparkles className="h-3.5 w-3.5" />
                </Button>
            </div>

            <div className="flex-1 min-w-0 relative">
                <Input 
                    placeholder={uploadProgress !== null ? "..." : "Write a message..."} 
                    className="w-full h-9 border border-white/5 bg-background/50 rounded-xl focus-visible:ring-primary text-[13px] px-3" 
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)} 
                    disabled={uploadProgress !== null} 
                />
            </div>
            
            <Button type="submit" size="icon" className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 shrink-0 shadow-lg shadow-primary/20 border-none" disabled={uploadProgress !== null || !newMessage.trim()}>
                <Send className="h-3.5 w-3.5" />
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
            toast({ title: 'Draft applied' });
        }}
      />
    </div>
  );
}
