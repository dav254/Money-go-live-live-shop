'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { Button } from '@/components/ui/button';
import { StopCircle, Loader2, VideoOff, MessageSquare, ShoppingBag, ShieldCheck, X, Zap, Sparkles, Users, Clock, Share2, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiveChat } from '@/components/buyer/LiveChat';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc, updateDoc, serverTimestamp, collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { FloatingChatOverlay } from '@/components/live/FloatingChatOverlay';
import { LivePromoPanel } from './LivePromoPanel';
import { LiveViewersList } from './LiveViewersList';
import type { LiveSession } from '@/lib/types';

/**
 * Optimized ParticipantView for the Seller Studio.
 * Locked to HHD quality for a professional broadcast feel.
 */
const ParticipantView = ({ participantId }: { participantId: string }) => {
  const { webcamStream, webcamOn, local } = useParticipant(participantId);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Stable effect for video attachment
  useEffect(() => {
    if (videoRef.current && webcamStream) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(webcamStream.track);
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch((err) => {
          if (err.name !== 'AbortError') console.error("Studio play failed:", err);
      });
    }
    
    return () => {
        if (videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
    };
  }, [webcamStream]);

  return (
    <div className="relative h-full w-full bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/5">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted={local} 
        className="h-full w-full object-contain md:object-cover" 
      />
      
      {!webcamStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/95 backdrop-blur-sm z-40">
          <div className="p-6 rounded-full bg-white/5 border border-white/10 mb-4 shadow-2xl">
            <Radio className="h-12 md:h-16 md:w-16 text-primary animate-pulse" />
          </div>
          <p className="text-white text-lg md:text-xl font-black font-headline uppercase tracking-widest leading-tight">
            Connecting Studio...
          </p>
          <p className="text-neutral-500 mt-2 text-[10px] font-black uppercase tracking-widest">
            Locking HD Data Signal
          </p>
        </div>
      )}
    </div>
  );
};

interface StudioControlsProps {
    onEnd: () => void;
    onBroadcast: () => void;
    isLive: boolean;
    activePanel: 'chat' | 'products' | 'promos' | 'viewers' | null;
    onTogglePanel: (panel: 'chat' | 'products' | 'promos' | 'viewers') => void;
    hasUnreadChat: boolean;
}

const StudioControls = ({ onEnd, onBroadcast, isLive, activePanel, onTogglePanel, hasUnreadChat }: StudioControlsProps) => {
  const { leave } = useMeeting();

  const handleEndClick = () => {
    leave();
    onEnd();
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-4 p-2 bg-black/60 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl z-50">
      
      <Button
        size="icon"
        variant="ghost"
        onClick={() => onTogglePanel('chat')}
        className={cn(
            "rounded-xl h-10 w-10 md:h-12 md:w-12 transition-all relative",
            activePanel === 'chat' ? "bg-primary text-white scale-110 shadow-lg shadow-primary/20" : "text-white/70 hover:bg-white/10"
        )}
      >
        <MessageSquare className="h-4 w-4 md:h-5 md:w-5" />
        {hasUnreadChat && activePanel !== 'chat' && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-black"></span>
          </span>
        )}
      </Button>

      <Button
        size="icon"
        variant="ghost"
        onClick={() => onTogglePanel('viewers')}
        className={cn(
            "rounded-xl h-10 w-10 md:h-12 md:w-12 transition-all",
            activePanel === 'viewers' ? "bg-primary text-white scale-110 shadow-lg shadow-primary/20" : "text-white/70 hover:bg-white/10"
        )}
      >
        <Users className="h-4 w-4 md:h-5 md:w-5" />
      </Button>

      <Button
        size="icon"
        variant="ghost"
        onClick={() => onTogglePanel('products')}
        className={cn(
            "rounded-xl h-10 w-10 md:h-12 md:w-12 transition-all",
            activePanel === 'products' ? "bg-primary text-white scale-110 shadow-lg shadow-primary/20" : "text-white/70 hover:bg-white/10"
        )}
      >
        <ShoppingBag className="h-4 w-4 md:h-5 md:w-5" />
      </Button>

      <Button
        size="icon"
        variant="ghost"
        onClick={() => onTogglePanel('promos')}
        className={cn(
            "rounded-xl h-10 w-10 md:h-12 md:w-12 transition-all",
            activePanel === 'promos' ? "bg-yellow-500 text-black scale-110 shadow-lg shadow-yellow-500/20" : "text-white/70 hover:bg-white/10"
        )}
      >
        <Zap className="h-4 w-4 md:h-5 md:w-5" />
      </Button>

      <div className="w-px h-8 bg-white/10 mx-1 md:mx-2" />

      {!isLive ? (
        <Button
          onClick={onBroadcast}
          className="rounded-xl font-black px-6 md:px-10 h-10 md:h-12 text-xs md:sm bg-red-600 hover:bg-red-700 animate-pulse shadow-lg shadow-red-600/40 text-white border-none"
        >
          START BROADCAST
        </Button>
      ) : (
        <Button
          variant="destructive"
          onClick={handleEndClick}
          className="rounded-xl font-bold px-4 md:px-8 h-10 md:h-12 text-xs md:sm text-white"
        >
          <StopCircle className="mr-2 h-4 w-4" /> END SHOW
        </Button>
      )}
    </div>
  );
};

const MeetingView = ({ onEnd, onBroadcast, isLive }: { onEnd: () => void, onBroadcast: () => void, isLive: boolean }) => {
  const { join, isMeetingJoined } = useMeeting();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [pinnedProductId, setPinnedProductId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'chat' | 'products' | 'promos' | 'viewers' | null>(null);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('70:00');
  const [isLowTime, setIsLowTime] = useState(false);
  
  const hasAttemptedJoin = useRef(false);

  const sessionRef = useMemo(() => (firestore && user) ? doc(firestore, 'liveSessions', user.uid) : null, [firestore, user]);
  const { data: session } = useDoc<LiveSession>(sessionRef);

  useEffect(() => {
    if (!firestore || !user?.uid || !isLive || activePanel === 'chat' || !session?.startTime) {
      if (activePanel === 'chat') setHasUnreadChat(false);
      return;
    }

    const q = query(
      collection(firestore, `liveSessions/${user.uid}/chat`),
      where('timestamp', '>', session.startTime),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty && activePanel !== 'chat') {
        setHasUnreadChat(true);
      }
    });

    return () => unsubscribe();
  }, [firestore, user?.uid, isLive, activePanel, session?.startTime]);

  useEffect(() => {
    if (!isLive || !session?.startTime) return;

    const timer = setInterval(() => {
        const now = Date.now();
        const start = session.startTime.toMillis();
        const elapsed = now - start;
        const limitMs = 70 * 60 * 1000;
        const remaining = Math.max(0, limitMs - elapsed);

        if (remaining <= 0) {
            clearInterval(timer);
            onEnd();
            return;
        }

        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        
        if (mins < 5) setIsLowTime(true);
        
        setTimeRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [isLive, session?.startTime, onEnd]);

  useEffect(() => {
    if (!isMeetingJoined && !hasAttemptedJoin.current) {
        hasAttemptedJoin.current = true;
        join();
    }
  }, [join, isMeetingJoined]);

  const handleTogglePanel = (panel: 'chat' | 'products' | 'promos' | 'viewers') => {
      setActivePanel(prev => prev === panel ? null : panel);
  };

  const handlePinProduct = async (product: any) => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'liveSessions', user.uid), { pinnedProductId: product.id });
        setPinnedProductId(product.id);
        toast({ title: 'Product Pinned!', description: `Buyers can now see "${product.name}" prominently.` });
    } catch (e) {
        toast({ variant: 'destructive', title: 'Pin Failed' });
    }
  };

  const handleUnpinProduct = async () => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'liveSessions', user.uid), { pinnedProductId: null });
        setPinnedProductId(null);
        toast({ title: 'Product Unpinned' });
    } catch (e) {
        toast({ variant: 'destructive', title: 'Unpin Failed' });
    }
  };

  const handleShare = () => {
    if (!user) return;
    const url = `${window.location.origin}/buyer/live/${user.uid}`;
    navigator.clipboard.writeText(url).then(() => {
        toast({ title: 'Link Copied!', description: 'Invite people to your stream.' });
    });
  };

  const handleBroadcastWithUpdate = async () => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'liveSessions', user.uid), {
            status: 'live',
            startTime: serverTimestamp(),
            lastStartedAt: serverTimestamp()
        });
        onBroadcast();
    } catch (e) {
        toast({ variant: 'destructive', title: "Signal Failed" });
    }
  };

  return (
    <div className="flex h-full w-full bg-neutral-950 overflow-hidden">
      <div className="flex-1 relative flex flex-col p-4 md:p-6 transition-all duration-500 ease-in-out">
          <div className="absolute top-10 left-10 right-10 z-30 flex items-center justify-between pointer-events-none">
              <div className="pointer-events-auto flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                        "px-4 py-2 rounded-2xl text-[10px] font-black tracking-widest flex items-center gap-3 backdrop-blur-xl border border-white/10",
                        isLive ? "bg-red-600 text-white" : "bg-neutral-800 text-neutral-400"
                    )}>
                        <div className={cn("h-2 w-2 rounded-full", isLive ? "bg-white animate-pulse" : "bg-neutral-600")} />
                        {isLive ? "LIVE BROADCAST" : "PREVIEW MODE"}
                    </div>

                    <Button 
                        onClick={handleShare}
                        size="icon" 
                        variant="ghost" 
                        className="h-9 w-9 rounded-full backdrop-blur-xl border border-white/10 bg-black/40 text-white shadow-2xl hover:bg-black/60 active:scale-95 transition-all pointer-events-auto"
                        title="Share Stream"
                    >
                        <Share2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {isLive && (
                    <div className={cn(
                        "px-4 py-2 rounded-2xl text-[10px] font-black tracking-widest flex items-center gap-2 backdrop-blur-xl border border-white/10",
                        isLowTime ? "bg-orange-600/20 border-orange-500/50 text-orange-500" : "bg-black/40 text-white/70"
                    )}>
                        <Clock className={cn("h-3 w-3", isLowTime && "animate-spin-slow")} />
                        <span className="font-mono">{timeRemaining}</span>
                    </div>
                  )}
                  
                  {session?.title && (
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl hidden md:block">
                        <p className="text-white font-black uppercase text-[10px] tracking-tight">{session.title}</p>
                    </div>
                  )}
              </div>
          </div>

          <div className="flex-1 relative">
            <MeetingConsumer>
              {({ participants }) => {
                const localParticipant = Array.from(participants.values()).find(p => p.local);
                return localParticipant ? (
                  <div className="relative h-full w-full">
                    <ParticipantView participantId={localParticipant.id} />
                    <FloatingChatOverlay 
                      streamId={user?.uid || ''} 
                      className="absolute bottom-20 left-4 z-40"
                    />
                  </div>
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center bg-black rounded-3xl">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                        <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
                    </div>
                    <p className="text-white/50 text-sm font-medium uppercase tracking-widest font-headline text-center">Synchronizing Studio Hub...</p>
                  </div>
                );
              }}
            </MeetingConsumer>
          </div>

          <StudioControls 
            onEnd={onEnd} 
            onBroadcast={handleBroadcastWithUpdate} 
            isLive={isLive} 
            activePanel={activePanel}
            onTogglePanel={handleTogglePanel}
            hasUnreadChat={hasUnreadChat}
          />
      </div>

      <div className={cn(
          "shrink-0 border-l border-white/5 bg-neutral-950 flex flex-col shadow-2xl transition-all duration-500 ease-in-out overflow-hidden h-full",
          activePanel ? "w-full md:w-80 lg:w-96" : "w-0 opacity-0 border-none"
      )}>
          <div className="flex flex-col h-full w-full md:w-80 lg:w-96">
              <div className="p-4 border-b border-white/5 bg-neutral-900/50 flex items-center justify-between shrink-0">
                  <p className="font-black text-[10px] uppercase tracking-[0.2em] text-white/40">
                    {activePanel === 'chat' ? 'Public Chat' : activePanel === 'products' ? 'Catalog Tools' : activePanel === 'viewers' ? 'Active Viewers' : 'Live Promos'}
                  </p>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full hover:bg-white/5" 
                    onClick={() => setActivePanel(null)}
                  >
                    <X className="h-4 w-4 text-white/40" />
                  </Button>
              </div>

              <div className="flex-1 overflow-hidden relative">
                  <div className={cn("absolute inset-0 flex flex-col transition-opacity duration-300", activePanel === 'chat' ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none")}>
                      {user ? <LiveChat streamId={user.uid} /> : null}
                  </div>
                  <div className={cn("absolute inset-0 flex flex-col transition-opacity duration-300", activePanel === 'viewers' ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none")}>
                      <LiveViewersList />
                  </div>
                  <div className={cn("absolute inset-0 flex flex-col transition-opacity duration-300", activePanel === 'products' ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none")}>
                      <div className="flex flex-col h-full overflow-hidden">
                          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-neutral-900/20 shrink-0">
                              <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">My Catalog</p>
                              <ShieldCheck className="h-4 w-4 text-green-500" />
                          </div>
                          <div className="flex-1 overflow-hidden">
                              {user && (
                                  <LiveProductShelf 
                                      sellerId={user.uid} 
                                      onPinProduct={handlePinProduct} 
                                      onUnpinProduct={handleUnpinProduct}
                                      pinnedProductId={pinnedProductId}
                                  />
                              )}
                          </div>
                      </div>
                  </div>
                  <div className={cn("absolute inset-0 flex flex-col transition-opacity duration-300", activePanel === 'promos' ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none")}>
                      <div className="flex flex-col h-full overflow-hidden">
                          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-neutral-900/20 shrink-0">
                              <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Growth Tools</p>
                              <Sparkles className="h-4 w-4 text-yellow-500" />
                          </div>
                          <div className="flex-1 overflow-hidden">
                              {user && <LivePromoPanel streamId={user.uid} />}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default function VideoSDKStudio({ meetingId, participantName, token, onEnd, onBroadcast, isLive }: { 
    meetingId: string, 
    participantName: string, 
    token: string, 
    onEnd: () => void,
    onBroadcast: () => void,
    isLive: boolean
}) {
  return (
    <MeetingProvider
      config={{
        meetingId,
        micEnabled: true,
        webcamEnabled: true,
        name: participantName,
        mode: "CONFERENCE",
        multiStream: false,
        webcamConfig: {
            resolution: "hhd", 
            optimizationMode: "motion",
            multiStream: false,
        },
        micConfig: {
            quality: "high_res",
        }
      }}
      token={token}
    >
      <MeetingConsumer>
        {() => <MeetingView onEnd={onEnd} onBroadcast={onBroadcast} isLive={isLive} />}
      </MeetingConsumer>
    </MeetingProvider>
  );
}
