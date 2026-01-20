'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';

const socket = io('https://5000-firebase-studio-1763190344911.cluster-lu4mup47g5gm4rtyvhzpwbfadi.cloudworkstations.dev');

export default function BuyerWatchPage() {
    const params = useParams();
    const router = useRouter();
    const streamId = params.streamId as string;
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const sellerSocketId = useRef<string | null>(null); // Use ref to avoid re-renders
    const [isLoading, setIsLoading] = useState(true);

    const stopWatching = useCallback(() => {
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        socket.emit('buyer-leave-stream', { streamId });
        router.push('/buyer/live-stream');
    }, [streamId, router]);


    useEffect(() => {
        if (!streamId) return;

        // 1. Create a peer connection to receive the stream
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        peerConnection.current = pc;
        
        // This is where the stream is actually displayed
        pc.ontrack = (event) => {
            console.log("Stream track received");
            if (videoRef.current && event.streams[0]) {
                videoRef.current.srcObject = event.streams[0];
                setIsLoading(false);
            }
        };
        
        // This sends the buyer's ICE candidates to the seller
        pc.onicecandidate = (event) => {
            if (event.candidate && sellerSocketId.current) {
                socket.emit('ice-candidate', { to: sellerSocketId.current, candidate: event.candidate });
            }
        };

        // This handles the initial offer from the seller
        const handleOffer = async (data: { from: string, offer: RTCSessionDescriptionInit }) => {
            sellerSocketId.current = data.from; // Store the seller's socket ID
            if (peerConnection.current) {
                console.log("Offer received from seller");
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await peerConnection.current.createAnswer();
                await peerConnection.current.setLocalDescription(answer);
                socket.emit('answer', { to: data.from, answer });
            }
        };
        
        // This handles any new ICE candidates from the seller
        const handleIceCandidate = (data: { from: string, candidate: RTCIceCandidateInit }) => {
            const pc = peerConnection.current;
            if (pc && data.candidate) {
                pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        };

        const handleStreamEnded = () => {
             toast({ title: 'Stream Ended', description: 'The live stream has been ended by the seller.' });
             stopWatching();
        }
        
        // Set up all listeners
        socket.on('offer', handleOffer);
        socket.on('ice-candidate', handleIceCandidate); // Listener for seller's candidates
        socket.on('seller-offline', handleStreamEnded);

        // Announce that this buyer wants to join
        socket.emit('buyer-join-stream', { streamId });

        // Cleanup function
        return () => {
            socket.off('offer', handleOffer);
            socket.off('ice-candidate', handleIceCandidate);
            socket.off('seller-offline', handleStreamEnded);
            if (peerConnection.current) {
                peerConnection.current.close();
            }
            socket.emit('buyer-leave-stream', { streamId });
        };
    }, [streamId, stopWatching]);
    

    return (
        <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-4 relative">
             <Button className="absolute top-4 left-4 z-10" variant="secondary" onClick={stopWatching}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Streams
            </Button>
            <div className="w-full max-w-5xl aspect-video bg-black rounded-lg overflow-hidden relative">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain"></video>
                {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
                        <Loader2 className="h-8 w-8 animate-spin mb-4" />
                        <p className="font-semibold">Connecting to live stream...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
