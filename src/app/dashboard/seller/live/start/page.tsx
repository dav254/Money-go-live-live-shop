
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, RadioTower, VideoOff, Wifi, Loader2 } from 'lucide-react';
import { useUser } from '@/firebase';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const SellerLivePage = () => {
    const { user } = useUser();
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const [status, setStatus] = useState('Initializing...');
    const [isLive, setIsLive] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (!user) {
            setStatus("Please log in to start a stream.");
            return;
        }

        const setupLiveStream = async () => {
            // 1. Get Camera and Mic permissions
            setStatus("Accessing camera...");
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localStreamRef.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
                setStatus("Camera is active. Connecting to live server...");
            } catch (err) {
                console.error('Failed to get local stream', err);
                setStatus('Error: Failed to access camera. Please check permissions.');
                toast({
                    variant: 'destructive',
                    title: 'Camera Access Denied',
                    description: 'Please enable camera permissions in your browser settings to go live.',
                });
                return; // Stop if camera fails
            }

            // 2. Initialize PeerJS connection
            try {
                const peer = new Peer(user.uid, {
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
                peerRef.current = peer;

                peer.on('open', (id) => {
                    console.log('PeerJS connection open. My peer ID is: ' + id);
                    setStatus('Broadcasting! You are live.');
                    setIsLive(true);
                    toast({ title: "You are live!", description: "Your stream is now active." });
                });

                peer.on('call', (call) => {
                    if (localStreamRef.current) {
                        call.answer(localStreamRef.current);
                        setStatus('Connected to a viewer!');
                        toast({ title: "Viewer Connected!", description: "A buyer has joined your stream." });
                        call.on('close', () => {
                            setStatus('Viewer disconnected. Waiting for new viewers.');
                        });
                    }
                });

                peer.on('error', (err) => {
                    console.error('PeerJS error:', err);
                    setStatus(`Error: ${err.message}`);
                    toast({ variant: "destructive", title: "Connection Error", description: err.message });
                });

            } catch (error) {
                console.error("Failed to create Peer instance", error);
                setStatus("Error: Could not initialize peer connection.");
                toast({ variant: "destructive", title: "Connection Error", description: "Could not initialize real-time connection."});
            }
        };

        setupLiveStream();

        return () => {
            localStreamRef.current?.getTracks().forEach(track => track.stop());
            peerRef.current?.destroy();
        };
    }, [user, toast]);

    const copyToClipboard = () => {
        if (!user?.uid) return;
        navigator.clipboard.writeText(user.uid).then(() => {
            setIsCopied(true);
            toast({ title: 'Copied!', description: 'Your Live ID has been copied.' });
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    return (
        <SellerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Live Stream Studio</h1>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <RadioTower className={isLive ? "text-red-500 animate-pulse" : "text-primary"} />
                           Your Live Session
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                            {status.includes('...') && <Loader2 className="h-4 w-4 animate-spin" />}
                            {status}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="aspect-video w-full bg-black rounded-lg overflow-hidden flex items-center justify-center relative">
                             <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                             {!isLive && !status.includes('Error') && (
                                 <div className="absolute flex flex-col items-center gap-2 text-white/70">
                                    <Loader2 className="h-10 w-10 animate-spin" />
                                    <p>{status}</p>
                                </div>
                             )}
                              {status.includes('Error') && (
                                <div className="absolute flex flex-col items-center gap-2 text-destructive">
                                    <VideoOff className="h-10 w-10" />
                                </div>
                             )}
                        </div>
                        
                        {user?.uid && (
                            <div className="space-y-2 pt-4">
                                <Label>Your Unique Live Stream ID</Label>
                                <div className="flex items-center gap-2">
                                    <Input value={user.uid} readOnly className="font-mono" />
                                    <Button size="icon" onClick={copyToClipboard} disabled={!isLive}>
                                        {isCopied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">Share this ID with your buyers to let them join your stream.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </SellerLayout>
    );
};

export default SellerLivePage;
