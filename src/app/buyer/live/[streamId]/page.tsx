'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Peer } from 'peerjs';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Loader2, WifiOff, User, RadioTower } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import type { LiveSession } from '@/lib/types';

const PEER_CONFIG = {
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
        ]
    }
};

const BuyerLiveStreamPage = () => {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const sellerId = params.streamId as string;
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer | null>(null);
    
    const [status, setStatus] = useState<'INITIALIZING' | 'CHECKING_STATUS' | 'SELLER_OFFLINE' | 'CONNECTING' | 'CALLING' | 'CONNECTED' | 'ERROR'>('INITIALIZING');

    const sessionRef = useMemoFirebase(() => {
        if (!firestore || !sellerId) return null;
        return doc(firestore, 'liveSessions', sellerId);
    }, [firestore, sellerId]);
    
    const { data: liveSession, isLoading: isSessionLoading } = useDoc<LiveSession>(sessionRef);

    const initializePeerAndConnect = useCallback(async (offer: any) => {
        if (typeof window === 'undefined') return;

        setStatus('CONNECTING');
        import('peerjs').then(async ({ default: Peer }) => {
            if (peerRef.current) {
                peerRef.current.destroy();
            }

            const peer = new Peer(undefined, PEER_CONFIG);
            peerRef.current = peer;

            peer.on('open', async () => {
                setStatus('CALLING');
                if (!peerRef.current || !firestore) return;
                
                const conn = peerRef.current.connect(sellerId);
                conn.on('open', async () => {
                    const remoteOffer = new RTCSessionDescription(offer);
                    const peerConnection = (peerRef.current as any).connections[sellerId][0].peerConnection;
                    await peerConnection.setRemoteDescription(remoteOffer);
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);

                    const sessionDoc = doc(firestore, 'liveSessions', sellerId);
                    await updateDoc(sessionDoc, { answer: { type: answer.type, sdp: answer.sdp } });
                    
                    const call = peerRef.current.call(sellerId, new MediaStream());
                    
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
    }, [sellerId, firestore, toast, router]);

    useEffect(() => {
        if (!sellerId) return;
        if (isSessionLoading) {
            setStatus('CHECKING_STATUS');
            return;
        }

        if (!liveSession || liveSession.status !== 'live' || !liveSession.offer) {
            setStatus('SELLER_OFFLINE');
            return;
        }
        
        initializePeerAndConnect(liveSession.offer);

        return () => {
            if (peerRef.current) {
                peerRef.current.destroy();
            }
        };
    }, [sellerId, liveSession, isSessionLoading, initializePeerAndConnect]);

    const renderStatus = () => {
        const messages = {
            'INITIALIZING': { icon: Loader2, text: 'Initializing...' },
            'CHECKING_STATUS': { icon: Loader2, text: 'Checking stream status...' },
            'SELLER_OFFLINE': { icon: WifiOff, text: 'This seller is not currently live.' },
            'CONNECTING': { icon: Loader2, text: 'Connecting to live network...' },
            'CALLING': { icon: RadioTower, text: 'Calling seller...' },
            'ERROR': { icon: WifiOff, text: 'Could not connect to the stream.' },
            'CONNECTED': null,
        };

        const currentStatus = messages[status];
        if (!currentStatus) return null;

        const Icon = currentStatus.icon;

        return (
            <div className="flex flex-col items-center gap-4 text-center p-4 rounded-lg bg-black/50 text-white">
                 <Icon className={`h-8 w-8 ${status === 'CONNECTING' || status === 'CALLING' || status === 'INITIALIZING' || status === 'CHECKING_STATUS' ? 'animate-spin' : ''} ${status === 'SELLER_OFFLINE' || status === 'ERROR' ? 'text-red-500' : ''}`} />
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
                <div className="absolute inset-0 flex items-center justify-center">
                    {renderStatus()}
                </div>
            </div>
        </BuyerLayout>
    );
};

export default BuyerLiveStreamPage;
