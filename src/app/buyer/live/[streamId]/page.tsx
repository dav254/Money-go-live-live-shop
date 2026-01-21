
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';

const socket = io('https://5000-firebase-studio-1763190344911.cluster-lu4mup47g5gm4rtyvhzpwbfadi.cloudworkstations.dev', {
  transports: ['websocket', 'polling']
});

export default function BuyerWatchPage() {
    const params = useParams();
    const router = useRouter();
    const streamId = params.streamId as string;
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const sellerSocketId = useRef<string | null>(null);
    const candidateQueue = useRef<RTCIceCandidateInit[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [connectionState, setConnectionState] = useState<string>('disconnected');
    const [error, setError] = useState<string | null>(null);

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

    const debugConnection = () => {
        console.log('=== BUYER DEBUG INFO ===');
        console.log('Stream ID:', streamId);
        console.log('Seller Socket ID:', sellerSocketId.current);
        console.log('Peer Connection State:', peerConnection.current?.connectionState);
        console.log('ICE Gathering State:', peerConnection.current?.iceGatheringState);
        console.log('Signaling State:', peerConnection.current?.signalingState);
        
        socket.emit('debug-info');
    };

    useEffect(() => {
        if (!streamId) {
            setError('No stream ID provided');
            return;
        }

        console.log('🎯 Initializing buyer for stream:', streamId);
        
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        });

        // Add transceivers
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        peerConnection.current = pc;
        
        pc.ontrack = (event) => {
            console.log('🎬 Stream track received!', event.track.kind);
            if (videoRef.current && event.streams[0]) {
                videoRef.current.srcObject = event.streams[0];
                setIsLoading(false);
                setConnectionState('connected');
                toast({
                    title: 'Connected!',
                    description: 'You are now watching the live stream.'
                });
            }
        };
        
        pc.onicecandidate = (event) => {
            if (event.candidate && sellerSocketId.current) {
                console.log('🧊 Sending ICE candidate to seller:', sellerSocketId.current);
                socket.emit('ice-candidate', { 
                    to: sellerSocketId.current, 
                    candidate: event.candidate 
                });
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log('ICE Connection State:', pc.iceConnectionState);
            setConnectionState(pc.iceConnectionState);
        };

        pc.onsignalingstatechange = () => {
            console.log('Signaling State:', pc.signalingState);
        };

        pc.onconnectionstatechange = () => {
            console.log('Connection State:', pc.connectionState);
            if (pc.connectionState === 'failed') {
                setError('Connection failed. Please try again.');
            }
        };

        const handleOffer = async (data: { from: string, offer: RTCSessionDescriptionInit }) => {
            console.log('📩 Received offer from seller:', data.from);
            sellerSocketId.current = data.from;
            const currentPC = peerConnection.current;
            
            if (currentPC) {
                try {
                    console.log('Setting remote description...');
                    await currentPC.setRemoteDescription(new RTCSessionDescription(data.offer));
                    
                    // Process queued ICE candidates
                    while(candidateQueue.current.length > 0) {
                        const candidate = candidateQueue.current.shift();
                        if (candidate) {
                            await currentPC.addIceCandidate(new RTCIceCandidate(candidate));
                        }
                    }

                    console.log('Creating answer...');
                    const answer = await currentPC.createAnswer();
                    await currentPC.setLocalDescription(answer);
                    
                    console.log('Sending answer to seller:', data.from);
                    socket.emit('answer', { 
                        to: data.from, 
                        answer: currentPC.localDescription 
                    });
                    
                } catch (e) {
                    console.error("Error handling offer:", e);
                    setError('Failed to connect to stream');
                }
            }
        };
        
        const handleIceCandidate = (data: { from: string, candidate: RTCIceCandidateInit }) => {
            console.log('🧊 Received ICE candidate from:', data.from);
            const currentPC = peerConnection.current;
            if (currentPC && data.candidate) {
                if (!currentPC.remoteDescription) {
                    // Buffer candidates
                    console.log('Buffering ICE candidate...');
                    candidateQueue.current.push(data.candidate);
                } else {
                    currentPC.addIceCandidate(new RTCIceCandidate(data.candidate))
                        .catch(e => console.error("Error adding ICE candidate:", e));
                }
            }
        };

        const handleStreamEnded = () => {
            toast({ 
                title: 'Stream Ended', 
                description: 'The live stream has been ended by the seller.' 
            });
            stopWatching();
        };

        const handleStreamNotFound = () => {
            setError('Stream not found or seller is offline');
            setIsLoading(false);
        };
        
        // Socket event listeners
        socket.on('offer', handleOffer);
        socket.on('ice-candidate', handleIceCandidate);
        socket.on('seller-offline', handleStreamEnded);
        socket.on('stream-not-found', handleStreamNotFound);

        // Join stream
        console.log('Joining stream:', streamId);
        socket.emit('buyer-join-stream', { streamId });

        // Set timeout for connection
        const timeout = setTimeout(() => {
            if (connectionState !== 'connected' && isLoading) {
                setError('Connection timeout. The seller might be offline.');
                setIsLoading(false);
            }
        }, 15000);

        return () => {
            clearTimeout(timeout);
            socket.off('offer', handleOffer);
            socket.off('ice-candidate', handleIceCandidate);
            socket.off('seller-offline', handleStreamEnded);
            socket.off('stream-not-found', handleStreamNotFound);
            
            if (peerConnection.current) {
                peerConnection.current.close();
            }
            socket.emit('buyer-leave-stream', { streamId });
        };
    }, [streamId, stopWatching]);

    return (
        <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-4 relative">
            <Button 
                className="absolute top-4 left-4 z-10" 
                variant="secondary" 
                onClick={stopWatching}
            >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Streams
            </Button>
            
            <Button
                className="absolute top-4 right-4 z-10"
                variant="outline"
                size="sm"
                onClick={debugConnection}
            >
                Debug
            </Button>

            <div className="w-full max-w-5xl aspect-video bg-black rounded-lg overflow-hidden relative">
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-contain"
                ></video>
                
                {isLoading && !error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
                        <Loader2 className="h-8 w-8 animate-spin mb-4" />
                        <p className="font-semibold">Connecting to live stream...</p>
                        <p className="text-sm text-gray-300 mt-2">Status: {connectionState}</p>
                    </div>
                )}
                
                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
                        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                        <p className="font-semibold text-lg mb-2">Connection Error</p>
                        <p className="text-gray-300 mb-4">{error}</p>
                        <div className="flex gap-4">
                            <Button variant="secondary" onClick={stopWatching}>
                                Go Back
                            </Button>
                            <Button variant="default" onClick={() => window.location.reload()}>
                                Retry
                            </Button>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Connection status bar */}
            <div className="mt-4 p-3 bg-gray-900 text-white rounded-lg text-sm">
                <div className="flex items-center justify-between">
                    <span>Stream ID: <code className="bg-gray-800 px-2 py-1 rounded">{streamId}</code></span>
                    <span className={`px-3 py-1 rounded ${
                        connectionState === 'connected' ? 'bg-green-600' :
                        connectionState === 'connecting' ? 'bg-yellow-600' :
                        'bg-red-600'
                    }`}>
                        {connectionState.toUpperCase()}
                    </span>
                </div>
            </div>
        </div>
    );
}
