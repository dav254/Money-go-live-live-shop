
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { collection, doc, getDoc, setDoc, serverTimestamp, updateDoc, getDocs } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { Seller, Product, LiveSession, UserProfile } from '@/lib/types';
import { useEffect, useState, useRef } from 'react';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Video, Loader2, Mic, MicOff, VideoOff, Settings, CheckCircle, CircleDotDashed, Users, ClipboardCopy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { query, where } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import MuxPlayer from "@mux/mux-player-react";

// --- The Page Component ---
export default function GoLivePage() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [streamTitle, setStreamTitle] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get Camera Permissions
  useEffect(() => {
    const init = async () => {
      if (typeof window !== 'undefined' && navigator.mediaDevices) {
        try {
          // Requesting just to check, not to use directly yet.
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
           stream.getTracks().forEach(track => track.stop()); // Stop tracks immediately after permission granted
        } catch (error) {
          console.error('Error accessing camera:', error);
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera and mic permissions in your browser to go live.',
          });
        }
      }
    };
    init();
  }, [toast]);


  // Fetch Seller and Product Data
  useEffect(() => {
    if (isUserLoading || !user || !firestore) {
      if (!isUserLoading) setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const userProfileRef = doc(firestore, 'userProfiles', user.uid);
        const userProfileSnap = await getDoc(userProfileRef);
        
        if (!userProfileSnap.exists() || userProfileSnap.data()?.userRole !== 'seller') {
          setError("Your account is not configured as a 'seller'.");
          setIsLoading(false);
          return;
        }

        const productsRef = collection(firestore, 'products');
        const q = query(productsRef, where('sellerId', '==', user.uid));
        const querySnapshot = await getDocs(q);

        const fetchedProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(fetchedProducts);

      } catch (err) {
        console.error("Error fetching seller data:", err);
        setError('An unexpected error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, firestore, isUserLoading]);
  
  const handleGoLive = async () => {
      if (!user || !firestore || !streamTitle) {
          toast({ variant: 'destructive', title: 'Stream title is required.' });
          return;
      }
      setIsSubmitting(true);
      
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/mux', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }});
        
        if (!response.ok) {
           const errorData = await response.json();
           throw new Error(errorData.error || 'Failed to create Mux live stream.');
        }

        const { streamKey, playbackId, streamId } = await response.json();
        
        const newSessionRef = doc(collection(firestore, 'liveSessions'));
        const newSessionData: LiveSession = {
            id: newSessionRef.id,
            sellerId: user.uid,
            title: streamTitle,
            status: 'live',
            productIds: selectedProducts,
            viewerCount: 0,
            muxStreamId: streamId,
            muxStreamKey: streamKey,
            muxPlaybackId: playbackId,
            startTime: serverTimestamp() as any,
        };

        await setDoc(newSessionRef, newSessionData);
        setLiveSession(newSessionData);
        setIsLive(true);
        toast({ title: "You are now live!", description: "Your stream has started successfully." });

      } catch (error: any) {
          console.error("Failed to start live session:", error);
          toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not start the live session.' });
      } finally {
          setIsSubmitting(false);
      }
  };
  
  const handleEndLive = async () => {
    if (!liveSession || !firestore) return;
    setIsSubmitting(true);
    
    const sessionRef = doc(firestore, 'liveSessions', liveSession.id);
    try {
        await updateDoc(sessionRef, {
            status: 'ended',
            endTime: serverTimestamp()
        });
        setIsLive(false);
        setLiveSession(null);
        setStreamTitle('');
        setSelectedProducts([]);
        toast({ title: 'Stream Ended', description: 'Your live session has successfully ended.' });
    } catch (error) {
         console.error("Failed to end live session:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not end the live session.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isLoading || isUserLoading) {
    return (
      <SellerLayout>
        <div className="flex h-full w-full items-center justify-center">
            <p>Loading your live studio...</p>
        </div>
      </SellerLayout>
    );
  }
  
  if (error) {
    return (
      <SellerLayout>
        <div className="flex h-full flex-col items-center justify-center p-4 text-center">
            <h2 className="text-xl font-bold">Could not load your seller profile.</h2>
            <p className="max-w-md text-muted-foreground">{error}</p>
        </div>
      </SellerLayout>
    );
  }

  return (
     <SellerLayout>
        <div className="container mx-auto max-w-6xl py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left side: Preview & Broadcast Info */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="overflow-hidden">
                        <div className="relative aspect-video bg-black">
                            {isLive && liveSession?.muxStreamKey ? (
                                 <MuxPlayer
                                    streamType="ll-live"
                                    playbackId={liveSession.muxPlaybackId}
                                    streamKey={liveSession.muxStreamKey}
                                    className="w-full h-full"
                                    autoPlay
                                    muted
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-black">
                                    <p className="text-muted-foreground">Your live stream preview will appear here.</p>
                                </div>
                            )}
                             {isLive && (
                                <div className="absolute top-4 left-4 flex items-center gap-2">
                                    <Badge className="bg-red-500 hover:bg-red-600 border-none"><CircleDotDashed className="mr-2 h-4 w-4 animate-pulse" /> LIVE</Badge>
                                    <Badge variant="secondary"><Users className="mr-2 h-4 w-4" /> 0</Badge>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
                {/* Right side: Controls */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Stream Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="stream-title">Stream Title</Label>
                                <Input id="stream-title" placeholder="e.g., Unboxing New Arrivals!" value={streamTitle} onChange={(e) => setStreamTitle(e.target.value)} disabled={isLive} />
                            </div>
                            <div>
                                <Label>Featured Products ({selectedProducts.length})</Label>
                                 <ScrollArea className="h-64 mt-2 rounded-md border">
                                    <div className="p-4 space-y-3">
                                        {products.length > 0 ? products.map(product => (
                                            <div key={product.id} className="flex items-start gap-3">
                                                <Checkbox 
                                                    id={`prod-${product.id}`}
                                                    checked={selectedProducts.includes(product.id)}
                                                    onCheckedChange={(checked) => {
                                                        setSelectedProducts(prev => checked ? [...prev, product.id] : prev.filter(id => id !== product.id))
                                                    }}
                                                    disabled={isLive}
                                                />
                                                <Label htmlFor={`prod-${product.id}`} className="flex items-center gap-3 cursor-pointer">
                                                    <Image src={product.imageUrl || getPlaceholderImage()} alt={product.name || ''} width={40} height={40} className="rounded-md object-cover aspect-square" />
                                                    <span className="font-normal">{product.name}</span>
                                                </Label>
                                            </div>
                                        )) : <p className="text-sm text-muted-foreground text-center py-8">No products found to feature.</p>}
                                    </div>
                                </ScrollArea>
                            </div>
                        </CardContent>
                    </Card>
                    <div className="flex flex-col gap-3">
                         {isLive ? (
                            <Button onClick={handleEndLive} variant="destructive" size="lg" className="font-bold" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <VideoOff className="mr-2 h-4 w-4"/>}
                                End Live Session
                            </Button>
                         ) : (
                            <Button onClick={handleGoLive} size="lg" className="font-bold" disabled={isSubmitting || !streamTitle}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Video className="mr-2 h-4 w-4"/>}
                                Go Live Now
                            </Button>
                         )}
                         <Alert variant="default" className="text-center">
                            <CheckCircle className="h-4 w-4" />
                            <AlertTitle>You are a Live Partner!</AlertTitle>
                            <AlertDescription>
                                All live selling features are unlocked for your account.
                            </AlertDescription>
                        </Alert>
                    </div>
                </div>
            </div>
        </div>
     </SellerLayout>
  );
}
