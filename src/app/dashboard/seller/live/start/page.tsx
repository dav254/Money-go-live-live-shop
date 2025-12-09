
'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
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
import type { LiveSession, Product, ChatMessage } from '@/lib/types';
import { collection, doc, addDoc, updateDoc, serverTimestamp, query, where, orderBy, setDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';


const MultiBuyerChat = ({ liveSessionId }: { liveSessionId: string | null }) => {
  const [selectedBuyer, setSelectedBuyer] = useState("John");
  const [text, setText] = useState("");

  const buyers = ["John", "Mary", "David", "Aisha"];

  const chats = {
    John: ["Hi seller", "How much is it?"],
    Mary: ["Is it still available?"],
    David: [],
    Aisha: ["Can you ship to Mombasa?"]
  };

  return (
    <Card className="bg-card/50 flex flex-col h-[calc(100vh-28rem)] max-h-[500px] p-0">
        <div className="h-full flex">
          {/* Buyer List */}
          <div className="w-1/3 bg-neutral-900/50 p-3 border-r border-neutral-800 overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Buyers</h2>
            {buyers.map((name) => (
              <div
                key={name}
                onClick={() => setSelectedBuyer(name)}
                className={`p-2 rounded cursor-pointer mb-1 text-sm flex items-center gap-2 ${
                  selectedBuyer === name ? "bg-primary" : "bg-neutral-800 hover:bg-neutral-700"
                }`}
              >
                <Avatar className="h-6 w-6"><AvatarFallback>{name.charAt(0)}</AvatarFallback></Avatar>
                <span>{name}</span>
              </div>
            ))}
          </div>

          {/* Chat Window */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="p-3 border-b border-neutral-800 font-bold text-sm">
              Chat with {selectedBuyer}
            </div>
            {/* Messages */}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                {(chats[selectedBuyer as keyof typeof chats] || []).map((msg, i) => (
                    <div key={i} className="bg-neutral-800 p-2 rounded-lg text-sm w-fit">
                    <span className="font-bold text-muted-foreground mr-2">{selectedBuyer}:</span>{msg}
                    </div>
                ))}
                </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-3 flex gap-2 border-t border-neutral-800 bg-neutral-900/50">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Reply to ${selectedBuyer}...`}
                className="flex-1 bg-neutral-800 p-2 rounded outline-none border-neutral-700"
              />
              <Button
                onClick={() => {
                  alert(`Reply sent to ${selectedBuyer}: ${text}`);
                  setText("");
                }}
                className="bg-primary hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
    </Card>
  )
}


export default function SellerLiveStudioPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [stream, setStream] = useState<MediaStream | null>(null);
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
  
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [isGiveawayModalOpen, setIsGiveawayModalOpen] = useState(false);
  const [dealPercent, setDealPercent] = useState(20);
  const [giveawayItem, setGiveawayItem] = useState("A Free T-Shirt!");

  async function startCamera(facingMode: 'user' | 'environment' = 'user') {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: true });
      setStream(s);
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error("Camera error", err);
      setHasCameraPermission(false);
      toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings.',
      });
    }
  }

  async function switchCamera() {
    if (!stream) {
      startCamera();
      return;
    }
    const currentTrack = stream.getVideoTracks()[0];
    if (!currentTrack) return;
    const currentFacingMode = currentTrack.getSettings().facingMode;
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    startCamera(newFacingMode);
  }

  const handleGoLive = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'You must be logged in to go live.' });
      return;
    }
    setIsStartingStream(true);
    
    try {
      const newSessionRef = doc(collection(firestore, 'liveSessions'));

      await setDoc(newSessionRef, {
        id: newSessionRef.id,
        sellerId: user.uid,
        title: `${user.displayName || 'Seller'}'s Live Show`,
        status: 'live',
        productIds: [],
        viewerCount: 0,
        startTime: serverTimestamp(),
      });
      
      setLiveSessionId(newSessionRef.id);
      setIsLive(true);
      toast({ title: "You are now live!", description: "Your stream is visible to buyers." });

    } catch (error: any) {
      console.error("Error going live:", error);
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setIsStartingStream(false);
    }
  };
  
  const handleEndLive = async () => {
    if (!liveSessionId) return;

    const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
    await updateDoc(sessionRef, {
      status: 'ended',
      endTime: serverTimestamp(),
    });
    setIsLive(false);
    setLiveSessionId(null);
    setPinnedProduct(null);
    toast({ title: "Stream Ended", description: "Your live session has concluded." });
  };

  const handlePinProduct = async (product: Product) => {
    if (!liveSessionId) return;
    setPinnedProduct(product);
    const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
    await updateDoc(sessionRef, { pinnedProductId: product.id });
  };

  const handleUnpinProduct = async () => {
    if (!liveSessionId) return;
    setPinnedProduct(null);
    const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
    await updateDoc(sessionRef, { pinnedProductId: null });
  };

  useEffect(() => {
    startCamera();
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);
  
  const createLiveEvent = async (eventData: object) => {
      if (!liveSessionId || !firestore) {
          toast({ variant: 'destructive', title: 'Not Live', description: 'You must be live to send events.' });
          return;
      }
      const eventsRef = collection(firestore, 'liveSessions', liveSessionId, 'events');
      await addDoc(eventsRef, {
          ...eventData,
          timestamp: serverTimestamp()
      });
  };

  const spawnHeart = () => {
    createLiveEvent({ type: 'heart' });
  };
  
  const handleStartFlashDeal = () => {
      const text = `⚡️ FLASH SALE: ${dealPercent}% OFF! ⚡️`;
      createLiveEvent({ type: 'deal', text });
      setIsDealModalOpen(false);
      toast({ title: "Flash Deal Started!", description: "Buyers will now see the deal banner." });
  };

  const handleStartGiveaway = () => {
      const text = `🎉 GIVEAWAY: ${giveawayItem} 🎉`;
      createLiveEvent({ type: 'giveaway', text });
      setIsGiveawayModalOpen(false);
      toast({ title: "Giveaway Announced!", description: "Buyers will now see the announcement." });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground">
      <div className="p-4 max-w-full mx-auto grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="relative bg-black rounded-lg border border-border overflow-hidden aspect-video">
            <video
              id="studio-preview"
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
            {!hasCameraPermission && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                    <Alert variant="destructive" className="max-w-sm">
                        <AlertTitle>Camera Access Required</AlertTitle>
                        <AlertDescription>
                            Please allow camera access to use this feature.
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
              <div className="px-2 py-1 rounded text-xs font-semibold bg-muted">PREVIEW</div>
               {isLive && <div className="px-2 py-1 rounded text-xs font-semibold bg-red-600 animate-pulse">LIVE</div>}
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
                  <Button onClick={handleGoLive} className="bg-red-600 hover:bg-red-700 font-bold" disabled={isStartingStream}>
                    {isStartingStream && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Go Live
                  </Button>
                ) : (
                  <Button onClick={handleEndLive} variant="destructive">End Live</Button>
                )}
              </div>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="bg-card/50 p-4 rounded-lg">
                <h3 className="font-semibold text-base mb-2">Rehearsal Tools</h3>
                <div className="flex flex-col gap-2">
                    <Dialog open={isDealModalOpen} onOpenChange={setIsDealModalOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline"><Zap className="mr-2 h-4 w-4 text-yellow-400"/> Start Flash Deal</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Simulate a Flash Deal</DialogTitle></DialogHeader>
                            <div className="py-4 space-y-2">
                                <Label>Discount Percentage</Label>
                                <Input type="number" value={dealPercent} onChange={e => setDealPercent(Number(e.target.value))} />
                            </div>
                            <DialogFooter><Button onClick={handleStartFlashDeal}>Show Banner</Button></DialogFooter>
                        </DialogContent>
                    </Dialog>
                     <Dialog open={isGiveawayModalOpen} onOpenChange={setIsGiveawayModalOpen}>
                        <DialogTrigger asChild>
                             <Button variant="outline"><Gift className="mr-2 h-4 w-4 text-pink-400"/> Create Giveaway</Button>
                        </DialogTrigger>
                         <DialogContent>
                            <DialogHeader><DialogTitle>Simulate a Giveaway</DialogTitle></DialogHeader>
                            <div className="py-4 space-y-2">
                                <Label>Prize</Label>
                                <Input value={giveawayItem} onChange={e => setGiveawayItem(e.target.value)} />
                            </div>
                            <DialogFooter><Button onClick={handleStartGiveaway}>Show Banner</Button></DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Button variant="outline" onClick={spawnHeart}><Heart className="mr-2 h-4 w-4 text-red-400"/> Simulate Reactions</Button>
                </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-4">
          <Card className="bg-card/50">
            <CardHeader><CardTitle className="text-base">Product Shelf</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] pr-3">
                <div className="space-y-2">
                  {areProductsLoading && <p>Loading products...</p>}
                  {products?.map(p => (
                    <div key={p.id} className="flex items-center gap-3 bg-background/50 p-2 rounded">
                      <Image src={p.imageUrl || 'https://picsum.photos/seed/placeholder/80'} alt={p.name || 'product'} width={56} height={56} className="w-14 h-14 object-cover rounded" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{p.name}</p>
                        <p className="text-primary font-bold text-sm">${p.price}</p>
                      </div>
                      <Button size="sm" onClick={() => handlePinProduct(p)} variant="secondary" disabled={!isLive}>Pin</Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <Button variant="outline" className="w-full mt-3">Add New Product</Button>
            </CardContent>
          </Card>
          <MultiBuyerChat liveSessionId={liveSessionId} />
        </div>
      </div>
    </div>
  );
}
