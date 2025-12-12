
'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ShoppingBag, X, Loader2, Info } from 'lucide-react';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, limit, updateDoc, addDoc, onSnapshot, getDoc } from 'firebase/firestore';
import type { LiveSession, Product, SellerShop, UserProfile } from '@/lib/types';
import { BuyerLayout } from '@/components/layout/buyer-layout';

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};

function LiveRoomPage() {
  const params = useParams();
  const sellerId = params.sellerId as string;
  
  const [pinnedProduct, setPinnedProduct] = useState<Product | null>(null);
  const firestore = useFirestore();
  const router = useRouter();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [connectionState, setConnectionState] = useState<RTCIceConnectionState>('new');

  const liveSessionQuery = useMemoFirebase(() => {
    if (!sellerId || !firestore) return null;
    return query(collection(firestore, 'liveSessions'), where('sellerId', '==', sellerId), where('status', '==', 'live'), limit(1));
  }, [firestore, sellerId]);

  const { data: liveSessions, isLoading: isLiveSessionLoading } = useCollection<LiveSession>(liveSessionQuery);
  const liveSession = liveSessions?.[0];

  useEffect(() => {
    if (!liveSession || !firestore || !videoRef.current || pcRef.current) {
        if(liveSessions && liveSessions.length === 0 && !isLiveSessionLoading) {
            console.log('No live session found for this seller.');
        }
        return;
    }

    console.log('Found live session:', liveSession.id, " - setting up WebRTC connection...");
    let isMounted = true;
    let unsubscribeSession: (() => void) | undefined;
    let unsubscribeCandidates: (() => void) | undefined;

    const setupConnection = async () => {
        const peerConnection = new RTCPeerConnection(servers);
        pcRef.current = peerConnection;

        peerConnection.oniceconnectionstatechange = () => {
            if (isMounted) {
                console.log('Buyer ICE Connection State Change:', peerConnection.iceConnectionState);
                setConnectionState(peerConnection.iceConnectionState);
            }
        };

        peerConnection.ontrack = (event) => {
            console.log('Received remote video track from seller!');
            if (videoRef.current) {
                videoRef.current.srcObject = event.streams[0];
            }
        };

        try {
            const sessionRef = doc(firestore, 'liveSessions', liveSession.id);
            const offerCandidatesRef = collection(sessionRef, 'offerCandidates');
            const answerCandidatesRef = collection(sessionRef, 'answerCandidates');

            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('Buyer generated local ICE candidate:', event.candidate.type);
                    addDoc(answerCandidatesRef, event.candidate.toJSON());
                }
            };
            
            if (liveSession.offer) {
                console.log('Setting remote description from seller offer...');
                await peerConnection.setRemoteDescription(new RTCSessionDescription(liveSession.offer));
                
                console.log('Creating answer...');
                const answerDescription = await peerConnection.createAnswer();
                
                console.log('Setting local description with answer...');
                await peerConnection.setLocalDescription(answerDescription);
                
                console.log('Updating Firestore with answer...');
                await updateDoc(sessionRef, { answer: { type: answerDescription.type, sdp: answerDescription.sdp } });
                console.log('Successfully updated Firestore with answer.');
            }

            unsubscribeCandidates = onSnapshot(offerCandidatesRef, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added' && pcRef.current?.signalingState !== 'closed') {
                        console.log('Received remote ICE candidate from seller.');
                        pcRef.current.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                    }
                });
            });
        } catch (error) {
            console.error('!!! Buyer WebRTC setup failed:', error);
        }
    };

    setupConnection();

    return () => {
        console.log('Cleaning up buyer WebRTC connection for session:', liveSession?.id);
        isMounted = false;
        unsubscribeSession?.();
        unsubscribeCandidates?.();
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
    };
  }, [liveSession?.id, firestore, isLiveSessionLoading, liveSessions]);

  const sellerShopRef = useMemoFirebase(() => sellerId ? doc(firestore, 'sellerShops', sellerId) : null, [firestore, sellerId]);
  const { data: sellerShop, isLoading: isShopLoading } = useDoc<SellerShop>(sellerShopRef);

  const userProfileRef = useMemoFirebase(() => sellerId ? doc(firestore, 'userProfiles', sellerId) : null, [firestore, sellerId]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (liveSession?.id) {
        const sessionRef = doc(firestore, 'liveSessions', liveSession.id);
        unsubscribe = onSnapshot(sessionRef, (snap) => {
            const pinnedId = snap.data()?.pinnedProductId;
            if (pinnedId) {
                getDoc(doc(firestore, 'products', pinnedId)).then(productSnap => {
                    if (productSnap.exists()) setPinnedProduct({ id: productSnap.id, ...productSnap.data() } as Product);
                });
            } else {
                setPinnedProduct(null);
            }
        });
    }
    return () => unsubscribe?.();
  }, [liveSession?.id, firestore]);

  if (isLiveSessionLoading || isShopLoading || isProfileLoading) {
    return <div className="w-full h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!liveSession) {
    return (
        <div className="w-full h-screen flex items-center justify-center">
            <Card className="max-w-md text-center"><CardHeader><Info className="mx-auto h-12 w-12 text-muted-foreground"/></CardHeader><CardContent><h2 className='text-xl font-bold'>Stream Not Found</h2><p className='text-muted-foreground'>This live session has ended or does not exist.</p></CardContent><CardFooter><Button onClick={() => router.push('/buyer/live')} className="w-full">Back to Live Rooms</Button></CardFooter></Card>
        </div>
    );
  }

  const sellerName = sellerShop?.shopName || userProfile?.fullName || 'Seller';
  const sellerAvatar = sellerShop?.logoUrl || userProfile?.profilePictureUrl || 'https://picsum.photos/seed/avatar/80';

  const renderConnectionMessage = () => {
    switch (connectionState) {
        case 'new':
        case 'checking':
            return <><Loader2 className='animate-spin h-5 w-5' /> Connecting...</>;
        case 'failed':
        case 'disconnected':
        case 'closed':
            return <span className="text-red-500">Connection failed.</span>;
        case 'connected':
        case 'completed':
            return null; // Successfully connected, don't show a message
        default:
             return <><Loader2 className='animate-spin h-5 w-5' /> Status: {connectionState}</>;
    }
  };

  return (
    <BuyerLayout>
        <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
            <div className="flex-1 bg-black relative flex items-center justify-center">
                <div className='absolute z-10 flex items-center gap-2 text-white bg-black/50 px-3 py-2 rounded-lg'>{renderConnectionMessage()}</div>
                <video ref={videoRef} className="h-full w-full object-contain" autoPlay playsInline muted />
                <div className="absolute top-4 left-4 flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-black/50 p-2 rounded-lg">
                        <Avatar><AvatarImage src={sellerAvatar} /><AvatarFallback>{sellerName.charAt(0)}</AvatarFallback></Avatar>
                        <div><p className="font-bold text-white">{sellerName}</p><div className="flex items-center gap-1 text-xs text-white/80"><div className='h-2 w-2 rounded-full bg-red-500 animate-pulse'></div>LIVE</div></div>
                    </div>
                </div>
                <div className="absolute top-4 right-4 flex items-center gap-2"><Button variant='ghost' size='icon' className='bg-black/50 text-white rounded-full' onClick={() => router.back()}><X size={18} /></Button></div>
                {pinnedProduct && (
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm border border-primary/50 p-3 rounded-xl max-w-xs animate-in fade-in zoom-in-95">
                    <div className="flex gap-3">
                        <Image src={pinnedProduct.imageUrl || ''} alt={pinnedProduct.name || 'product'} width={80} height={80} className="w-20 h-20 object-cover rounded-md border" />
                        <div className="flex-1"><p className="font-semibold text-white text-sm">{pinnedProduct.name}</p><p className="text-primary font-bold">${pinnedProduct.price}</p><Button size="sm" className="mt-2 h-8 w-full bg-primary/20 text-primary-foreground hover:bg-primary/30 border border-primary"><ShoppingBag size={14} className='mr-2' /> Add to cart</Button></div>
                    </div>
                </div>
                )}
            </div>
        </div>
    </BuyerLayout>
  );
}

export default LiveRoomPage;

