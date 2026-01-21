'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useUser, useUserProfile } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users } from 'lucide-react';
import { StreamControls } from '@/components/studio/StreamControls';
import Recorder from '@/components/studio/Recorder';
import { io } from 'socket.io-client';

const SOCKET_URL = 'https://5000-firebase-studio-1763190344911.cluster-lu4mup47g5gm4rtyvhzpwbfadi.cloudworkstations.dev';

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5
});

export default function SellerStreamPage() {
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const localStream = useRef<MediaStream | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const { toast } = useToast();
  
  const sellerName = userProfile?.shopName || userProfile?.fullName || 'Seller';

  const generateStreamId = useCallback(() => {
    if (!user) return '';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const username = sellerName.replace(/\s+/g, '-').toLowerCase();
    return `${username}-${timestamp}-${random}`;
  }, [user, sellerName]);

  const createPeerConnection = useCallback(async (buyerSocketId: string) => {
    if (!localStream.current) {
      console.error('No local stream available');
      return;
    }

    try {
      const pc = new RTCPeerConnection({ 
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      });
      
      peerConnections.current[buyerSocketId] = pc;

      // Add tracks
      localStream.current.getTracks().forEach(track => {
        pc.addTrack(track, localStream.current!);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { 
            to: buyerSocketId, 
            candidate: event.candidate 
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`ICE state with ${buyerSocketId}:`, pc.iceConnectionState);
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          // Clean up failed connection
          setTimeout(() => {
            if (peerConnections.current[buyerSocketId]) {
              peerConnections.current[buyerSocketId].close();
              delete peerConnections.current[buyerSocketId];
              setViewerCount(prev => Math.max(0, prev - 1));
            }
          }, 2000);
        }
      };

      // Create offer (seller initiates)
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });
      
      await pc.setLocalDescription(offer);
      
      console.log(`📤 Sending offer to buyer: ${buyerSocketId}`);
      socket.emit('offer', { 
        to: buyerSocketId, 
        offer: pc.localDescription 
      });

    } catch (error) {
      console.error('Error creating peer connection:', error);
    }
  }, []);

  // Handle buyer joined
  useEffect(() => {
    const handleBuyerJoined = (data: { buyerSocketId: string }) => {
      console.log(`🚀 New viewer joined: ${data.buyerSocketId}`);
      createPeerConnection(data.buyerSocketId);
      setViewerCount(prev => prev + 1);
      toast({
        title: 'New Viewer',
        description: 'A buyer has joined your stream',
        duration: 3000
      });
    };

    const handleAnswer = async (data: { from: string, answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnections.current[data.from];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log(`✅ Answer received from ${data.from}`);
        } catch (e) {
          console.error("Error setting remote description:", e);
        }
      }
    };

    const handleIceCandidate = (data: { from: string, candidate: RTCIceCandidateInit }) => {
      const pc = peerConnections.current[data.from];
      if (pc && data.candidate) {
        pc.addIceCandidate(new RTCIceCandidate(data.candidate))
          .catch(e => console.error("Error adding ICE candidate:", e));
      }
    };
    
    const handleBuyerLeft = (data: { buyerSocketId: string }) => {
      const pc = peerConnections.current[data.buyerSocketId];
      if (pc) {
        pc.close();
        delete peerConnections.current[data.buyerSocketId];
        setViewerCount(prev => Math.max(0, prev - 1));
        console.log(`Buyer ${data.buyerSocketId} left`);
      }
    };

    socket.on('buyer-joined', handleBuyerJoined);
    socket.on('buyer-left', handleBuyerLeft);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);

    return () => {
      socket.off('buyer-joined', handleBuyerJoined);
      socket.off('buyer-left', handleBuyerLeft);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
    };
  }, [createPeerConnection, toast]);

  const goLive = async () => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: "Error",
        description: "Please login to start a live stream"
      });
      return;
    }

    setIsStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true
        }
      });
      
      localStream.current = stream;

      const currentStreamId = generateStreamId();
      setStreamId(currentStreamId);

      socket.emit('seller-go-live', { 
        streamId: currentStreamId, 
        sellerName: sellerName,
        sellerUid: user.uid
      });

      setIsLive(true);
      toast({ 
        title: "🎥 You are now live!", 
        description: "Buyers can now join your stream" 
      });

    } catch (error: any) {
      console.error('Failed to start stream:', error);
      toast({ 
        variant: 'destructive', 
        title: "Error", 
        description: error.message || "Could not access camera/microphone" 
      });
    } finally {
      setIsStarting(false);
    }
  };

  const endLive = async () => {
    if (!streamId) return;

    // Stop media tracks
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
      localStream.current = null;
    }

    // Close all peer connections
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};

    socket.emit('seller-stop-live', { streamId });

    setIsLive(false);
    setStreamId(null);
    setViewerCount(0);
    
    toast({ 
      title: "⏹️ Stream Ended", 
      description: "Your live stream has ended" 
    });
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (isLive && streamId) {
        endLive();
      }
    };
  }, [isLive, streamId]);

  return (
    <div className="flex-1 p-4 lg:p-6 flex flex-col gap-4 h-[calc(100vh-4rem)] overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Stream Studio</h1>
          <p className="text-sm text-muted-foreground">
            Stream directly to your buyers
          </p>
        </div>
        {isLive && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full">
              <div className="h-2 w-2 bg-white rounded-full animate-pulse" />
              <span className="font-semibold">LIVE</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              <span>{viewerCount} viewer{viewerCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}
      </div>

      <div className="relative flex-1 bg-black rounded-xl overflow-hidden">
        <Recorder stream={localStream.current} isLive={isLive} />
        
        {!isLive && !isStarting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-black text-white">
            <div className="text-center p-8">
              <div className="text-6xl mb-4">🎥</div>
              <h2 className="text-2xl font-bold mb-2">Ready to Go Live?</h2>
              <p className="text-gray-300 mb-6">Start streaming to connect with your buyers in real-time</p>
              <button
                onClick={goLive}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-8 rounded-full text-lg transition-all duration-300 transform hover:scale-105"
              >
                Start Live Stream
              </button>
            </div>
          </div>
        )}
        
        {isStarting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
              <p className="text-lg font-semibold">Preparing your live stream...</p>
              <p className="text-sm text-gray-300 mt-2">Please allow camera & microphone access</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0">
        <StreamControls
          isLive={isLive}
          isStarting={isStarting}
          onGoLive={goLive}
          onEndLive={endLive}
          streamId={streamId}
        />
      </div>

      {isLive && streamId && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="font-semibold mb-2">Stream Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Stream ID</p>
              <p className="font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded break-all">
                {streamId}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Share Link</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/buyer/live/${streamId}`}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 p-2 rounded text-sm"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/buyer/live/${streamId}`);
                    toast({ title: "Link copied!" });
                  }}
                  className="px-4 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
