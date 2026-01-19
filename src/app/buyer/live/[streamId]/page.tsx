
'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';

const socket = io('http://localhost:5000');

export default function BuyerWatchPage() {
    const params = useParams();
    const router = useRouter();
    const streamId = params.streamId as string;
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);

    useEffect(() => {
        if (!streamId) return;

        socket.emit('buyer-join-stream', { streamId });

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        peerConnection.current = pc;

        pc.ontrack = (event) => {
            if (videoRef.current) {
                videoRef.current.srcObject = event.streams[0];
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { candidate: event.candidate });
            }
        };

        const handleOffer = async (data: { from: string, offer: RTCSessionDescriptionInit }) => {
            if (peerConnection.current) {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await peerConnection.current.createAnswer();
                await peerConnection.current.setLocalDescription(answer);
                socket.emit('answer', { to: data.from, answer });
            }
        };
        
        socket.on('offer', handleOffer);
        socket.on('seller-offline', (data) => {
            if (data.streamId === streamId) {
                stopWatching();
                alert('The live stream has ended.');
                router.push('/buyer/live-stream');
            }
        });


        return () => {
            socket.off('offer', handleOffer);
            socket.off('seller-offline');
            stopWatching();
        };
    }, [streamId, router]);
    
    const stopWatching = () => {
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        socket.emit('buyer-leave-stream', { streamId });
        router.push('/buyer/live-stream');
    };

    return (
        <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-4xl aspect-video bg-black rounded-lg overflow-hidden">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain"></video>
            </div>
            <Button className="mt-4" variant="destructive" onClick={stopWatching}>
                ⏹️ STOP WATCHING
            </Button>
        </div>
    );
}
