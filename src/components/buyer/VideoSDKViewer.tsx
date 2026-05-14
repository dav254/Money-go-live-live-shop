'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { VideoOff, Loader2, SignalHigh, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

/**
 * Renders the seller's video stream for the buyer.
 * Attaches both video and audio tracks.
 */
const ParticipantView = ({ participantId }: { participantId: string }) => {
  const { webcamStream, micStream, webcamOn, isLocal } = useParticipant(participantId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    if (videoRef.current) {
      const mediaStream = new MediaStream();
      
      if (webcamStream) {
        mediaStream.addTrack(webcamStream.track);
      }
      
      if (micStream) {
        mediaStream.addTrack(micStream.track);
      }
      
      videoRef.current.srcObject = mediaStream;
      
      videoRef.current.play().catch(err => {
          if (err.name !== 'AbortError') {
              console.warn("[VideoSDK] Play prevented, awaiting interaction:", err);
          }
      });
    }
  }, [webcamStream, micStream]);

  const toggleLocalMute = () => {
      if (videoRef.current) {
          const newMuteState = !videoRef.current.muted;
          videoRef.current.muted = newMuteState;
          setIsMuted(newMuteState);
      }
  };

  return (
    <div className="relative h-full w-full bg-black overflow-hidden rounded-xl border border-white/10 shadow-2xl group">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted={isMuted}
        className="h-full w-full object-contain md:object-cover"
        style={{ transform: isLocal ? 'scaleX(-1)' : 'none' }}
      />
      
      {/* Immersive Unmute Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <AnimatePresence>
            {isMuted && webcamOn && (
                <Button 
                    variant="secondary" 
                    className="pointer-events-auto bg-primary text-white font-black uppercase tracking-widest px-8 h-14 rounded-2xl shadow-2xl animate-in zoom-in-90 duration-300"
                    onClick={toggleLocalMute}
                >
                    <Volume2 className="mr-2 h-5 w-5" /> TAP TO UNMUTE
                </Button>
            )}
          </AnimatePresence>
      </div>

      {!webcamOn && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/90 backdrop-blur-sm">
          <VideoOff className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="font-headline text-xl font-bold text-white uppercase tracking-tighter text-center px-8">Signal Paused</p>
          <p className="text-neutral-400 mt-2 text-xs uppercase tracking-widest">Seller is adjusting camera...</p>
        </div>
      )}

      {/* Small Toggle in Corner */}
      <div className="absolute bottom-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button 
            size="icon" 
            variant="ghost" 
            className="bg-black/40 hover:bg-black/60 rounded-full h-10 w-10 text-white" 
            onClick={toggleLocalMute}
          >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
      </div>
    </div>
  );
};

/**
 * Internal meeting logic for the buyer.
 */
const ViewerMeetingView = () => {
  const { join, participants, isMeetingJoined } = useMeeting();
  const hasAttemptedJoin = useRef(false);
  
  const handleJoin = useCallback(() => {
    if (hasAttemptedJoin.current) return;
    hasAttemptedJoin.current = true;
    join();
  }, [join]);

  useEffect(() => {
    if (!isMeetingJoined && !hasAttemptedJoin.current) {
      handleJoin();
    }
  }, [handleJoin, isMeetingJoined]);

  const host = useMemo(() => {
    const participantsArray = Array.from(participants.values());
    return participantsArray.find(p => !p.local && p.webcamOn) || 
           participantsArray.find(p => !p.local) || 
           null;
  }, [participants]);

  return (
    <div className="h-full w-full flex flex-col">
      {isMeetingJoined && host ? (
        <ParticipantView participantId={host.id} />
      ) : (
        <div className="h-full w-full flex flex-col items-center justify-center bg-black rounded-xl border border-white/5 text-center p-8">
          <div className="relative mb-8">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
              <Loader2 className="h-16 w-16 animate-spin text-primary relative z-10" />
          </div>
          <p className="text-white font-black text-xl tracking-tight uppercase">Synchronizing Live Feed</p>
          <div className="flex items-center gap-2 mt-6 text-[10px] text-neutral-500 uppercase font-black tracking-widest bg-neutral-900 px-4 py-2 rounded-full border border-white/5">
              <SignalHigh className="h-3 w-3 text-green-500" />
              <span>Searching for Host Signature...</span>
          </div>
          <Button 
            variant="ghost" 
            className="mt-8 text-neutral-500 hover:text-white text-[10px] font-black uppercase tracking-widest"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-2 h-3 w-3" /> Force Re-Sync
          </Button>
        </div>
      )}
    </div>
  );
};

import { AnimatePresence } from 'framer-motion';

export default function VideoSDKViewer({ meetingId }: { meetingId: string }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await fetch('/api/videosdk/token');
        const data = await res.json();
        if (data.token) setToken(data.token);
      } catch (err) {
        console.error("Signal token failed:", err);
      }
    };
    fetchToken();
  }, []);

  if (!token || !meetingId) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-black rounded-xl border border-white/5">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-white font-black uppercase tracking-widest text-[10px]">Connecting to Signal Network...</p>
      </div>
    );
  }

  return (
    <MeetingProvider
      config={{
        meetingId,
        micEnabled: false,
        webcamEnabled: false,
        name: "Buyer",
        mode: "CONFERENCE",
      }}
      token={token}
    >
      <MeetingConsumer>
        {() => <ViewerMeetingView />}
      </MeetingConsumer>
    </MeetingProvider>
  );
}
