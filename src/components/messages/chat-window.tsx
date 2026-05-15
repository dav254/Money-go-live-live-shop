
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
    X,
    ChevronRight,
    Paperclip,
    ImageIcon,
    FileText,
    Mic,
    Square,
    Play,
    Pause,
    Volume2,
    CreditCard,
    ShieldCheck
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { Chat, ChatMessage, Product, UserProfile, Order } from '@/lib/types';
import type { User } from 'firebase/auth';
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile, useDoc } from '@/firebase';
import { collection, addDoc, serverTimestamp, orderBy, query, where, doc, updateDoc, arrayUnion, getDoc, writeBatch, increment, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogDescription, DialogFooter } from '../ui/dialog';
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
import { Label } from '@/components/ui/label';

interface ChatWindowProps {
  chat: Chat | null;
  currentUser: User | null;
  onChatDeleted: () => void;
  onBack: () => void;
}

const OrderPaymentCard = ({ orderId }: { orderId: string }) => {
    const firestore = useFirestore();
    const orderRef = useMemoFirebase(() => doc(firestore, 'orders', orderId), [firestore, orderId]);
    const { data: order, isLoading } = useDoc<Order>(orderRef);

    if (isLoading) return <div className="w-[240px] h-32 rounded-2xl border bg-card animate-pulse" />;
    if (!order) return <div className="p-3 text-[10px] italic text-muted-foreground">Order no longer available.</div>;

    const isPending = order.orderStatus === 'pending';

    return (
        <div className="w-[260px] rounded-2xl border-2 border-primary/20 bg-card overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="bg-primary/5 p-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3 text-primary" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-primary">Secure Invoice</span>
                </div>
                <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 text-primary">
                    {order.orderStatus}
                </Badge>
            </div>
            <div className="p-4 space-y-3">
                <div className="flex gap-3">
                    <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden border bg-black">
                        <Image src={order.productImage || '/placeholder.svg'} alt="product" fill className="object-cover" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-[11px] truncate text-white leading-tight">{order.productName}</p>
                        <p className="text-[14px] font-black text-primary mt-1">${order.totalAmount.toLocaleString()}</p>
                    </div>
                </div>
                
                {isPending ? (
                    <Button asChild className="w-full h-10 font-black uppercase tracking-widest text-[10px] bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/20 border-none">
                        <Link href={`/checkout/${order.id}`}>
                            PAY NOW <ChevronRight className="ml-1 h-3 w-3" />
                        </Link>
                    </Button>
                ) : (
                    <div className="flex items-center justify-center gap-2 p-2 bg-green-500/10 rounded-xl border border-green-500/20">
                        <CheckCheck className="h-3 w-3 text-green-500" />
                        <span className="text-[10px] font-black uppercase text-green-500 tracking-widest">ORDER PAID</span>
                    </div>
                )}
            </div>
            <div className="bg-muted/30 p-2 text-center border-t border-white/5">
                <p className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter">Powered by Go Earn Checkout</p>
            </div>
        </div>
    );
};

const SharedProductCard = ({ productId }: { productId: string }) => {
    const firestore = useFirestore();
    const productRef = useMemoFirebase(() => doc(firestore, 'products', productId), [firestore, productId]);
    const { data: product, isLoading } = useDoc<Product>(productRef);

    if (isLoading) return <div className="max-w-[180px] rounded-xl border bg-background p-2 shadow-sm animate-pulse h-20 w-full"></div>;
    if (!product) return <div className="max-w-[180px] rounded-xl border bg-background p-2 shadow-sm"><p className="text-[9px] text-muted-foreground italic text-left">Product unavailable.</p></div>;

     return (
        <div className="max-w-[200px] rounded-xl border bg-card p-2 shadow-md hover:border-primary transition-all group overflow-hidden text-left">
            <div className="flex gap-2">
                <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border">
                     <Image 
                        src={product.imageUrl || 'https://picsum.photos/seed/product/100/100'} 
                        alt={product.name || 'product'} 
                        fill 
                        className="object-cover group-hover:scale-110 transition-transform duration-500" 
                    />
                </div>
                <div className="flex-1 min-w-0 text-left">
                    <p className="font-black text-[7px] uppercase tracking-widest text-primary mb-0.5">PRODUCT</p>
                    <p className="font-bold text-[10px] truncate mb-0.5 leading-none">{product.name}</p>
                    <p className="text-[11px] font-black text-foreground">${product.price.toLocaleString()}</p>
                    <Button size="sm" className="mt-1 h-5 w-full text-[8px] font-black uppercase tracking-widest px-2" asChild>
                        <Link href={`/products/${product.id}`}>View</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
};

const CreateInvoiceDialog = ({ sellerId, buyerId, onSend }: { sellerId: string; buyerId: string; onSend: (orderId: string) => void }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [agreedPrice, setAgreedPrice] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const productsQuery = useMemoFirebase(() => query(collection(firestore, 'products'), where('sellerId', '==', sellerId)), [firestore, sellerId]);
    const { data: products, isLoading } = useCollection<Product>(productsQuery);

    const handleCreateOrder = async () => {
        if (!selectedProductId || !agreedPrice) return;
        setIsCreating(true);
        const product = products?.find(p => p.id === selectedProductId);
        if (!product) return;

        const newOrderRef = doc(collection(firestore, 'orders'));
        const orderData = {
            id: newOrderRef.id,
            buyerId,
            sellerId,
            productId: product.id,
            productName: product.name,
            productImage: product.imageUrl,
            productPrice: Number(agreedPrice),
            shippingCost: product.shippingCost || 0,
            totalAmount: Number(agreedPrice) + (product.shippingCost || 0),
            orderDate: serverTimestamp(),
            orderStatus: 'pending',
            shippingAddress: 'N/A (Update at checkout)',
            quantity: 1,
            timeline: [{ status: 'pending', date: new Date() }]
        };

        try {
            await setDoc(newOrderRef, orderData);
            onSend(newOrderRef.id);
            toast({ title: 'Invoice Sent!', description: 'Buyer can now pay via the Pay Now button.' });
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to create invoice.' });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
                <DialogTitle className="font-black text-base uppercase tracking-tighter">Send Secure Invoice</DialogTitle>
                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Confirm the deal with a payment link.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Product</Label>
                    <ScrollArea className="h-40 border rounded-xl bg-muted/20">
                        <div className="p-2 space-y-1">
                            {products?.map(p => (
                                <button 
                                    key={p.id} 
                                    onClick={() => setSelectedProductId(p.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 p-2 rounded-lg border transition-all text-left",
                                        selectedProductId === p.id ? "bg-primary/10 border-primary shadow-sm" : "bg-transparent border-transparent hover:bg-muted"
                                    )}
                                >
                                    <div className="relative h-8 w-8 rounded-md overflow-hidden bg-black shrink-0">
                                        <Image src={p.imageUrl || '/placeholder.svg'} alt="p" fill className="object-cover" />
                                    </div>
                                    <span className="text-[11px] font-bold truncate flex-1">{p.name}</span>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Agreed Price (USD)</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary" />
                        <Input 
                            type="number" 
                            placeholder="0.00" 
                            className="pl-9 h-11 bg-muted/30 border-white/10 rounded-xl font-black text-base"
                            value={agreedPrice}
                            onChange={e => setAgreedPrice(e.target.value)}
                        />
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button 
                    className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs" 
                    onClick={handleCreateOrder}
                    disabled={isCreating || !selectedProductId || !agreedPrice}
                >
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    SEND INVOICE
                </Button>
            </DialogFooter>
        </DialogContent>
    );
};

const VoiceMessage = ({ message }: { message: ChatMessage }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const onEnded = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  return (
    <div className="flex items-center gap-3 bg-card border rounded-2xl p-2 min-w-[200px] shadow-sm">
      <audio ref={audioRef} src={message.mediaUrl} onTimeUpdate={onTimeUpdate} onEnded={onEnded} className="hidden" />
      <Button 
        size="icon" 
        variant="ghost" 
        className="h-8 w-8 rounded-full bg-primary/10 text-primary shrink-0"
        onClick={togglePlay}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </Button>
      <div className="flex-1 space-y-1">
        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-[8px] font-black uppercase text-muted-foreground tracking-widest">
            <span className="flex items-center gap-1"><Volume2 className="h-2 w-2" /> Voice Note</span>
            <span>{message.mediaMetadata?.duration ? `${Math.floor(message.mediaMetadata.duration)}s` : 'Voice'}</span>
        </div>
      </div>
    </div>
  );
};

const MediaMessage = ({ message }: { message: ChatMessage }) => {
  if (message.messageType === 'voice') return <VoiceMessage message={message} />;
  if (!message.mediaUrl || !message.mediaMetadata) return null;
  const { name, type } = message.mediaMetadata;
  const isImage = type.startsWith('image/');
  const isVideo = type.startsWith('video/');

  if (isImage) {
    return (
      <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border shadow-sm max-w-full">
        <Image 
            src={message.mediaUrl} 
            alt={name || 'image'} 
            width={180} 
            height={180} 
            className="max-w-full h-auto object-cover hover:scale-105 transition-transform duration-500" 
        />
      </a>
    );
  }
  if (isVideo) {
    return <video src={message.mediaUrl} controls className="max-w-[180px] sm:max-w-full rounded-xl border shadow-sm bg-black" />;
  }
  return (
    <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex max-w-[200px] items-center gap-2 rounded-xl border bg-card p-2 shadow-sm hover:bg-muted transition-colors">
      <div className="p-1.5 bg-primary/10 rounded-lg"><FileText className="h-4 w-4 text-primary" /></div>
      <div className="overflow-hidden flex-1">
        <p className="truncate font-bold text-[10px] text-foreground">{name}</p>
        <p className="text-[8px] text-muted-foreground uppercase font-black tracking-widest">{(message.mediaMetadata.size / 1024).toFixed(1)} KB</p>
      </div>
      <Download className="h-3.5 w-3.5 text-muted-foreground" />
    </a>
  );
};

const ShareProductDialog = ({ sellerId, onShare }: { sellerId: string; onShare: (productId: string) => void }) => {
    const firestore = useFirestore();
    const productsQuery = useMemoFirebase(() => query(collection(firestore, 'products'), where('sellerId', '==', sellerId)), [firestore, sellerId]);
    const { data: products, isLoading } = useCollection<Product>(productsQuery);

    return (
        <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader><DialogTitle className="font-black text-base uppercase tracking-tighter">My Catalog</DialogTitle></DialogHeader>
            <ScrollArea className="h-72">
                <div className="space-y-2 p-2">
                    {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
                    {products?.map(product => (
                        <div key={product.id} className="flex items-center gap-3 p-2 rounded-xl bg-muted/30 border border-transparent hover:border-primary/30 transition-all group text-left">
                            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border bg-black">
                                <Image 
                                    src={product.imageUrl || '/placeholder.svg'} 
                                    alt={product.name || 'product'} 
                                    fill 
                                    className="object-cover group-hover:scale-110 transition-transform" 
                                />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="font-bold text-[11px] truncate leading-none mb-1">{product.name}</p>
                                <p className="text-[9px] font-black text-primary">${product.price.toLocaleString()}</p>
                            </div>
                            <DialogClose asChild>
                                <Button size="sm" className="font-black text-[8px] uppercase tracking-widest px-2 h-6" onClick={() => onShare(product.id)}>Send</Button>
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
  const storage = getStorage();
  const { userProfile } = useUserProfile(currentUser?.uid);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [otherParticipantProfile, setOtherParticipantProfile] = useState<UserProfile | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
        
        batch.update(doc(firestore, 'chats', chat.id), {
            [`unreadCounts.${currentUser.uid}`]: 0
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
          await addDoc(collection(firestore, 'chats', chat.id, 'messages'), { 
              senderId: currentUser.uid, 
              timestamp: serverTimestamp(), 
              isRead: false, 
              ...messageData 
          });

          const otherId = chat.participantIds.find(id => id !== currentUser.uid);
          const updateObj: any = { 
              lastMessage: messageData.messageType === 'voice' ? 'Sent a voice note' : (messageData.messageText || 'Sent a file'), 
              lastMessageTimestamp: serverTimestamp(),
              deletedFor: [] 
          };
          
          if (otherId) {
              updateObj[`unreadCounts.${otherId}`] = increment(1);
          }

          await updateDoc(doc(firestore, 'chats', chat.id), updateObj);
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chat || !currentUser) return;

    const path = `chats/${chat.id}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Upload error:", error);
        toast({ variant: 'destructive', title: 'Upload Failed' });
        setUploadProgress(null);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
        
        await sendMessage({
          messageType: type,
          mediaUrl: url,
          mediaMetadata: { name: file.name, size: file.size, type: file.type }
        });
        
        setUploadProgress(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    );
  };

  const handleShareProduct = useCallback((productId: string) => {
    sendMessage({ messageType: 'product', productId }).catch(error => {
        console.error("Error sharing product:", error);
        toast({ variant: 'destructive', title: 'Share Failed' });
    });
  }, [chat, currentUser, firestore, toast]);

  const handleSendInvoice = useCallback((orderId: string) => {
    sendMessage({ messageType: 'order', orderId }).catch(error => {
        console.error("Error sending invoice:", error);
        toast({ variant: 'destructive', title: 'Invoice Failed' });
    });
  }, [chat, currentUser, firestore, toast]);

  // Voice Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { 
          mimeType: 'audio/webm',
          audioBitsPerSecond: 32000
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const finalDuration = recordingTime;
        
        if (audioBlob.size > 500) {
            const path = `chats/${chat!.id}/${Date.now()}_voice_note.webm`;
            const storageRef = ref(storage, path);
            const uploadTask = uploadBytesResumable(storageRef, audioBlob);
            
            setUploadProgress(1);

            uploadTask.on('state_changed', 
                (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                null,
                async () => {
                    const url = await getDownloadURL(uploadTask.snapshot.ref);
                    await sendMessage({
                        messageType: 'voice',
                        mediaUrl: url,
                        mediaMetadata: { name: 'Voice Note', size: audioBlob.size, type: 'audio/webm', duration: finalDuration }
                    });
                    setUploadProgress(null);
                }
            );
        }
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      toast({ variant: 'destructive', title: 'Microphone Error', description: 'Please enable microphone access.' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      audioChunksRef.current = [];
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  if (!chat || !currentUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-muted/5 p-8 text-center h-full w-full">
        <div className="max-w-xs space-y-3">
            <div className="p-2.5 bg-primary/10 rounded-full w-fit mx-auto">
                <MessageSquare className="h-7 w-7 text-primary opacity-30" />
            </div>
            <h3 className="font-black text-base uppercase tracking-tighter text-foreground">Your Inbox</h3>
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest leading-relaxed">Select a conversation to start messaging buyers or sellers.</p>
        </div>
      </div>
    );
  }

  const isOnline = otherParticipantProfile?.lastSeen ? (Date.now() - otherParticipantProfile.lastSeen.toMillis() < 120000) : false;
  const allMessages = [...(serverMessages || []), ...optimisticMessages];

  return (
    <div className="flex h-full w-full bg-background overflow-hidden relative">
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <div className="flex items-center justify-between border-b px-4 md:px-6 py-2.5 bg-card/30 backdrop-blur-xl shrink-0 z-10 w-full">
            <div className="flex items-center gap-3 overflow-hidden min-w-0">
            <Button variant="ghost" size="icon" className="md:hidden rounded-full shrink-0 h-7 w-7" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
            <div className="relative shrink-0">
                <Avatar className="h-8 w-8 md:h-9 md:w-9 border border-primary/10 shadow-md">
                    <AvatarImage src={otherParticipantProfile?.profilePictureUrl} alt={otherParticipantProfile?.fullName || 'User'} />
                    <AvatarFallback className="bg-neutral-800 text-[8px] font-black uppercase">{otherParticipantProfile?.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 border border-background rounded-full", isOnline ? "bg-green-500" : "bg-neutral-500")} />
            </div>
            <div className="overflow-hidden">
                <p className="font-black text-[11px] md:text-xs uppercase tracking-tight truncate leading-none mb-0.5">{otherParticipantProfile?.fullName}</p>
                <span className="text-[7px] font-black text-muted-foreground/60 uppercase tracking-widest leading-none block truncate">
                    {isOnline ? 'Online' : otherParticipantProfile?.lastSeen ? `Seen ${formatDistanceToNow(otherParticipantProfile.lastSeen.toDate(), { addSuffix: true })}` : 'Offline'}
                </span>
            </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-full h-7 w-7 shrink-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-2xl">
                    <DropdownMenuItem className="text-destructive text-[10px] font-bold uppercase tracking-widest" onClick={() => updateDoc(doc(firestore, 'chats', chat.id), { deletedFor: arrayUnion(currentUser.uid) }).then(onChatDeleted)}>
                        <Trash2 className="mr-2 h-3 w-3" /> Delete Chat
                    </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        <ScrollArea className="flex-1 w-full" ref={scrollAreaRef}>
            <div className="px-4 md:px-8 py-4 space-y-4 pb-12 w-full">
            {allMessages.map((msg) => {
                const senderIsMe = msg.senderId === currentUser.uid;
                const alignRight = senderIsMe;
                return (
                    <div key={msg.id} className={cn("flex w-full animate-in fade-in slide-in-from-bottom-1 duration-300", alignRight ? "justify-end" : "justify-start")}>
                        <div className={cn("flex flex-col gap-0.5 max-w-[85%] sm:max-w-[75%] lg:max-w-[60%]", alignRight ? "items-end text-right" : "items-start text-left")}>
                            {msg.messageType === 'order' && msg.orderId ? (
                                <OrderPaymentCard orderId={msg.orderId} />
                            ) : msg.messageType === 'product' ? (
                                <SharedProductCard productId={msg.productId!} />
                            ) : (msg.mediaUrl ? <MediaMessage message={msg} /> : (
                                <div className={cn(
                                    "rounded-xl px-3 py-2 text-sm font-medium leading-relaxed border shadow-sm break-words overflow-hidden text-left", 
                                    alignRight ? "bg-primary text-white border-primary" : "bg-card text-foreground border-border"
                                )}>
                                    <p className="whitespace-pre-wrap break-words overflow-hidden" style={{ overflowWrap: 'anywhere' }}>{msg.messageText}</p>
                                </div>
                            ))}
                            <div className={cn("flex items-center gap-1 px-1 opacity-40 mt-1", alignRight ? "flex-row-reverse" : "flex-row")}>
                                <span className="text-[8px] font-black uppercase tracking-tighter">{msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}</span>
                                {senderIsMe && msg.isRead && (
                                    <span className="text-[8px] font-black uppercase text-primary flex items-center gap-0.5">
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

        <div className="px-4 md:px-6 py-3 border-t bg-card/30 backdrop-blur-xl shrink-0 z-10 w-full overflow-hidden">
            <div className="max-w-[90%] mx-auto">
                {uploadProgress !== null && (
                    <div className="mb-3 space-y-1.5 animate-in slide-in-from-bottom-2">
                        <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-primary">
                            <span>{isRecording ? 'Uploading Voice Note...' : 'Uploading Media...'}</span>
                            <span>{Math.round(uploadProgress)}%</span>
                        </div>
                        <Progress value={uploadProgress} className="h-1 bg-white/10" />
                    </div>
                )}
                
                {isRecording ? (
                    <div className="flex items-center gap-3 bg-red-600/10 border border-red-600/30 rounded-2xl p-2 animate-in slide-in-from-bottom-4">
                        <div className="flex items-center gap-2 px-3 animate-pulse">
                            <div className="h-2 w-2 rounded-full bg-red-600" />
                            <span className="text-xs font-black text-red-600 font-mono">00:{recordingTime.toString().padStart(2, '0')}</span>
                        </div>
                        <div className="flex-1 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Recording audio...</div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-neutral-500" onClick={cancelRecording}><Trash2 className="h-4 w-4" /></Button>
                        <Button size="icon" className="h-9 w-9 bg-red-600 hover:bg-red-700 text-white rounded-xl" onClick={stopRecording}><Square className="h-4 w-4" /></Button>
                    </div>
                ) : (
                    <form onSubmit={(e) => { e.preventDefault(); handleSendTextMessage(); }} className="flex items-center gap-1.5 w-full">
                    <div className="flex items-center gap-1 shrink-0">
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={handleFileSelect} 
                        />
                        <Button 
                            type="button" 
                            size="icon" 
                            variant="outline" 
                            className="h-8 w-8 rounded-xl border-white/5 shrink-0 bg-neutral-900/50"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadProgress !== null}
                        >
                            <PlusCircle className="h-4 w-4" />
                        </Button>
                        
                        {userProfile?.userRole === 'seller' && (
                            <>
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button type="button" size="icon" variant="outline" className="h-8 w-8 rounded-xl border-white/5 shrink-0 bg-neutral-900/50">
                                            <Package className="h-4 w-4" />
                                        </Button>
                                    </DialogTrigger>
                                    <ShareProductDialog sellerId={currentUser.uid} onShare={handleShareProduct} />
                                </Dialog>
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button type="button" size="icon" variant="outline" className="h-8 w-8 rounded-xl border-white/5 shrink-0 bg-primary/10 text-primary">
                                            <CreditCard className="h-4 w-4" />
                                        </Button>
                                    </DialogTrigger>
                                    <CreateInvoiceDialog 
                                        sellerId={currentUser.uid} 
                                        buyerId={otherParticipantProfile?.id || ''} 
                                        onSend={handleSendInvoice} 
                                    />
                                </Dialog>
                            </>
                        )}
                    </div>

                    <div className="flex-1 min-w-0 relative">
                        <Input 
                            placeholder="Message..." 
                            className="w-full h-9 border border-white/5 bg-background/50 rounded-xl focus-visible:ring-primary text-[12px] px-3" 
                            value={newMessage} 
                            onChange={(e) => setNewMessage(e.target.value)} 
                        />
                    </div>
                    
                    {newMessage.trim() ? (
                        <Button type="submit" size="icon" className="h-9 w-9 rounded-xl bg-primary hover:bg-primary/90 shrink-0 shadow-sm border-none">
                            <Send className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button 
                            type="button" 
                            size="icon" 
                            className="h-9 w-9 rounded-xl bg-neutral-800 hover:bg-neutral-700 shrink-0 shadow-sm border-none"
                            onClick={startRecording}
                            disabled={uploadProgress !== null}
                        >
                            <Mic className="h-4 w-4" />
                        </Button>
                    )}
                    </form>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
