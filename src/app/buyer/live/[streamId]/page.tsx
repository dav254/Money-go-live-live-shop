
'use client';

import React, { useRef, useState, useEffect } from 'react';
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
    const [isLoading, setIsLoading] = useState(true);

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

    useEffect(() => {
        if (!streamId) return;

        // 1. Buyer joins the stream room
        socket.emit('buyer-join-stream', { streamId });

        // 2. Create a peer connection to receive the stream
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        peerConnection.current = pc;

        pc.ontrack = (event) => {
            console.log("Stream track received");
            if (videoRef.current) {
                videoRef.current.srcObject = event.streams[0];
                setIsLoading(false);
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                // Send candidate to the seller via the server
                socket.emit('ice-candidate', { to: null, candidate: event.candidate });
            }
        };
        
        const handleOffer = async (data: { from: string, offer: RTCSessionDescriptionInit }) => {
            if (peerConnection.current) {
                console.log("Offer received from seller");
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await peerConnection.current.createAnswer();
                await peerConnection.current.setLocalDescription(answer);
                socket.emit('answer', { to: data.from, answer });
            }
        };
        
        const handleStreamEnded = (data: {streamId: string}) => {
             if (data.streamId === streamId) {
                toast({ title: 'Stream Ended', description: 'The live stream has been ended by the seller.' });
                stopWatching();
            }
        }
        
        // 3. Set up listeners
        socket.on('offer', handleOffer);
        socket.on('seller-offline', () => {
             toast({ title: 'Stream Ended', description: 'The live stream has been ended by the seller.' });
             stopWatching();
        });


        // Cleanup function
        return () => {
            socket.off('offer', handleOffer);
            socket.off('seller-offline');
            if (peerConnection.current) {
                peerConnection.current.close();
            }
            socket.emit('buyer-leave-stream', { streamId });
        };
    }, [streamId, router]);
    

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
