
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Peer } from 'peerjs';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Loader2, WifiOff, User, RadioTower } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import type { LiveSession } from '@/lib/types';

const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' },
    ],
  },
};

const BuyerLiveStreamPage = () => {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const sellerId = params.streamId as string;
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer | null>(null);
    const callRef = useRef<any>(null);
    
    const [status, setStatus] = useState<'INITIALIZING' | 'WAITING_FOR_SELLER' | 'SELLER_OFFLINE' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>('INITIALIZING');

    // Effect to listen for the live session document in real-time
    useEffect(() => {
        if (!firestore || !sellerId) return;

        setStatus('WAITING_FOR_SELLER');
        const sessionRef = doc(firestore, 'liveSessions', sellerId);
        
        const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
            if (snapshot.exists() && snapshot.data()?.status === 'live') {
                // Seller is live, now we can connect.
                connectToPeer();
            } else {
                // Seller is not live or the session has ended.
                if (status !== 'SELLER_OFFLINE' && status !== 'INITIALIZING') {
                   setStatus('SELLER_OFFLINE');
                }
            }
        }, (error) => {
            console.error("Error subscribing to live session:", error);
            setStatus('ERROR');
        });
        
        // Timeout to prevent waiting forever if seller never appears
        const timeoutId = setTimeout(() => {
            if (status === 'WAITING_FOR_SELLER') {
                setStatus('SELLER_OFFLINE');
            }
        }, 15000); // 15-second timeout

        return () => {
            unsubscribe();
            clearTimeout(timeoutId);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firestore, sellerId]);


    const connectToPeer = useCallback(() => {
        if (status === 'CONNECTING' || status === 'CONNECTED' || typeof window === 'undefined' || !sellerId) return;

        setStatus('CONNECTING');
        import('peerjs').then(async ({ default: Peer }) => {
            if (peerRef.current) {
                peerRef.current.destroy();
            }

            const peer = new Peer(PEER_CONFIG); // Let PeerJS assign a random ID
            peerRef.current = peer;

            peer.on('open', (id) => {
                if (!peerRef.current) return;
                
                const call = peerRef.current.call(sellerId, new MediaStream());
                callRef.current = call;
                
                call.on('stream', (remoteStream) => {
                    if (videoRef.current) {
                        videoRef.current.srcObject = remoteStream;
                        videoRef.current.play().catch(e => console.error("Video play failed", e));
                    }
                    setStatus('CONNECTED');
                    toast({ title: "Connected!", description: "You are now watching the live stream." });
                });

                call.on('error', (err) => {
                    console.error('Call error:', err);
                    setStatus('ERROR');
                    toast({ variant: 'destructive', title: 'Stream Error', description: `Could not connect to the stream.` });
                });

                call.on('close', () => {
                    toast({ title: 'Stream Ended', description: 'The live stream has been ended by the seller.' });
                    router.push('/buyer/live');
                });
            });

            peer.on('error', (err) => {
                console.error('PeerJS connection error:', err);
                setStatus('ERROR');
                if (err.type === 'peer-unavailable') {
                    toast({ variant: 'destructive', title: 'Seller Offline', description: 'The seller is not currently live or the ID is incorrect.' });
                    setStatus('SELLER_OFFLINE');
                } else {
                    toast({ variant: 'destructive', title: 'Connection Failed', description: 'Could not connect to the live streaming network.' });
                }
            });
        });
    }, [sellerId, toast, router, status]);

    useEffect(() => {
        return () => {
            if (callRef.current) callRef.current.close();
            if (peerRef.current) peerRef.current.destroy();
        };
    }, []);

    const renderStatus = () => {
        const messages = {
            'INITIALIZING': { icon: Loader2, text: 'Initializing...' },
            'WAITING_FOR_SELLER': { icon: Loader2, text: 'Waiting for seller to go live...' },
            'SELLER_OFFLINE': { icon: WifiOff, text: 'This seller is not currently live.' },
            'CONNECTING': { icon: RadioTower, text: 'Connecting to live stream...' },
            'ERROR': { icon: WifiOff, text: 'Could not connect to the stream.' },
            'CONNECTED': null,
        };

        const currentStatus = messages[status];
        if (!currentStatus) return null;

        const Icon = currentStatus.icon;

        return (
            <div className="flex flex-col items-center gap-4 text-center p-4 rounded-lg bg-black/50 text-white">
                 <Icon className={`h-8 w-8 ${status.includes('ING') || status.includes('WAITING') ? 'animate-spin' : ''} ${status === 'SELLER_OFFLINE' || status === 'ERROR' ? 'text-red-500' : ''}`} />
                <p className="font-semibold">{currentStatus.text}</p>
                {(status === 'SELLER_OFFLINE' || status === 'ERROR') && (
                    <Button onClick={() => router.push('/buyer/live')}>Back to Live List</Button>
                )}
            </div>
        )
    };

    return (
        <BuyerLayout>
            <div className="h-[calc(100vh-4rem)] bg-black text-white flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-contain ${status !== 'CONNECTED' ? 'hidden' : ''}`} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {renderStatus()}
                </div>
            </div>
        </BuyerLayout>
    );
};

export default BuyerLiveStreamPage;
