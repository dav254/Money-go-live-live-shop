'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image';
import { FlipHorizontal, Users, Heart, Camera, Gift, Zap, Loader2, MessageSquare, Send, CheckCircle, Package, Truck, XCircle, MoreVertical } from 'lucide-react';
import { LiveActivityFeed } from '@/components/studio/LiveActivityFeed';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import type { LiveSession, Product, ChatMessage, Chat, UserProfile } from '@/lib/types';
import { collection, doc, addDoc, updateDoc, serverTimestamp, query, where, orderBy, setDoc, onSnapshot, getDocs, arrayUnion } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SellerLayout } from '@/components/layout/seller-layout';


const MultiBuyerChat = ({ liveSessionId }: { liveSessionId: string | null }) => {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [text, setText] = useState("");
  
  const chatsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'chats'), where('participantIds', 'array-contains', user.uid), orderBy('lastMessageTimestamp', 'desc'));
  }, [user, firestore]);

  const { data: chats, isLoading: isLoadingChats } = useCollection<Chat>(chatsQuery);

  const participantIds = useMemo(() => {
    if (!chats) return [];
    const ids = new Set<string>();
    chats.forEach(chat => {
      chat.participantIds.forEach(id => {
        if (id !== user?.uid) ids.add(id);
      });
    });
    return Array.from(ids);
  }, [chats, user]);

  const [participants, setParticipants] = useState<Map<string, UserProfile>>(new Map());

  useEffect(() => {
    if (participantIds.length > 0 && firestore) {
      const usersQuery = query(collection(firestore, 'userProfiles'), where('id', 'in', participantIds));
      getDocs(usersQuery).then(snapshot => {
        const newParticipants = new Map<string, UserProfile>();
        snapshot.forEach(doc => {
          newParticipants.set(doc.id, doc.data() as UserProfile);
        });
        setParticipants(newParticipants);
      });
    }
  }, [participantIds, firestore]);
  
  const messagesQuery = useMemoFirebase(() => {
    if (!selectedChat) return null;
    return query(collection(firestore, 'chats', selectedChat.id, 'messages'), orderBy('timestamp', 'asc'));
  }, [firestore, selectedChat]);

  const { data: messages, isLoading: isLoadingMessages } = useCollection<ChatMessage>(messagesQuery);
  
  const handleSendMessage = async () => {
    if (!text.trim() || !selectedChat || !user) return;
    
    const messagesRef = collection(firestore, 'chats', selectedChat.id, 'messages');
    await addDoc(messagesRef, {
      senderId: user.uid,
      messageText: text,
      messageType: 'text',
      timestamp: serverTimestamp(),
    });

    const chatRef = doc(firestore, 'chats', selectedChat.id);
    await updateDoc(chatRef, {
        lastMessage: text,
        lastMessageTimestamp: serverTimestamp(),
    });
    
    setText("");
  };

  const selectedParticipant = selectedChat ? participants.get(selectedChat.participantIds.find(id => id !== user?.uid) || '') : null;

  return (
    <Card className="bg-card/50 flex flex-col h-full p-0">
        <div className="h-full flex flex-col">
          {/* Buyer List */}
          <div className="flex-shrink-0 p-2 border-b border-neutral-800">
            <h2 className="text-lg font-bold">Buyers</h2>
            <ScrollArea className="h-28">
                <div className="flex gap-2 p-2">
                    {isLoadingChats ? <p className="text-sm text-muted-foreground p-2">Loading chats...</p> : 
                    (chats || []).map((chat) => {
                    const participant = participants.get(chat.participantIds.find(id => id !== user?.uid) || '');
                    if (!participant) return null;

                    return (
                        <div
                        key={chat.id}
                        onClick={() => setSelectedChat(chat)}
                        className={cn(
                            'p-2 rounded-md cursor-pointer text-sm flex flex-col items-center gap-1 w-20 transition-colors',
                            selectedChat?.id === chat.id ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted/80"
                        )}
                        >
                        <Avatar className="h-10 w-10"><AvatarImage src={participant.profilePictureUrl} /><AvatarFallback>{participant.fullName.charAt(0)}</AvatarFallback></Avatar>
                        <p className="font-semibold truncate text-xs">{participant.fullName}</p>
                        </div>
                    );
                    })}
                </div>
            </ScrollArea>
          </div>

          {/* Chat Window */}
          <div className="flex-1 flex flex-col min-h-0">
            {selectedChat && selectedParticipant ? (
              <>
                {/* Header */}
                <div className="p-3 border-b border-neutral-800 font-bold text-sm">
                  Chat with {selectedParticipant.fullName}
                </div>
                {/* Messages */}
                <ScrollArea className="flex-1">
                    <div className="p-4 space-y-3">
                      {isLoadingMessages ? <p>Loading...</p> : 
                      (messages || []).map((msg, i) => (
                          <div key={i} className={cn("p-2 rounded-lg text-sm w-fit", msg.senderId === user?.uid ? "bg-primary ml-auto" : "bg-neutral-800")}>
                              {msg.messageText}
                          </div>
                      ))}
                    </div>
                </ScrollArea>

                {/* Input */}
                <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="p-3 flex gap-2 border-t border-neutral-800 bg-neutral-900/50">
                  <Input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={`Reply to ${selectedParticipant.fullName}...`}
                    className="flex-1 bg-neutral-800 p-2 rounded outline-none border-neutral-700"
                  />
                  <Button type="submit" className="bg-primary hover:bg-primary/90">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </>
            ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">Select a chat to view messages</div>
            )}
          </div>
        </div>
    </Card>
  )
}

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};


export default function SellerLiveStudioPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [isStartingStream, setIsStartingStream] = useState(false);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  
  const productsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [user, firestore]);

  const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

  const [pinnedProduct, setPinnedProduct] = useState<Product | null>(null);
  
  const startCamera = useCallback(async (facingMode: 'user' | 'environment' = 'user') => {
    try {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: true });
      setLocalStream(s);
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error("Camera error", err);
      setHasCameraPermission(false);
    }
  }, [localStream]);

  const switchCamera = useCallback(async () => {
    if (!localStream) {
      startCamera();
      return;
    }
    const currentTrack = localStream.getVideoTracks()[0];
    if (!currentTrack) return;
    const currentFacingMode = currentTrack.getSettings().facingMode;
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    startCamera(newFacingMode);
  }, [localStream, startCamera]);

  const handleGoLive = async () => {
    if (!firestore || !user || !localStream) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not start stream. Ensure camera is enabled.' });
        return;
    }

    setIsStartingStream(true);

    const peerConnection = new RTCPeerConnection(servers);
    setPc(peerConnection);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    const sessionCollectionRef = collection(firestore, 'liveSessions');
    const sessionRef = doc(sessionCollectionRef);
    setLiveSessionId(sessionRef.id);

    const offerCandidatesRef = collection(sessionRef, 'offerCandidates');
    const answerCandidatesRef = collection(sessionRef, 'answerCandidates');

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            addDoc(offerCandidatesRef, event.candidate.toJSON());
        }
    };

    const offerDescription = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offerDescription);

    const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
    };

    await setDoc(sessionRef, {
        id: sessionRef.id,
        sellerId: user.uid,
        title: `${user.displayName || 'Seller'}'s Live Show`,
        status: 'live',
        productIds: [],
        viewerCount: 0,
        startTime: serverTimestamp(),
        offer,
    });

    onSnapshot(sessionRef, (snapshot) => {
        const data = snapshot.data();
        if (!peerConnection.currentRemoteDescription && data?.answer) {
            const answerDescription = new RTCSessionDescription(data.answer);
            peerConnection.setRemoteDescription(answerDescription);
        }
    });

    onSnapshot(answerCandidatesRef, snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                peerConnection.addIceCandidate(candidate);
            }
        });
    });

    setIsLive(true);
    setIsStartingStream(false);
    toast({ title: "You are now live!", description: "Buyers can join your stream." });
  };
  
  const handleEndLive = async () => {
    if (liveSessionId && firestore) {
      const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
      await updateDoc(sessionRef, { status: 'ended', endTime: serverTimestamp() });
    }
    pc?.close();
    setPc(null);
    setIsLive(false);
    setLiveSessionId(null);
    setPinnedProduct(null);
    toast({ title: "Stream Ended", description: "Your live session has concluded." });
  };

  const handlePinProduct = async (product: Product) => {
    setPinnedProduct(product);
    if(liveSessionId && firestore) {
        const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
        await updateDoc(sessionRef, { pinnedProductId: product.id });
    }
  };

  const handleUnpinProduct = async () => {
    setPinnedProduct(null);
     if(liveSessionId && firestore) {
        const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
        await updateDoc(sessionRef, { pinnedProductId: null });
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      pc?.close();
      localStream?.getTracks().forEach(track => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const createLiveEvent = (eventData: object) => {
      if (!liveSessionId || !firestore) {
          toast({ variant: 'destructive', title: 'Not Live', description: 'You must be live to send events.' });
          return;
      }
      const eventsRef = collection(firestore, 'liveSessions', liveSessionId, 'events');
      addDoc(eventsRef, { ...eventData, timestamp: serverTimestamp() });
  };

  const handleStartFlashDeal = () => {
      // In a real app, you would get this from a dialog
      const dealPercent = 20; 
      const text = `⚡️ FLASH SALE: ${dealPercent}% OFF! ⚡️`;
      createLiveEvent({ type: 'deal', text });
      toast({ title: "Flash Deal Started!", description: "Buyers will now see the deal banner." });
  };

  const handleStartGiveaway = () => {
       // In a real app, you would get this from a dialog
      const giveawayItem = 'A Free T-shirt';
      const text = `🎉 GIVEAWAY: ${giveawayItem} 🎉`;
      createLiveEvent({ type: 'giveaway', text });
      toast({ title: "Giveaway Announced!", description: "Buyers will now see the announcement." });
  };

  return (
    <SellerLayout>
        <div className="p-4 max-w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-4rem)]">
            <div className="lg:col-span-8 xl:col-span-9 space-y-4 flex flex-col">
            <div className="relative bg-black rounded-lg border border-border overflow-hidden aspect-video flex items-center justify-center">
                <video
                id="studio-preview"
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
                />
                {!hasCameraPermission && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-4">
                        <Alert variant="destructive" className="max-w-sm">
                            <AlertTitle>Camera Access Required</AlertTitle>
                            <AlertDescription>
                                Please allow camera access to use this feature. Check your browser settings.
                            </AlertDescription>
                        </Alert>
                    </div>
                )}
                {pinnedProduct && (
                <div className="absolute left-4 bottom-4 bg-black/70 border border-primary p-3 rounded-xl max-w-xs animate-in fade-in zoom-in-95">
                    <div className="flex gap-3">
                    <Image src={pinnedProduct.imageUrl || ''} alt={pinnedProduct.name || 'product'} width={64} height={64} className="w-16 h-16 object-cover rounded" />
                    <div>
                        <p className="font-semibold text-sm">{pinnedProduct.name}</p>
                        <p className="text-primary font-bold">${pinnedProduct.price}</p>
                        <Button size="sm" className="mt-1 h-7" onClick={handleUnpinProduct}>Unpin</Button>
                    </div>
                    </div>
                </div>
                )}
                <div className="absolute top-3 left-3 flex gap-2">
                {isLive && (
                    <div className="px-2 py-1 rounded text-xs font-semibold bg-red-600 animate-pulse flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-white"></div>
                        LIVE
                    </div>
                )}
                </div>
                <div className="absolute top-3 right-3">
                    <Button variant="ghost" size="icon" className="bg-black/50" onClick={switchCamera}><FlipHorizontal size={18}/></Button>
                </div>
            </div>

            <Card className="bg-card/50">
                <CardContent className="p-3 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={() => startCamera()} variant="secondary"><Camera className="mr-2 h-4 w-4" /> Start Camera</Button>
                    {!isLive ? (
                    <Button onClick={handleGoLive} className="bg-red-600 hover:bg-red-700 font-bold" disabled={isStartingStream || !hasCameraPermission}>
                        {isStartingStream && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Go Live
                    </Button>
                    ) : (
                    <Button onClick={handleEndLive} variant="destructive">End Live</Button>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" onClick={handleStartFlashDeal}><Zap className="mr-2 h-4 w-4 text-yellow-400"/> Flash Deal</Button>
                    <Button variant="outline" onClick={handleStartGiveaway}><Gift className="mr-2 h-4 w-4 text-pink-400"/> Giveaway</Button>
                </div>
                </CardContent>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow min-h-0">
                <Card className="bg-card/50 p-4 rounded-lg">
                    <h3 className="font-semibold text-base mb-2">Product Shelf</h3>
                    <ScrollArea className="h-full max-h-96">
                        <div className="space-y-2 pr-3">
                        {areProductsLoading && <p>Loading products...</p>}
                        {products?.map(p => (
                            <div key={p.id} className="flex items-center gap-3 bg-background/50 p-2 rounded">
                            <Image src={p.imageUrl || 'https://picsum.photos/seed/placeholder/80'} alt={p.name || 'product'} width={56} height={56} className="w-14 h-14 object-cover rounded" />
                            <div className="flex-1">
                                <p className="font-semibold text-sm">{p.name}</p>
                                <p className="text-primary font-bold text-sm">${p.price}</p>
                            </div>
                            <Button size="sm" onClick={() => handlePinProduct(p)} variant={pinnedProduct?.id === p.id ? 'default' : 'secondary'} disabled={!isLive}>
                                {pinnedProduct?.id === p.id ? 'Pinned' : 'Pin'}
                            </Button>
                            </div>
                        ))}
                        </div>
                    </ScrollArea>
                </Card>
                <Card className="bg-card/50 p-4 rounded-lg">
                    <h3 className="font-semibold text-base mb-2">Live Activity</h3>
                    <LiveActivityFeed liveSessionId={liveSessionId} />
                </Card>
            </div>
            </div>

            <div className="lg:col-span-4 xl:col-span-3 flex flex-col h-full">
                <MultiBuyerChat liveSessionId={liveSessionId} />
            </div>
        </div>
    </SellerLayout>
  );
}
