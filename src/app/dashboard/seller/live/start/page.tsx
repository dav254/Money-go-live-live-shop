
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, RadioTower, Loader2, WifiOff, AlertTriangle } from 'lucide-react';
import { useUser } from '@/firebase';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import type { Peer, DataConnection, MediaConnection } from 'peerjs';

const SellerLivePage = () => {
    const { user } = useUser();
    const { toast } = useToast();
    const [liveStatus, setLiveStatus] = useState<'CONNECTING' | 'LIVE' | 'ERROR' | 'ID_TAKEN'>('CONNECTING');
    const [peerId, setPeerId] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const initializePeer = (id: string) => {
        if (typeof window === 'undefined') return;

        import('peerjs').then(({ default: Peer }) => {
            if (peerRef.current) {
                peerRef.current.destroy();
            }

            // Use the public PeerJS server by not specifying host/port
            const newPeer = new Peer(id);

            newPeer.on('open', (openedId) => {
                console.log('PeerJS connection opened with ID:', openedId);
                setPeerId(openedId);
                setLiveStatus('LIVE');
                toast({ title: 'You are live!', description: `Broadcasting with ID: ${openedId}` });
            });

            newPeer.on('connection', (conn: DataConnection) => {
                conn.on('data', (data) => {
                    console.log('Received data:', data);
                });
            });

            newPeer.on('call', (call: MediaConnection) => {
                if (localStreamRef.current) {
                    call.answer(localStreamRef.current);
                }
            });

            newPeer.on('error', (err) => {
                console.error('PeerJS Error:', err);
                if (err.type === 'unavailable-id') {
                    setLiveStatus('ID_TAKEN');
                    toast({
                        variant: 'destructive',
                        title: 'Live ID Taken',
                        description: `Your ID "${id}" is in use. Trying a different one...`,
                    });
                    const uniqueId = `${id}-${Math.random().toString(36).substring(2, 7)}`;
                    initializePeer(uniqueId);
                } else {
                    setLiveStatus('ERROR');
                }
            });
            
            newPeer.on('disconnected', () => {
                toast({ title: 'Disconnected', description: 'Attempting to reconnect...' });
                newPeer.reconnect();
            });

            peerRef.current = newPeer;
        });
    };

    useEffect(() => {
        const startCameraAndPeer = async () => {
            if (!user) return;
            setLiveStatus('CONNECTING');
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localStreamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                initializePeer(user.uid);

            } catch (err) {
                console.error("Failed to get local stream", err);
                setLiveStatus('ERROR');
                toast({ variant: 'destructive', title: 'Camera Error', description: 'Could not access your camera or microphone.' });
            }
        };

        if(user) {
            startCameraAndPeer();
        }

        return () => {
            if (peerRef.current) {
                peerRef.current.destroy();
            }
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [user]);

    const copyToClipboard = (text: string, fieldName: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: `${fieldName} Copied!` });
        });
    };
    
    const getStatusIndicator = () => {
        switch (liveStatus) {
            case 'LIVE':
                return (
                    <div className="flex items-center gap-2 text-green-400">
                        <RadioTower className="h-4 w-4 animate-pulse" />
                        <span>Live & Broadcasting</span>
                    </div>
                );
            case 'CONNECTING':
                return (
                    <div className="flex items-center gap-2 text-yellow-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Connecting to Live Server...</span>
                    </div>
                );
             case 'ID_TAKEN':
                return (
                    <div className="flex items-center gap-2 text-yellow-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>ID taken, creating a new one...</span>
                    </div>
                );
            case 'ERROR':
                return (
                    <div className="flex items-center gap-2 text-red-400">
                        <WifiOff className="h-4 w-4" />
                        <span>Connection Failed</span>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <SellerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Live Stream Studio</h1>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card className="overflow-hidden">
                           <div className="aspect-video w-full bg-black relative">
                             <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                             <div className="absolute top-4 left-4">
                                {getStatusIndicator()}
                             </div>
                           </div>
                        </Card>
                    </div>
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                <RadioTower className="text-primary" />
                                Your Live Credentials
                                </CardTitle>
                                <CardDescription>
                                    Share your Live ID with your buyers so they can join your stream.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {liveStatus === 'LIVE' && peerId ? (
                                    <div className="space-y-2">
                                        <Label>Your Live ID</Label>
                                        <div className="flex items-center gap-2">
                                            <Input value={peerId} readOnly className="font-mono bg-muted" />
                                            <Button size="icon" variant="secondary" onClick={() => copyToClipboard(peerId, 'Live ID')}>
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                     <div className="space-y-2">
                                        <Label>Your Live ID</Label>
                                         <Skeleton className="h-10 w-full" />
                                     </div>
                                )}
                            </CardContent>
                        </Card>
                         <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Important</AlertTitle>
                            <AlertDescription>
                                Your stream is public. Anyone with your Live ID can watch. Do not share private information.
                            </AlertDescription>
                        </Alert>
                    </div>
                </div>

            </div>
        </SellerLayout>
    );
};

export default SellerLivePage;
