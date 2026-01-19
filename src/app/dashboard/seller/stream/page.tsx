'use client';

import React, { useRef, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useUser, useUserProfile } from '@/firebase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

const socket = io('http://localhost:5000');

export default function SellerStreamPage() {
    const { user } = useUser();
    const { userProfile } = useUserProfile(user?.uid);
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
    const localStream = useRef<MediaStream | null>(null);
    const [streamId, setStreamId] = useState<string | null>(null);
    const [viewerCount, setViewerCount] = useState(0);
    const [isStarting, setIsStarting] = useState(false);
    
    const isLive = !!streamId;
    const sellerName = userProfile?.shopName || userProfile?.fullName || 'Seller';

    // Socket event listeners
    useEffect(() => {
        socket.on('buyer-joined', async (data: { buyerSocketId: string, viewerCount: number }) => {
            console.log('Buyer joined:', data.buyerSocketId);
            setViewerCount(data.viewerCount);
            if (localStream.current) {
                await createPeerConnection(data.buyerSocketId);
            }
        });

        socket.on('answer', async (data: { from: string, answer: RTCSessionDescriptionInit }) => {
            const pc = peerConnections.current[data.from];
            if (pc && pc.signalingState !== 'stable') {
                 try {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                } catch(e) {
                    console.error("Error setting remote description:", e);
                }
            }
        });

        socket.on('ice-candidate', (data: { from: string, candidate: RTCIceCandidateInit }) => {
            const pc = peerConnections.current[data.from];
            if (pc && data.candidate) {
                pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        });
        
        socket.on('buyer-left', (data: { viewerCount: number }) => {
            setViewerCount(data.viewerCount);
        });

        return () => {
            socket.off('buyer-joined');
            socket.off('answer');
            socket.off('ice-candidate');
            socket.off('buyer-left');
        };
    }, [localStream.current]);


    const startStream = async () => {
        setIsStarting(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: { echoCancellation: true, noiseSuppression: true }
            });
            if(videoRef.current) videoRef.current.srcObject = stream;
            localStream.current = stream;

            const newStreamId = `stream_${user?.uid}_${Date.now()}`;
            setStreamId(newStreamId);

            socket.emit('seller-go-live', { streamId: newStreamId, sellerName });
            
            toast({ title: "You are now live!", description: "Buyers can now join your stream." });
        } catch (error) {
            toast({ variant: 'destructive', title: "Error", description: "Camera/Microphone access was denied. Please check browser permissions." });
        } finally {
            setIsStarting(false);
        }
    };

    const createPeerConnection = async (buyerSocketId: string) => {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peerConnections.current[buyerSocketId] = pc;

        localStream.current?.getTracks().forEach(track => {
            pc.addTrack(track, localStream.current!);
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { to: buyerSocketId, candidate: event.candidate });
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { to: buyerSocketId, offer });
    };

    const stopStream = () => {
        localStream.current?.getTracks().forEach(track => track.stop());
        localStream.current = null;
        Object.values(peerConnections.current).forEach(pc => pc.close());
        peerConnections.current = {};
        
        socket.emit('seller-stop-live');
        setStreamId(null);
        setViewerCount(0);
        toast({ title: "Stream Ended", description: "You are no longer live." });
    };
    
    return (
        <SellerLayout>
            <div className="container mx-auto p-4">
                <h2 className="text-2xl font-bold mb-4">🎬 Go Live</h2>
                
                <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden mb-4">
                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover"></video>
                    {isLive && (
                      <>
                        <Badge className="absolute top-2 left-2 bg-red-600 animate-pulse">🔴 LIVE</Badge>
                        <Badge variant="secondary" className="absolute top-2 right-2 flex items-center gap-2"><Users className="h-4 w-4" /> {viewerCount}</Badge>
                      </>
                    )}
                </div>

                <div className="flex gap-2">
                    {!isLive ? (
                        <Button className="flex-1" onClick={startStream} disabled={isStarting}>
                          {isStarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '🔴'} Start Live
                        </Button>
                    ) : (
                        <Button className="flex-1" variant="destructive" onClick={stopStream}>⏹️ Stop Live</Button>
                    )}
                </div>
            </div>
        </SellerLayout>
    );
}