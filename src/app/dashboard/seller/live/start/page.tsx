
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, RadioTower, VideoOff } from 'lucide-react';
import { useUser } from '@/firebase';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const SellerLivePage = () => {
    const { user } = useUser();
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Initializing...');
    const [isLive, setIsLive] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (!user) return;

        // Initialize PeerJS with the user's UID
        const peerInstance = new Peer(user.uid, {
            host: '0.peerjs.com',
            port: 443,
            path: '/',
            secure: true,
        });

        peerInstance.on('open', (id) => {
            console.log('My peer ID is: ' + id);
            setStatus('Ready. Start your camera to go live.');
        });

        peerInstance.on('call', (call) => {
            const stream = localVideoRef.current?.srcObject as MediaStream;
            if (stream) {
                call.answer(stream);
                setStatus('Connected to a buyer!');
                call.on('close', () => {
                    setStatus('Buyer disconnected. Waiting for new viewers.');
                });
            } else {
                console.error("No local stream to answer call with.");
            }
        });

        peerInstance.on('error', (err) => {
            console.error('PeerJS error:', err);
            setStatus(`Error: ${err.message}. Please refresh.`);
        });

        return () => {
            peerInstance.destroy();
        };
    }, [user]);

    const goLive = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            setIsLive(true);
            setStatus('Live! Waiting for viewers to connect.');
        } catch (err) {
            console.error('Failed to get local stream', err);
            setStatus('Error: Failed to access camera. Please check permissions.');
            toast({
                variant: 'destructive',
                title: 'Camera Access Denied',
                description: 'Please enable camera permissions in your browser settings to go live.',
            });
        }
    };
    
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
                        <CardDescription>{status}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="aspect-video w-full bg-black rounded-lg overflow-hidden flex items-center justify-center relative">
                             <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                             {!isLive && (
                                 <div className="absolute flex flex-col items-center gap-2 text-muted-foreground">
                                    <VideoOff className="h-10 w-10" />
                                    <p>Your camera is off</p>
                                </div>
                             )}
                        </div>
                        
                        {!isLive && (
                             <Button onClick={goLive} className="w-full" size="lg">
                                Start Camera & Go Live
                            </Button>
                        )}
                        
                        {user?.uid && (
                            <div className="space-y-2 pt-4">
                                <Label>Your Unique Live Stream ID</Label>
                                <div className="flex items-center gap-2">
                                    <Input value={user.uid} readOnly className="font-mono" />
                                    <Button size="icon" onClick={copyToClipboard}>
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
