
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, RadioTower, Loader2, WifiOff, AlertTriangle, FlipHorizontal } from 'lucide-react';
import { useUser } from '@/firebase';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Peer } from 'peerjs';

const SellerLivePage = () => {
    const { user } = useUser();
    const { toast } = useToast();
    const [liveStatus, setLiveStatus] = useState<'CONNECTING' | 'LIVE' | 'ERROR' | 'ID_TAKEN'>('CONNECTING');
    const [peerId, setPeerId] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState('environment');

    const videoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const initializePeer = (id: string) => {
        if (typeof window === 'undefined') return;

        import('peerjs').then(({ default: Peer }) => {
            if (peerRef.current) {
                peerRef.current.destroy();
            }

            const newPeer = new Peer(id);

            newPeer.on('open', (openedId) => {
                console.log('PeerJS connection opened with ID:', openedId);
                setPeerId(openedId);
                setLiveStatus('LIVE');
                toast({ title: 'You are live!', description: `Broadcasting with ID: ${openedId}` });
            });

            newPeer.on('connection', (conn) => {
                conn.on('data', (data) => {
                    console.log('Received data:', data);
                });
            });

            newPeer.on('call', (call) => {
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
    
    const getCameraStream = async (mode: 'user' | 'environment') => {
         try {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }

            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: mode,
                },
                audio: true,
            });
            
            localStreamRef.current = mediaStream;
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            return mediaStream;
        } catch (err) {
            console.error("Failed to get local stream", err);
            setLiveStatus('ERROR');
            toast({ variant: 'destructive', title: 'Camera Error', description: 'Could not access your camera or microphone.' });
            return null;
        }
    }

    useEffect(() => {
        const startCameraAndPeer = async () => {
            if (!user) return;
            setLiveStatus('CONNECTING');
            const stream = await getCameraStream(facingMode as 'user' | 'environment');
            if (stream) {
                initializePeer(user.uid);
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
    }, [user, facingMode]);

    const copyToClipboard = (text: string, fieldName: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: `${fieldName} Copied!` });
        });
    };

    const toggleFacingMode = () => {
      setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };
    
    const StatusCard = () => {
        let title, description, icon;
        switch (liveStatus) {
            case 'LIVE':
                title = "You are Live!";
                description = "Your stream is broadcasting. Share your Live ID with buyers.";
                icon = <RadioTower className="h-6 w-6 text-green-500 animate-pulse" />;
                break;
            case 'CONNECTING':
                title = "Connecting...";
                description = "Attempting to connect to the live streaming network. This may take a moment.";
                icon = <Loader2 className="h-6 w-6 text-yellow-500 animate-spin" />;
                break;
             case 'ID_TAKEN':
                title = "Reconnecting...";
                description = "Your primary ID was taken. Assigning a new one.";
                icon = <Loader2 className="h-6 w-6 text-yellow-500 animate-spin" />;
                break;
            case 'ERROR':
            default:
                title = "Connection Failed";
                description = "Could not connect to the live server. Please check your network connection and refresh the page.";
                icon = <WifiOff className="h-6 w-6 text-red-500" />;
                break;
        }

        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        {icon}
                        {title}
                    </CardTitle>
                    <CardDescription>
                        {description}
                    </CardDescription>
                </CardHeader>
                {liveStatus === 'LIVE' && peerId && (
                     <CardContent className="space-y-2">
                        <Label>Your Live ID</Label>
                        <div className="flex items-center gap-2">
                            <Input value={peerId} readOnly className="font-mono bg-muted" />
                            <Button size="icon" variant="secondary" onClick={() => copyToClipboard(peerId, 'Live ID')}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                )}
            </Card>
        )
    }

    return (
        <SellerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Live Stream Studio</h1>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card className="overflow-hidden">
                           <div className="aspect-video w-full bg-black relative">
                             <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                             <div className="absolute top-4 right-4">
                                <Button onClick={toggleFacingMode} size="icon" variant="secondary" className="rounded-full bg-black/50 hover:bg-black/70">
                                    <FlipHorizontal size={20} />
                                </Button>
                             </div>
                           </div>
                        </Card>
                    </div>
                    <div className="space-y-4">
                        <StatusCard />
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
