
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import { useParams } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, VideoOff, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const BuyerLiveStreamPage = () => {
    const params = useParams();
    const sellerId = params.streamId as string;
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Initializing...');
    const peerRef = useRef<Peer | null>(null);
    const { toast } = useToast();
    
    useEffect(() => {
        if (!sellerId) {
            setStatus('No Seller ID provided in URL.');
            return;
        }
        
        setStatus('Connecting to Peer network...');

        let peer: Peer;
        try {
             peer = new Peer({
                host: '0.peerjs.com',
                port: 443,
                path: '/',
                secure: true,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' },
                        { urls: "stun:stun1.l.google.com:19302" },
                        { urls: "stun:stun2.l.google.com:19302" },
                    ]
                }
            });
        } catch (error) {
            console.error("Failed to create Peer instance", error);
            setStatus("Failed to initialize connection.");
            toast({ variant: "destructive", title: "Connection Error", description: "Could not initialize the real-time connection."});
            return;
        }

        peerRef.current = peer;

        peer.on('open', (id) => {
            setStatus(`Calling seller...`);
            console.log('My peer ID is: ' + id);
            
            if (!peerRef.current) {
                setStatus('Connection lost before call.');
                return;
            }

            const call = peerRef.current.call(sellerId, undefined as any);

            if (!call) {
                setStatus('Could not initiate call. Please check the Seller ID and try again.');
                toast({ variant: "destructive", title: "Call Failed", description: "Unable to connect to the seller. They may not be live." });
                return;
            }

            setStatus('Waiting for stream...');

            call.on('stream', (remoteStream) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
                setStatus('Connected! Watching Live.');
            });

            call.on('error', (err) => {
                console.error("Call error:", err);
                setStatus('Error connecting to stream. The seller might have disconnected.');
                toast({ variant: "destructive", title: "Stream Error", description: "Lost connection to the stream." });
            });

            call.on('close', () => {
                setStatus('The stream has ended.');
            });
        });

        peer.on('error', (err) => {
            console.error('PeerJS error:', err);
            let description = 'An unknown connection error occurred.';
            if (err.type === 'peer-unavailable') {
                description = `Could not find the seller. Please check the ID and ensure they are live.`;
            }
            setStatus(`Connection error: ${description}`);
            toast({ variant: "destructive", title: "Connection Failed", description });
        });

        return () => {
            peer.destroy();
        };
    }, [sellerId, toast]);

    return (
        <BuyerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                 <h1 className="font-headline text-3xl font-bold tracking-tight">Live Stream</h1>
                <Card>
                    <CardHeader>
                        <CardTitle>Watching Seller: <span className="font-mono text-sm">{sellerId}</span></CardTitle>
                        <CardDescription>{status}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="aspect-video w-full bg-black rounded-lg overflow-hidden flex items-center justify-center relative">
                            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
                            {!status.startsWith('Connected!') && (
                                <div className="absolute flex flex-col items-center gap-2 text-muted-foreground">
                                    {status.includes('Calling') || status.includes('Connecting') || status.includes('Initializing') ? 
                                        <Loader2 className="h-8 w-8 animate-spin" /> : 
                                        <WifiOff className="h-8 w-8" />
                                    }
                                    <p>{status}</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </BuyerLayout>
    );
};

export default BuyerLiveStreamPage;
