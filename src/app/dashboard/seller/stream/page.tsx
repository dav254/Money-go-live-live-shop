
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useUser, useUserProfile } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { StreamControls } from '@/components/studio/StreamControls';
import Recorder from '@/components/studio/Recorder';
import { io } from 'socket.io-client';

const socket = io('https://5000-firebase-studio-1763190344911.cluster-lu4mup47g5gm4rtyvhzpwbfadi.cloudworkstations.dev', {
  transports: ['websocket', 'polling']
});

export default function SellerStreamPage() {
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const localStream = useRef<MediaStream | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isLive, setIsLive] = useState(false);
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
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] 
      });
      
      peerConnections.current[buyerSocketId] = pc;

      // Add all tracks from local stream
      localStream.current.getTracks().forEach(track => {
        pc.addTrack(track, localStream.current!);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Sending ICE candidate to buyer:', buyerSocketId);
          socket.emit('ice-candidate', { 
            to: buyerSocketId, 
            candidate: event.candidate 
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`Connection state with ${buyerSocketId}:`, pc.connectionState);
      };

      pc.onsignalingstatechange = () => {
        console.log(`Signaling state with ${buyerSocketId}:`, pc.signalingState);
      };

      // Create and send offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await pc.setLocalDescription(offer);
      
      console.log('Sending offer to buyer:', buyerSocketId);
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
      console.log(`🚀 Buyer joined: ${data.buyerSocketId}`);
      if (localStream.current) {
        createPeerConnection(data.buyerSocketId);
      } else {
        console.error('Cannot create peer: No local stream');
      }
    };

    const handleAnswer = async (data: { from: string, answer: RTCSessionDescriptionInit }) => {
      console.log(`📩 Received answer from: ${data.from}`);
      const pc = peerConnections.current[data.from];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log(`✅ Remote description set for ${data.from}`);
        } catch (e) {
          console.error("Error setting remote description:", e);
        }
      }
    };

    const handleIceCandidate = (data: { from: string, candidate: RTCIceCandidateInit }) => {
      console.log(`🧊 Received ICE candidate from: ${data.from}`);
      const pc = peerConnections.current[data.from];
      if (pc && data.candidate) {
        pc.addIceCandidate(new RTCIceCandidate(data.candidate))
          .catch(e => console.error("Error adding ICE candidate:", e));
      }
    };

    socket.on('buyer-joined', handleBuyerJoined);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);

    return () => {
      socket.off('buyer-joined', handleBuyerJoined);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
    };
  }, [createPeerConnection]);

  const goLive = async () => {
    if (!user) return;
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
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      localStream.current = stream;

      const currentStreamId = generateStreamId(); // Use UID for stream ID
      setStreamId(currentStreamId);

      // Announce to the socket server
      socket.emit('seller-go-live', { 
        streamId: currentStreamId, 
        sellerName: sellerName,
        sellerUid: user.uid 
      });

      setIsLive(true);
      toast({ 
        title: "🎥 You are now live!", 
        description: "Buyers can see and join your stream." 
      });
      
      console.log('🎬 Stream started with ID:', currentStreamId);

    } catch (error: any) {
      toast({ 
        variant: 'destructive', 
        title: "Error", 
        description: error.message || "Could not start the live session." 
      });
    } finally {
      setIsStarting(false);
    }
  };

  const endLive = async () => {
    if (!user || !streamId) return;

    // Stop all tracks
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      localStream.current = null;
    }

    // Close all peer connections
    Object.values(peerConnections.current).forEach(pc => {
      pc.close();
    });
    peerConnections.current = {};

    // Announce to server
    socket.emit('seller-stop-live', { streamId });

    setIsLive(false);
    setStreamId(null);
    
    toast({ 
      title: "⏹️ Stream Ended", 
      description: "You are no longer live." 
    });
    
    console.log('🔴 Stream ended');
  };

  return (
    <div className="flex-1 p-4 lg:p-6 flex flex-col gap-4 h-[calc(100vh-4rem)] overflow-hidden">
      <div className="relative flex-1">
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
      
      {/* Debug info */}
      <div className="mt-4 p-3 bg-gray-100 rounded text-xs text-black">
        <p><strong>Stream ID:</strong> {streamId || 'Not live'}</p>
        <p><strong>Active Connections:</strong> {Object.keys(peerConnections.current).length}</p>
        <p><strong>Seller Socket ID:</strong> {socket.id || 'Connecting...'}</p>
      </div>
    </div>
  );
}
