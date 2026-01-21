'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Users, Volume2, VolumeX, Maximize2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const SOCKET_URL = 'https://5000-firebase-studio-1763190344911.cluster-lu4mup47g5gm4rtyvhzpwbfadi.cloudworkstations.dev';

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 20000
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
    const [connectionState, setConnectionState] = useState<string>('connecting');
    const [error, setError] = useState<string | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [socketConnected, setSocketConnected] = useState(false);

    const stopWatching = useCallback(() => {
        console.log('🛑 Stopping watching...');
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

    // Initialize WebRTC connection
    const initWebRTC = useCallback(() => {
        console.log('🎯 Initializing WebRTC for stream:', streamId);
        
        if (peerConnection.current) {
            peerConnection.current.close();
        }

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10,
            iceTransportPolicy: 'all'
        });

        peerConnection.current = pc;

        // Add transceivers to receive video/audio
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });
        
        pc.ontrack = (event) => {
            console.log('🎬 Stream track received:', event.track.kind);
            if (videoRef.current && event.streams[0]) {
                videoRef.current.srcObject = event.streams[0];
                setIsLoading(false);
                setConnectionState('connected');
                toast({
                    title: 'Connected!',
                    description: 'You are now watching the live stream.',
                    duration: 3000
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
            const state = pc.iceConnectionState;
            console.log('ICE Connection State:', state);
            setConnectionState(state);
            
            if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                setError('Connection to stream lost. Please try again.');
                setIsLoading(false);
            }
            
            if (state === 'connected') {
                console.log('✅ ICE connection established!');
            }
        };

        pc.onconnectionstatechange = () => {
            console.log('PeerConnection State:', pc.connectionState);
        };

        pc.onsignalingstatechange = () => {
            console.log('Signaling State:', pc.signalingState);
        };

        return pc;
    }, [streamId, toast]);

    useEffect(() => {
        if (!streamId) {
            setError('No stream ID provided');
            setIsLoading(false);
            return;
        }

        console.log('🔗 Initializing buyer for stream:', streamId);

        // Socket connection handlers
        const handleConnect = () => {
            console.log('✅ Socket connected');
            setSocketConnected(true);
            // Join the stream now that we are connected
            console.log('📡 Joining stream:', streamId);
            socket.emit('buyer-join-stream', { streamId });
        };

        const handleConnectError = (err: any) => {
            console.error('Socket connection error:', err);
            setSocketConnected(false);
            setError('Failed to connect to server. Please refresh.');
        };

        const handleDisconnect = () => {
            console.log('❌ Socket disconnected');
            setSocketConnected(false);
        };

        // Seller sends offer
        const handleOffer = async (data: { from: string, offer: RTCSessionDescriptionInit }) => {
            console.log('📩 Received offer from seller:', data.from);
            sellerSocketId.current = data.from;
            
            try {
                const pc = peerConnection.current || initWebRTC();
                
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                console.log('✅ Remote description set');
                
                while (candidateQueue.current.length > 0) {
                    const candidate = candidateQueue.current.shift();
                    if (candidate) {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        } catch (e) {
                            console.error('Error adding queued ICE candidate:', e);
                        }
                    }
                }

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                
                console.log('📤 Sending answer to seller:', data.from);
                socket.emit('answer', { 
                    to: data.from, 
                    answer: pc.localDescription 
                });
                
            } catch (e) {
                console.error('Error handling offer:', e);
                setError('Failed to connect to stream. Please try again.');
                setIsLoading(false);
            }
        };
        
        const handleIceCandidate = (data: { from: string, candidate: RTCIceCandidateInit }) => {
            console.log('🧊 Received ICE candidate from:', data.from);
            const pc = peerConnection.current;
            
            if (pc && data.candidate) {
                if (!pc.remoteDescription) {
                    candidateQueue.current.push(data.candidate);
                } else {
                    pc.addIceCandidate(new RTCIceCandidate(data.candidate))
                        .catch(e => console.error('Error adding ICE candidate:', e));
                }
            }
        };

        const handleStreamEnded = () => {
            toast({ 
                title: 'Stream Ended', 
                description: 'The seller has ended the live stream.',
                variant: 'destructive'
            });
            stopWatching();
        };

        const handleStreamNotFound = () => {
            setError('Stream not found. The seller might be offline.');
            setIsLoading(false);
            toast({
                title: 'Stream Not Available',
                description: 'This stream is no longer active.',
                variant: 'destructive'
            });
        };

        socket.on('connect', handleConnect);
        socket.on('connect_error', handleConnectError);
        socket.on('disconnect', handleDisconnect);
        socket.on('offer', handleOffer);
        socket.on('ice-candidate', handleIceCandidate);
        socket.on('seller-offline', handleStreamEnded);
        socket.on('stream-not-found', handleStreamNotFound);

        initWebRTC();

        const timeout = setTimeout(() => {
            if (connectionState !== 'connected' && isLoading) {
                setError('Connection timeout. Please check if seller is online.');
                setIsLoading(false);
            }
        }, 30000);

        return () => {
            clearTimeout(timeout);
            socket.off('connect', handleConnect);
            socket.off('connect_error', handleConnectError);
            socket.off('disconnect', handleDisconnect);
            socket.off('offer', handleOffer);
            socket.off('ice-candidate', handleIceCandidate);
            socket.off('seller-offline', handleStreamEnded);
            socket.off('stream-not-found', handleStreamNotFound);
            
            if (peerConnection.current) {
                peerConnection.current.close();
            }
            
            socket.emit('buyer-leave-stream', { streamId });
        };
    }, [streamId, stopWatching, initWebRTC]);

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(!isMuted);
        }
    };

    const toggleFullscreen = () => {
        const videoContainer = videoRef.current?.parentElement;
        if (!document.fullscreenElement && videoContainer) {
            videoContainer.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const retryConnection = () => {
        setError(null);
        setIsLoading(true);
        setConnectionState('connecting');
        initWebRTC();
        socket.emit('buyer-join-stream', { streamId });
    };

    const debugConnection = () => {
        console.log('=== DEBUG INFO ===');
        console.log('Stream ID:', streamId);
        console.log('Seller Socket ID:', sellerSocketId.current);
        console.log('Socket Connected:', socket.connected);
        console.log('WebRTC State:', connectionState);
        console.log('Video Element:', videoRef.current);
        console.log('Video Source:', videoRef.current?.srcObject);
        socket.emit('debug-info');
        socket.once('debug-response', (data) => console.log('Server Debug Info:', data));
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
                    <Badge variant={socketConnected ? 'default' : 'destructive'}>
                        {socketConnected ? '🟢 Server Connected' : '🔴 Server Disconnected'}
                    </Badge>
                     <Badge variant={
                        connectionState === 'connected' ? 'default' : 
                        connectionState === 'checking' || connectionState === 'connecting' ? 'secondary' : 'destructive'
                    }>
                        {connectionState === 'connected' ? '🟢 LIVE' : 
                         connectionState === 'checking' || connectionState === 'connecting' ? '🟡 CONNECTING' : 
                         `🔴 ${connectionState.toUpperCase()}`}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={debugConnection} className="text-xs">Debug</Button>
                </div>
            </div>

            <div className="flex-1 relative bg-black">
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    controls={false}
                    className="w-full h-full object-contain"
                />
                
                {isLoading && !error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90">
                        <Loader2 className="h-12 w-12 animate-spin text-white mb-4" />
                        <p className="text-xl font-semibold text-white mb-2">Connecting to live stream...</p>
                        <p className="text-sm text-gray-300 mb-2">Status: {connectionState}</p>
                    </div>
                )}
                
                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90">
                        <div className="text-center max-w-md p-6 bg-black/70 rounded-lg">
                            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-white mb-3">Connection Error</h2>
                            <p className="text-gray-300 mb-6">{error}</p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Button variant="secondary" onClick={stopWatching} size="lg">
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Streams
                                </Button>
                                <Button variant="default" onClick={retryConnection} size="lg">
                                    <Loader2 className="mr-2 h-4 w-4" /> Retry
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {!isLoading && !error && connectionState === 'connected' && (
                    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-sm rounded-full px-6 py-3">
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
