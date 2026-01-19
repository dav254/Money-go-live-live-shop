
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { useUser, useUserProfile } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { StreamControls } from '@/components/studio/StreamControls';
import Recorder from '@/components/studio/Recorder';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

export default function SellerStreamPage() {
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const localStream = useRef<MediaStream | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const { toast } = useToast();
  
  const sellerName = userProfile?.shopName || userProfile?.fullName || 'Seller';

  // Effect for handling all socket event listeners
  useEffect(() => {
    const handleBuyerJoined = async (data: { buyerSocketId: string, viewerCount: number }) => {
      console.log(`Buyer ${data.buyerSocketId} joined. Total viewers: ${data.viewerCount}`);
      if (localStream.current) {
        await createPeerConnection(data.buyerSocketId);
      }
    };

    const handleAnswer = async (data: { from: string, answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnections.current[data.from];
      if (pc && pc.signalingState !== 'stable') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (e) {
          console.error("Error setting remote description:", e);
        }
      }
    };

    const handleIceCandidate = (data: { from: string, candidate: RTCIceCandidateInit }) => {
      const pc = peerConnections.current[data.from];
      if (pc && data.candidate) {
        pc.addIceCandidate(new RTCIceCandidate(data.candidate));
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
  }, []); // Empty dependency array means this runs once on mount

  const createPeerConnection = async (buyerSocketId: string) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peerConnections.current[buyerSocketId] = pc;

    localStream.current?.getTracks().forEach(track => {
      if (localStream.current) {
        pc.addTrack(track, localStream.current);
      }
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { to: buyerSocketId, candidate: event.candidate });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', { to: buyerSocketId, offer });
  };

  const goLive = async () => {
    if (!user) return;
    setIsStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      localStream.current = stream;

      const token = await user.getIdToken();
      const response = await fetch('/api/live-session', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to create live session on the server.');
      }
      
      const { liveSessionId } = await response.json();
      setStreamId(liveSessionId);

      // Announce to the socket server
      socket.emit('seller-go-live', { streamId: liveSessionId, sellerName: sellerName });

      setIsLive(true);
      toast({ title: "You are now live!", description: "Buyers can see and join your stream." });
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Error", description: error.message || "Could not start the live session." });
    } finally {
      setIsStarting(false);
    }
  };

  const endLive = async () => {
    if (!user || !streamId) return;

    localStream.current?.getTracks().forEach(track => track.stop());
    localStream.current = null;
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};

    try {
      const token = await user.getIdToken();
      await fetch('/api/live-session', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveSessionId: streamId }),
      });

      // Announce to the socket server
      socket.emit('seller-stop-live', { streamId });

      setIsLive(false);
      setStreamId(null);
      toast({ title: "Stream Ended", description: "You are no longer live." });
    } catch (error) {
      console.error("Failed to end live session:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not properly end the live session.' });
    }
  };

  return (
    <SellerLayout>
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
          />
        </div>
      </div>
    </SellerLayout>
  );
}
