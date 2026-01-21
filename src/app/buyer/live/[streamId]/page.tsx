
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Users, Volume2, VolumeX, Maximize2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const socket = io('http://localhost:5000', {
  transports: ['websocket', 'polling'],
  reconnection: true
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
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

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
             if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed') {
                setError('Connection to the stream has been lost.');
                setIsLoading(false);
            }
        };

        pc.onsignalingstatechange = () => {
            console.log('Signaling State:', pc.signalingState);
        };

        const handleOffer = async (data: { from: string, offer: RTCSessionDescriptionInit }) => {
            console.log('📩 Received offer from seller:', data.from);
            sellerSocketId.current = data.from;
            const currentPC = peerConnection.current;
            
            if (currentPC) {
                try {
                    await currentPC.setRemoteDescription(new RTCSessionDescription(data.offer));
                    
                    while(candidateQueue.current.length > 0) {
                        const candidate = candidateQueue.current.shift();
                        if (candidate) {
                            await currentPC.addIceCandidate(new RTCIceCandidate(candidate));
                        }
                    }

                    const answer = await currentPC.createAnswer();
                    await currentPC.setLocalDescription(answer);
                    
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
            const currentPC = peerConnection.current;
            if (currentPC && data.candidate) {
                if (!currentPC.remoteDescription) {
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
        
        socket.on('offer', handleOffer);
        socket.on('ice-candidate', handleIceCandidate);
        socket.on('seller-offline', handleStreamEnded);
        socket.on('stream-not-found', handleStreamNotFound);
        socket.on('connect_error', () => setError('Failed to connect to signaling server.'));

        socket.emit('buyer-join-stream', { streamId });

        const timeout = setTimeout(() => {
            if (connectionState !== 'connected' && isLoading) {
                setError('Connection timeout. The seller might be offline or a network issue occurred.');
                setIsLoading(false);
            }
        }, 15000);

        return () => {
            clearTimeout(timeout);
            socket.off('offer', handleOffer);
            socket.off('ice-candidate', handleIceCandidate);
            socket.off('seller-offline', handleStreamEnded);
            socket.off('stream-not-found', handleStreamNotFound);
            socket.off('connect_error');
            
            if (peerConnection.current) {
                peerConnection.current.close();
            }
            socket.emit('buyer-leave-stream', { streamId });
        };
    }, [streamId, stopWatching, initializePeerConnection, isLoading, connectionState]);

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(!isMuted);
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            videoRef.current?.parentElement?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const retryConnection = () => {
        window.location.reload();
    };

    return (
        <div className="h-screen w-screen bg-black flex flex-col">
            <div className="flex items-center justify-between p-4 bg-black/80 text-white z-10">
                <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={stopWatching}
                    className="flex items-center gap-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Streams
                </Button>
                
                <div className="flex items-center gap-4">
                    <Badge variant={connectionState === 'connected' ? 'default' : 'secondary'} className={connectionState === 'connected' ? 'bg-green-600' : 'bg-yellow-500'}>
                        {connectionState === 'connected' ? '🟢 LIVE' : `🟡 ${connectionState.toUpperCase()}`}
                    </Badge>
                </div>
            </div>

            <div className="flex-1 relative">
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    controls={false}
                    className="w-full h-full object-contain bg-black"
                />
                
                {isLoading && !error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90">
                        <Loader2 className="h-12 w-12 animate-spin text-white mb-4" />
                        <p className="text-xl font-semibold text-white mb-2">Connecting to live stream...</p>
                        <p className="text-sm text-gray-300">Status: {connectionState}</p>
                    </div>
                )}
                
                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90">
                        <div className="text-center max-w-md">
                            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-white mb-3">Connection Error</h2>
                            <p className="text-gray-300 mb-6">{error}</p>
                            <div className="flex gap-4 justify-center">
                                <Button variant="secondary" onClick={stopWatching}>
                                    Go Back
                                </Button>
                                <Button variant="default" onClick={retryConnection}>
                                    Retry Connection
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {!isLoading && !error && (
                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-sm rounded-full px-6 py-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-full text-white hover:bg-white/20"
                            onClick={toggleMute}
                        >
                            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                        </Button>
                        
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-full text-white hover:bg-white/20"
                            onClick={toggleFullscreen}
                        >
                            <Maximize2 className="h-5 w-5" />
                        </Button>
                        
                        <Button
                            variant="destructive"
                            className="rounded-full px-6"
                            onClick={stopWatching}
                        >
                            Leave Stream
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
