
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Peer, MediaConnection } from 'peerjs';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Loader2, WifiOff, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

const BuyerLiveStreamPage = () => {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const sellerId = params.streamId as string;
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer | null>(null);
    const [status, setStatus] = useState<'CONNECTING' | 'CALLING' | 'CONNECTED' | 'ERROR'>('CONNECTING');

    useEffect(() => {
        if (typeof window === 'undefined' || !sellerId) return;

        import('peerjs').then(({ default: Peer }) => {
            const peer = new Peer(); // Create a peer for the buyer with a random ID
            peerRef.current = peer;

            peer.on('open', (buyerId) => {
                setStatus('CALLING');
                console.log(`Buyer PeerJS client is open with ID: ${buyerId}. Calling seller: ${sellerId}`);

                // Now that we are connected to the PeerJS server, we can make a call.
                const call = peer.call(sellerId, new MediaStream()); // Send an empty stream initially

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
                    toast({ variant: 'destructive', title: 'Stream Error', description: 'Could not connect to the stream.' });
                });

                call.on('close', () => {
                    toast({ title: 'Stream Ended', description: 'The live stream has been ended by the seller.' });
                    router.push('/buyer/live');
                });
            });

            peer.on('error', (err) => {
                console.error('PeerJS connection error:', err);
                setStatus('ERROR');
                toast({ variant: 'destructive', title: 'Connection Failed', description: 'Could not connect to the live streaming network.' });
            });
        });

        // Cleanup on component unmount
        return () => {
            if (peerRef.current) {
                peerRef.current.destroy();
            }
        };
    }, [sellerId, toast, router]);

    const renderStatus = () => {
        switch (status) {
            case 'CONNECTING':
                return <div className="flex flex-col items-center gap-2"><Loader2 className="h-8 w-8 animate-spin" /><p>Connecting to live network...</p></div>;
            case 'CALLING':
                return <div className="flex flex-col items-center gap-2"><Loader2 className="h-8 w-8 animate-spin" /><p>Calling seller: {sellerId}...</p></div>;
            case 'CONNECTED':
                return null; // Video will be playing
            case 'ERROR':
                 return <div className="flex flex-col items-center gap-2"><WifiOff className="h-8 w-8 text-destructive" /><p>Connection failed. Please check the Seller ID and try again.</p><Button onClick={() => router.push('/buyer/live')} className="mt-4">Go Back</Button></div>;
            default:
                return null;
        }
    };

    return (
        <BuyerLayout fullWidth={true}>
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
