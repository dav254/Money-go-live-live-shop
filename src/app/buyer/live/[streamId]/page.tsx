
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Peer, MediaConnection } from 'peerjs';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Loader2, WifiOff, User, RadioTower } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { LiveSession } from '@/lib/types';

const BuyerLiveStreamPage = () => {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const sellerId = params.streamId as string;
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer | null>(null);
    
    const [status, setStatus] = useState<'INITIALIZING' | 'CHECKING_STATUS' | 'SELLER_OFFLINE' | 'CONNECTING' | 'CALLING' | 'CONNECTED' | 'ERROR'>('INITIALIZING');

    // 1. Check Firestore first to see if the seller is actually live
    const sessionRef = useMemoFirebase(() => {
        if (!firestore || !sellerId) return null;
        return doc(firestore, 'liveSessions', sellerId);
    }, [firestore, sellerId]);
    
    const { data: liveSession, isLoading: isSessionLoading } = useDoc<LiveSession>(sessionRef);

    useEffect(() => {
        if (isSessionLoading) {
            setStatus('CHECKING_STATUS');
            return;
        }

        if (!liveSession || liveSession.status !== 'live') {
            setStatus('SELLER_OFFLINE');
            return;
        }

        // 2. If seller is live, then proceed with PeerJS connection
        if (typeof window === 'undefined' || !sellerId) {
            return;
        }

        setStatus('CONNECTING');
        import('peerjs').then(({ default: Peer }) => {
            if (peerRef.current) {
                peerRef.current.destroy();
            }

            const peer = new Peer();
            peerRef.current = peer;

            peer.on('open', (buyerId) => {
                setStatus('CALLING');
                console.log(`Buyer PeerJS client is open with ID: ${buyerId}. Calling seller: ${sellerId}`);

                const call = peer.call(sellerId, new MediaStream());

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
                    toast({ variant: 'destructive', title: 'Stream Error', description: `Could not connect to the stream. Please check the ID and if the seller is live.` });
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
                } else {
                    toast({ variant: 'destructive', title: 'Connection Failed', description: 'Could not connect to the live streaming network.' });
                }
            });
        });

        // Cleanup on component unmount
        return () => {
            if (peerRef.current) {
                peerRef.current.destroy();
            }
        };
    }, [sellerId, toast, router, liveSession, isSessionLoading]);

    const renderStatus = () => {
        switch (status) {
            case 'INITIALIZING':
            case 'CHECKING_STATUS':
                 return <div className="flex flex-col items-center gap-2"><Loader2 className="h-8 w-8 animate-spin" /><p>Checking stream status...</p></div>;
            case 'SELLER_OFFLINE':
                return <div className="flex flex-col items-center gap-2 text-center max-w-sm"><RadioTower className="h-8 w-8 text-destructive" /><p>This seller is not currently live. Please check back later.</p><Button onClick={() => router.push('/buyer/live')} className="mt-4">Back to Live List</Button></div>;
            case 'CONNECTING':
                return <div className="flex flex-col items-center gap-2"><Loader2 className="h-8 w-8 animate-spin" /><p>Connecting to live network...</p></div>;
            case 'CALLING':
                return <div className="flex flex-col items-center gap-2"><Loader2 className="h-8 w-8 animate-spin" /><p>Calling seller: {sellerId}...</p></div>;
            case 'CONNECTED':
                return null; // Video will be playing
            case 'ERROR':
                 return <div className="flex flex-col items-center gap-2 text-center max-w-sm"><WifiOff className="h-8 w-8 text-destructive" /><p>Connection failed. Please check the Seller ID and ensure they are live.</p><Button onClick={() => router.push('/buyer/live')} className="mt-4">Go Back</Button></div>;
            default:
                return null;
        }
    };

    return (
        <BuyerLayout>
            <div className="h-[calc(100vh-4rem)] bg-black text-white flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-contain ${status !== 'CONNECTED' ? 'hidden' : ''}`} />
                <div className="absolute inset-0 flex items-center justify-center">
                    {renderStatus()}
                </div>
            </div>
        </BuyerLayout>
    );
};

export default BuyerLiveStreamPage;

