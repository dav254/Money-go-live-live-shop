'use client';

import React, { useRef, useEffect, useState } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { Button } from '@/components/ui/button';
import { StopCircle, Loader2, Video, VideoOff, Mic, MicOff, RefreshCw, MessageSquare, ShoppingBag, Pin, PinOff, Zap, ShieldCheck, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiveChat } from '@/components/buyer/LiveChat';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const ParticipantView = ({ participantId }: { participantId: string }) => {
  const { webcamStream, webcamOn, local, enableWebcam } = useParticipant(participantId);
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
  }, [webcamStream, webcamOn]);

  const forceEnableWebcam = async () => {
      try {
          await navigator.mediaDevices.getUserMedia({ video: true });
          enableWebcam();
      } catch (err) {
          console.error("Force webcam failed:", err);
      }
  };

  return (
    <div className="relative h-full w-full bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/5">
      <video ref={videoRef} autoPlay playsInline muted={local} className="h-full w-full object-contain md:object-cover" />
      {!webcamOn && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/95 backdrop-blur-sm p-6 text-center">
          <div className="p-6 rounded-full bg-white/5 border border-white/10 mb-4 shadow-2xl">
            <VideoOff className="h-12 md:h-16 md:w-16 text-primary animate-pulse" />
          </div>
          <p className="text-white text-lg md:text-xl font-black font-headline uppercase tracking-widest leading-tight">Camera Preview Offline</p>
          <Button 
            variant="outline" 
            className="mt-6 border-primary/50 text-primary hover:bg-primary/10 font-black tracking-widest uppercase text-xs px-8 py-6 rounded-2xl"
            onClick={forceEnableWebcam}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            RE-SYNC CAMERA
          </Button>
        </div>
      )}
    </div>
  );
};

interface StudioControlsProps {
    onEnd: () => void;
    onBroadcast: () => void;
    isLive: boolean;
    activePanel: 'chat' | 'products' | null;
    onTogglePanel: (panel: 'chat' | 'products') => void;
}

const StudioControls = ({ onEnd, onBroadcast, isLive, activePanel, onTogglePanel }: StudioControlsProps) => {
  const { leave, enableWebcam, disableWebcam, unmuteMic, muteMic, webcamOn, micOn } = useMeeting();

  const handleEndClick = () => {
    leave();
    onEnd();
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-4 p-2 bg-black/60 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl z-50">
      <Button
        size="icon"
        variant={micOn ? "secondary" : "destructive"}
        onClick={() => micOn ? muteMic() : unmuteMic()}
        className="rounded-xl h-10 w-10 md:h-12 md:w-12"
      >
        {micOn ? <Mic className="h-4 w-4 md:h-5 md:w-5 text-white" /> : <MicOff className="h-4 w-4 md:h-5 md:w-5 text-white" />}
      </Button>
      <Button
        size="icon"
        variant={webcamOn ? "secondary" : "destructive"}
        onClick={() => webcamOn ? disableWebcam() : enableWebcam()}
        className="rounded-xl h-10 w-10 md:h-12 md:w-12"
      >
        {webcamOn ? <Video className="h-4 w-4 md:h-5 md:w-5 text-white" /> : <VideoOff className="h-4 w-4 md:h-5 md:w-5 text-white" />}
      </Button>
      
      <div className="w-px h-8 bg-white/10 mx-1 md:mx-2" />

      {/* NEW: Chat and Product Toggles */}
      <Button
        size="icon"
        variant="ghost"
        onClick={() => onTogglePanel('chat')}
        className={cn(
            "rounded-xl h-10 w-10 md:h-12 md:w-12 transition-all",
            activePanel === 'chat' ? "bg-primary text-white scale-110 shadow-lg shadow-primary/20" : "text-white/70 hover:bg-white/10"
        )}
      >
        <MessageSquare className="h-4 w-4 md:h-5 md:w-5" />
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

      <div className="w-px h-8 bg-white/10 mx-1 md:mx-2" />

      {!isLive ? (
        <Button
          onClick={onBroadcast}
          className="rounded-xl font-black px-6 md:px-10 h-10 md:h-12 text-xs md:text-sm bg-red-600 hover:bg-red-700 animate-pulse shadow-lg shadow-red-600/40 text-white border-none"
        >
          START BROADCAST
        </Button>
      ) : (
        <Button
          variant="destructive"
          onClick={handleEndClick}
          className="rounded-xl font-bold px-4 md:px-8 h-10 md:h-12 text-xs md:text-sm text-white"
        >
          <StopCircle className="mr-2 h-4 w-4" /> END SHOW
        </Button>
      )}
    </div>
  );
};

const MeetingView = ({ onEnd, onBroadcast, isLive }: { onEnd: () => void, onBroadcast: () => void, isLive: boolean }) => {
  const { join, isMeetingJoined, participants } = useMeeting();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [pinnedProductId, setPinnedProductId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'chat' | 'products' | null>(null);
  
  const hasAttemptedJoin = useRef(false);

  useEffect(() => {
    if (!isMeetingJoined && !hasAttemptedJoin.current) {
        hasAttemptedJoin.current = true;
        join();
    }
  }, [join, isMeetingJoined]);

  const handleTogglePanel = (panel: 'chat' | 'products') => {
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

  return (
    <div className="flex h-full w-full bg-neutral-950 overflow-hidden">
      {/* Main Studio Area */}
      <div className="flex-1 relative flex flex-col p-4 md:p-6 lg:p-8 transition-all duration-500 ease-in-out">
          <div className="absolute top-10 left-10 right-10 z-30 flex items-center justify-between pointer-events-none">
              <div className="pointer-events-auto">
                  <div className={cn(
                      "px-4 py-2 rounded-2xl text-[10px] font-black tracking-widest flex items-center gap-3 backdrop-blur-xl border border-white/10",
                      isLive ? "bg-red-600 text-white" : "bg-neutral-800 text-neutral-400"
                  )}>
                      <div className={cn("h-2 w-2 rounded-full", isLive ? "bg-white animate-pulse" : "bg-neutral-600")} />
                      {isLive ? "LIVE BROADCAST" : "PREVIEW MODE"}
                  </div>
              </div>
          </div>

          <div className="flex-1 relative">
            <MeetingConsumer>
              {({ participants }) => {
                const localParticipant = Array.from(participants.values()).find(p => p.local);
                return localParticipant ? (
                  <ParticipantView participantId={localParticipant.id} />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center bg-black rounded-3xl">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                        <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
                    </div>
                    <p className="text-white/50 text-sm font-medium uppercase tracking-widest font-headline">Studio Signal Sync...</p>
                  </div>
                );
              }}
            </MeetingConsumer>
          </div>

          <StudioControls 
            onEnd={onEnd} 
            onBroadcast={onBroadcast} 
            isLive={isLive} 
            activePanel={activePanel}
            onTogglePanel={handleTogglePanel}
          />
      </div>

      {/* Side Panel: Chat & Products (Conditional/Toggleable) */}
      <div className={cn(
          "shrink-0 border-l border-white/5 bg-neutral-950 flex flex-col shadow-2xl transition-all duration-500 ease-in-out overflow-hidden",
          activePanel ? "w-80 lg:w-96" : "w-0 opacity-0 border-none"
      )}>
          <Tabs value={activePanel || ''} onValueChange={(val) => setActivePanel(val as any)} className="flex-1 flex flex-col w-80 lg:w-96">
              <div className="p-4 border-b border-white/5 bg-neutral-900/50 flex items-center justify-between">
                  <p className="font-black text-[10px] uppercase tracking-[0.2em] text-white/40">Studio Toolbox</p>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-white/30 hover:text-white" onClick={() => setActivePanel(null)}>
                      <ChevronRight className="h-4 w-4" />
                  </Button>
              </div>

              <TabsContent value="chat" className="flex-1 mt-0">
                  {user ? <LiveChat streamId={user.uid} /> : <div className="p-12 text-center text-neutral-500 uppercase font-black text-[10px] tracking-widest">Loading Chat...</div>}
              </TabsContent>

              <TabsContent value="products" className="flex-1 mt-0 flex flex-col">
                  <div className="p-4 border-b border-white/5 flex items-center justify-between">
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
              </TabsContent>
          </Tabs>
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
      }}
      token={token}
    >
      <MeetingConsumer>
        {() => <MeetingView onEnd={onEnd} onBroadcast={onBroadcast} isLive={isLive} />}
      </MeetingConsumer>
    </MeetingProvider>
  );
}
