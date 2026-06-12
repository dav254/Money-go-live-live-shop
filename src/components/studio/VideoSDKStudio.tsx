'use client';

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { Button } from '@/components/ui/button';
import { StopCircle, Loader2, MessageSquare, ShoppingBag, ShieldCheck, X, Zap, Sparkles, Users, Clock, Share2, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiveChat } from '@/components/buyer/LiveChat';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc, updateDoc, serverTimestamp, collection, query, orderBy, limit, onSnapshot, where, increment } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { FloatingChatOverlay } from '@/components/live/FloatingChatOverlay';
import { LivePromoPanel } from './LivePromoPanel';
import { LiveViewersList } from './LiveViewersList';
import type { LiveSession } from '@/lib/types';

const ParticipantView = ({ participantId }: { participantId: string }) => {
  const { webcamStream } = useParticipant(participantId);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && webcamStream) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(webcamStream.track);
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch((err) => {
          if (err.name !== 'AbortError') console.error("Studio play failed:", err);
      });
    }
  }, [webcamStream]);

  return (
    <div className="relative h-full w-full bg-black overflow-hidden shadow-2xl">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted={true} 
        className="h-full w-full object-cover" 
      />
      
      {!webcamStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/95 backdrop-blur-sm z-40">
          <div className="p-6 rounded-full bg-white/5 border border-white/10 mb-4 shadow-2xl">
            <Radio className="h-12 md:h-16 md:w-16 text-primary animate-pulse" />
          </div>
          <p className="text-white text-lg md:text-xl font-black font-headline uppercase tracking-widest leading-tight text-center px-6">
            Initializing 4K Signal...
          </p>
          <p className="text-neutral-500 mt-2 text-[10px] font-black uppercase tracking-widest">
            Locking High Fidelity Node
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
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2 md:gap-4 p-2 bg-black/60 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl z-50 w-[95%] max-w-fit">
      
      <Button
        size="icon"
        variant="ghost"
        onClick={() => onTogglePanel('chat')}
        className={cn(
            "rounded-xl h-10 w-10 md:h-12 md:w-12 transition-all relative shrink-0",
            activePanel === 'chat' ? "bg-primary text-white scale-110 shadow-lg shadow-primary/20" : "text-white/70 hover:bg-white/10"
        )}
      >
        <MessageSquare className="h-4 w-4 md:h-5 md:w-5" />
        {hasUnreadChat && activePanel !== 'chat' && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-block rounded-full h-3 w-3 bg-red-500 border border-black"></span>
          </span>
        )}
      </Button>

      <Button
        size="icon"
        variant="ghost"
        onClick={() => onTogglePanel('viewers')}
        className={cn(
            "rounded-xl h-10 w-10 md:h-12 md:w-12 transition-all shrink-0",
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
            "rounded-xl h-10 w-10 md:h-12 md:w-12 transition-all shrink-0",
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
            "rounded-xl h-10 w-10 md:h-12 md:w-12 transition-all shrink-0",
            activePanel === 'promos' ? "bg-yellow-500 text-black scale-110 shadow-lg shadow-yellow-500/20" : "text-white/70 hover:bg-white/10"
        )}
      >
        <Zap className="h-4 w-4 md:h-5 md:w-5" />
      </Button>

      <div className="w-px h-8 bg-white/10 mx-1 md:mx-2 hidden sm:block" />

      {!isLive ? (
        <Button
          onClick={onBroadcast}
          className="rounded-xl font-black px-4 md:px-10 h-10 md:h-12 text-[10px] md:text-sm bg-red-600 hover:bg-red-700 animate-pulse shadow-lg shadow-red-600/40 text-white border-none shrink-0"
        >
          START BROADCAST
        </Button>
      ) : (
        <Button
          variant="destructive"
          onClick={handleEndClick}
          className="rounded-xl font-bold px-4 md:px-8 h-10 md:h-12 text-[10px] md:text-sm text-white shrink-0"
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
        else setIsLowTime(false);
        
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
    <div className="flex flex-col md:flex-row h-full w-full bg-neutral-950 overflow-hidden">
      <div className="flex-1 relative flex flex-col transition-all duration-500 ease-in-out min-w-0">
          <div className="absolute top-6 left-6 right-6 md:top-10 md:left-10 md:right-10 z-30 flex items-center justify-between pointer-events-none">
              <div className="pointer-events-auto flex items-center gap-2 md:gap-3 flex-wrap">
                  <div className={cn(
                      "px-3 py-1.5 md:px-4 md:py-2 rounded-2xl text-[9px] md:text-[10px] font-black tracking-widest flex items-center gap-2 md:gap-3 backdrop-blur-xl border border-white/10",
                      isLive ? "bg-red-600 text-white" : "bg-neutral-800 text-neutral-400"
                  )}>
                      <div className={cn("h-1.5 w-1.5 md:h-2 md:w-2 rounded-full", isLive ? "bg-white animate-pulse" : "bg-neutral-600")} />
                      {isLive ? "LIVE" : "PREVIEW"}
                  </div>

                  {isLive && (
                    <div className={cn(
                        "px-3 py-1.5 md:px-4 md:py-2 rounded-2xl text-[9px] md:text-[10px] font-black tracking-widest flex items-center gap-2 backdrop-blur-xl border border-white/10",
                        isLowTime ? "bg-orange-600/20 border-orange-500/50 text-orange-500" : "bg-black/40 text-white/70"
                    )}>
                        <Clock className={cn("h-3 w-3", isLowTime && "animate-spin-slow")} />
                        <span className="font-mono">{timeRemaining}</span>
                    </div>
                  )}
              </div>
          </div>

          <div className="flex-1 relative min-h-0">
            <MeetingConsumer>
              {({ participants }) => {
                const localParticipant = Array.from(participants.values()).find(p => p.local);
                return localParticipant ? (
                  <div className="relative h-full w-full">
                    <ParticipantView participantId={localParticipant.id} />
                    <FloatingChatOverlay 
                      streamId={user?.uid || ''} 
                      className="absolute bottom-20 left-4 z-40 max-w-[80%]"
                    />
                  </div>
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center bg-black">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
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
          "shrink-0 border-t md:border-t-0 md:border-l border-white/5 bg-neutral-950 flex flex-col shadow-2xl transition-all duration-500 ease-in-out overflow-hidden h-full",
          activePanel ? "w-full md:w-80 lg:w-96" : "w-0 opacity-0 border-none"
      )}>
          <div className="flex flex-col h-full w-full md:w-80 lg:w-96 max-w-full">
              <div className="p-4 border-b border-white/5 bg-neutral-900/50 flex items-center justify-between shrink-0">
                  <p className="font-black text-[10px] uppercase tracking-[0.2em] text-white/40">
                    {activePanel === 'chat' ? 'Chat' : activePanel === 'products' ? 'Catalog' : activePanel === 'viewers' ? 'Viewers' : 'Promos'}
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
      token={token}
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
        },
        micConfig: {
            quality: "high_res",
        }
      }}
    >
      <MeetingConsumer>
        {() => <MeetingView onEnd={onEnd} onBroadcast={onBroadcast} isLive={isLive} />}
      </MeetingConsumer>
    </MeetingProvider>
  );
}