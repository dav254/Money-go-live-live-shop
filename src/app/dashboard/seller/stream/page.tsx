'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useUser, useUserProfile } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users } from 'lucide-react';
import { StreamControls } from '@/components/studio/StreamControls';
import Recorder from '@/components/studio/Recorder';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
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

  // Generate a more accessible stream ID
  const generateStreamId = useCallback(() => {
    if (!user) return '';
    // Create a URL-friendly stream ID
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const username = sellerName.replace(/\s+/g, '-').toLowerCase();
    return `${username}-${timestamp}-${random}`;
  }, [user, sellerName]);

  const createPeerConnection = useCallback(async (buyerSocketId: string) => {
    if (!localStream.current) {
      console.error('No local stream available for peer connection');
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

      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });
      
      await pc.setLocalDescription(offer);
      
      socket.emit('offer', { 
        to: buyerSocketId, 
        offer: pc.localDescription 
      });

      console.log(`✅ Created peer connection for ${buyerSocketId}`);

    } catch (error) {
      console.error('Error creating peer connection:', error);
    }
  }, []);

  useEffect(() => {
    const handleBuyerJoined = (data: { buyerSocketId: string }) => {
      console.log(`🚀 New viewer joined: ${data.buyerSocketId}`);
      createPeerConnection(data.buyerSocketId);
      setViewerCount(prev => prev + 1);
    };

    const handleAnswer = async (data: { from: string, answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnections.current[data.from];
      if (pc && pc.signalingState !== 'stable') {
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
          console.log(`Buyer ${data.buyerSocketId} left, closed peer connection`);
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
  }, [createPeerConnection]);

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
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      localStream.current = stream;

      // Generate stream ID
      const currentStreamId = generateStreamId();
      setStreamId(currentStreamId);

      // Announce to server
      socket.emit('seller-go-live', { 
        streamId: currentStreamId, 
        sellerName: sellerName,
        sellerUid: user.uid
      });

      setIsLive(true);
      toast({ 
        title: "🎥 You are now live!", 
        description: "Share your stream ID with buyers" 
      });

      console.log('✅ Stream started with ID:', currentStreamId);

    } catch (error: any) {
      console.error('Failed to start stream:', error);
      toast({ 
        variant: 'destructive', 
        title: "Error", 
        description: error.message || "Could not access camera/microphone. Please check permissions." 
      });
    } finally {
      setIsStarting(false);
    }
  };

  const endLive = async () => {
    if (!streamId) return;

    // Stop media tracks
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        track.stop();
      });
      localStream.current = null;
    }

    // Close all peer connections
    Object.values(peerConnections.current).forEach(pc => {
      pc.close();
    });
    peerConnections.current = {};

    // Notify server
    socket.emit('seller-stop-live', { streamId });

    // Reset state
    setIsLive(false);
    setStreamId(null);
    setViewerCount(0);
    
    toast({ 
      title: "⏹️ Stream Ended", 
      description: "Your live stream has ended." 
    });
  };

  // Clean up on unmount
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
    </div>
  );
}
