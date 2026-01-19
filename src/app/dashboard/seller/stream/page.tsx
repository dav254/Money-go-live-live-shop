
'use client';

import React, { useRef, useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUser } from '@/firebase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { SellerLayout } from '@/components/layout/seller-layout';

const socket = io('http://localhost:5000');

export default function SellerStreamPage() {
    const { user } = useUser();
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
    const localStream = useRef<MediaStream | null>(null);
    const [streamId, setStreamId] = useState<string | null>(null);
    const [viewerCount, setViewerCount] = useState(0);
    const [sellerName, setSellerName] = useState('Seller');
    
    const isLive = !!streamId;

    useEffect(() => {
        socket.on('buyer-joined', async (data: { buyerSocketId: string, viewerCount: number }) => {
            console.log('Buyer joined:', data.buyerSocketId);
            setViewerCount(data.viewerCount);
            await createPeerConnection(data.buyerSocketId);
        });

        socket.on('answer', (data: { from: string, answer: RTCSessionDescriptionInit }) => {
            const pc = peerConnections.current[data.from];
            if (pc) {
                pc.setRemoteDescription(new RTCSessionDescription(data.answer));
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
    }, [streamId]);

    const startStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: true,
            });
            if(videoRef.current) videoRef.current.srcObject = stream;
            localStream.current = stream;

            const newStreamId = `stream_${Date.now()}`;
            setStreamId(newStreamId);

            socket.emit('seller-go-live', { streamId: newStreamId, sellerName });
            
            toast({ title: "You are now live!", description: "Share your link with buyers to start selling." });

        } catch (error) {
            toast({ variant: 'destructive', title: "Error", description: "Camera/Microphone access was denied." });
        }
    };

    const createPeerConnection = async (buyerSocketId: string) => {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peerConnections.current[buyerSocketId] = pc;

        if (localStream.current) {
            localStream.current.getTracks().forEach(track => {
                pc.addTrack(track, localStream.current!);
            });
        }

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
        if (localStream.current) {
            localStream.current.getTracks().forEach(track => track.stop());
        }
        Object.values(peerConnections.current).forEach(pc => pc.close());
        peerConnections.current = {};
        
        socket.emit('seller-stop-live', { streamId });
        setStreamId(null);
        setViewerCount(0);
    };
    
    const copyLink = () => {
        const link = `${window.location.origin}/buyer/live/${streamId}`;
        navigator.clipboard.writeText(link);
        toast({ title: 'Link Copied!', description: "Your live stream link is copied to the clipboard." });
    };


    return (
        <SellerLayout>
            <div className="container mx-auto p-4">
                <h2 className="text-2xl font-bold mb-4">🎬 Seller - Go Live</h2>
                
                <Input
                    id="sellerName"
                    className="mb-4"
                    placeholder="Enter your name"
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    disabled={isLive}
                />

                <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden mb-4">
                    <video id="sellerVideo" ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover"></video>
                    {isLive && <div className="absolute top-2 left-2 bg-red-600 text-white px-3 py-1 rounded font-bold animate-pulse">🔴 LIVE</div>}
                </div>

                {isLive && <div className="bg-gray-800 text-white p-2 rounded mb-4">👁️ {viewerCount} watching</div>}

                <div className="flex gap-2">
                    {!isLive ? (
                        <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={startStream}>🔴 GO LIVE</Button>
                    ) : (
                        <Button className="flex-1" variant="destructive" onClick={stopStream}>⏹️ STOP LIVE</Button>
                    )}
                </div>

                {isLive && (
                    <div className="mt-4 bg-primary/10 p-4 rounded-lg text-center">
                        <p className="mb-2 font-bold">📱 Share this link with buyers:</p>
                        <div className="bg-black/20 p-3 rounded mb-3 break-all font-mono text-sm">{`${window.location.origin}/buyer/live/${streamId}`}</div>
                        <Button className="w-full" onClick={copyLink}>📋 COPY LINK</Button>
                    </div>
                )}
            </div>
        </SellerLayout>
    );
}
