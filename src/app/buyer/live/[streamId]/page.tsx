'use client';

import React, { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import { useParams } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, VideoOff, WifiOff } from 'lucide-react';

const BuyerLiveStreamPage = () => {
    const params = useParams();
    const sellerId = params.streamId as string;
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Initializing...');
    
    useEffect(() => {
        if (!sellerId) {
            setStatus('No Seller ID provided in URL.');
            return;
        }

        const peer = new Peer({
            host: '0.peerjs.com',
            port: 443,
            path: '/',
            secure: true,
        });

        peer.on('open', (id) => {
            setStatus(`Calling seller...`);
            
            const call = peer.call(sellerId, undefined);

            if (!call) {
                setStatus('Could not initiate call. Please check the Seller ID.');
                return;
            }

            call.on('stream', (remoteStream) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
                setStatus('Watching Live Now');
            });

            call.on('error', (err) => {
                console.error(err);
                setStatus('Error connecting. Check the Seller ID and if they are live.');
            });

            call.on('close', () => {
                setStatus('The stream has ended.');
            });
        });

        peer.on('error', (err) => {
            console.error('PeerJS error:', err);
            setStatus(`Connection error: ${err.message}. Please try again.`);
        });

        return () => {
            peer.destroy();
        };
    }, [sellerId]);

    return (
        <BuyerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                 <h1 className="font-headline text-3xl font-bold tracking-tight">Live Stream</h1>
                <Card>
                    <CardHeader>
                        <CardTitle>Watching Seller: {sellerId}</CardTitle>
                        <CardDescription>{status}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="aspect-video w-full bg-black rounded-lg overflow-hidden flex items-center justify-center relative">
                            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
                            {status !== 'Watching Live Now' && (
                                <div className="absolute flex flex-col items-center gap-2 text-muted-foreground">
                                    {status.startsWith('Calling') || status.startsWith('Initializing') ? 
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
