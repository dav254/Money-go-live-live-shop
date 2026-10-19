'use client';

/**
 * SELLER LIVE STUDIO — the only seller-facing live surface.
 *
 * One section, one job: go live, then run the show from the stage. While
 * live the seller sees their own camera plus the controls a broadcast
 * actually needs: the live comment thread (the same Firestore chat the buyer
 * watch page writes to), their product shelf with one-tap pin/unpin (buyers
 * see a pinned product on their screen instantly), a viewer count, and the
 * session countdown.
 *
 * Transport: LiveKit when the server has LIVEKIT_* configured — POST
 * /api/live-session authenticates the seller, charges the session, mints a
 * server-side broadcaster token and returns the room name + websocket URL in
 * one response, so the API secret never reaches the browser. When LiveKit is
 * not configured the same endpoint falls back to VideoSDK (the original
 * transport, still served on the buyer side) so Go live always works on the
 * transport the server can actually run.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser, useUserProfile, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { LiveChat } from '@/components/buyer/LiveChat';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import { useToast } from '@/hooks/use-toast';
import type { LiveSession, Product } from '@/lib/types';
import {
  ArrowLeft, BadgeCent, Camera, Loader2, MessageSquare, Radio, Share2,
  ShoppingBag, Square, Users, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAX_LIVE_SECONDS } from '@/lib/listings/limits';

const HostPreview = dynamic(() => import('@/components/live/host-preview'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Opening your studio…</p>
    </div>
  ),
});

/** VideoSDK fallback stage — used when the server has no LiveKit keys. */
const VideosdkHostPreview = dynamic(() => import('@/components/live/videosdk-host-preview'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Opening your studio…</p>
    </div>
  ),
});

/** The connection a live broadcast runs on — provider-specific details. */
type LiveConnection =
  | { provider: 'livekit'; wsUrl: string; roomName: string; token: string }
  | { provider: 'videosdk'; meetingId: string; token: string };

const SESSION_COST = 100;

export function SellerLiveStudio({
  viewerBasePath = '/buyer/live',
  backHref = '/dashboard/seller',
  backLabel = 'Back',
}: {
  viewerBasePath?: string;
  /** Where "Back" goes. The app has its own shell, so it passes its own root. */
  backHref?: string;
  backLabel?: string;
}) {
  const { user } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const { toast } = useToast();
  const previewRef = useRef<HTMLVideoElement>(null);

  // No preflight token fetch: LiveKit connection details arrive together
  // with the session itself from POST /api/live-session, so a config problem
  // surfaces exactly when the sellers presses Go live — and a missing config
  // fails the request server-side instead of showing a half-ready studio.
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<'idle' | 'starting' | 'live'>('idle');
  const [session, setSession] = useState<LiveConnection | null>(null);
  const [cameraDenied, setCameraDenied] = useState(false);
  /**
   * The server said "already live" (HTTP 200, no charge): a session of this
   * seller's is still inside its paid window. Shown as a professional resume
   * panel with direct actions — never a blocking error.
   */
  const [alreadyLive, setAlreadyLive] = useState<{ title: string; remainingMs: number } | null>(null);

  const points = userProfile?.aiPoints ?? 0;
  const canStart = points >= SESSION_COST && !cameraDenied;

  /* ------------------------- live-stage controls ------------------------- */
  /** Which overlay sheet the seller has open while broadcasting. */
  const [panel, setPanel] = useState<'chat' | 'products' | null>('chat');
  /** Live remote-participant count, fed by HostPreview off the LiveKit room. */
  const [viewerCount, setViewerCount] = useState(0);

  const firestore = useFirestore();
  // The seller's own session document (id === sellerId): source of truth for
  // the pinned product. Reactive, so the shelf's highlight follows pin/unpin.
  const mySessionRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid || phase !== 'live') return null;
    return doc(firestore, 'liveSessions', user.uid);
  }, [firestore, user?.uid, phase]);
  const { data: mySession } = useDoc<LiveSession>(mySessionRef);
  const pinnedProductId = mySession?.pinnedProductId ?? null;

  /**
   * Pin/unpin write straight to the seller's own session document. Firestore
   * rules already allow exactly this (`liveSessions` — owner or admin write),
   * and the buyer watch page subscribes to that document, so a pin appears on
   * every viewer's screen with no refresh.
   */
  const pinProduct = useCallback(async (product: Product) => {
    if (!firestore || !user?.uid) return;
    try {
      await setDoc(
        doc(firestore, 'liveSessions', user.uid),
        { pinnedProductId: product.id },
        { merge: true },
      );
      toast({ title: 'Product pinned', description: `${product.name} is now on screen for buyers.` });
    } catch {
      toast({ variant: 'destructive', title: 'Could not pin product.' });
    }
  }, [firestore, user?.uid, toast]);

  const unpinProduct = useCallback(async () => {
    if (!firestore || !user?.uid) return;
    try {
      await setDoc(
        doc(firestore, 'liveSessions', user.uid),
        { pinnedProductId: null },
        { merge: true },
      );
      toast({ title: 'Product unpinned', description: 'The pinned card is off buyers\u2019 screens.' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not unpin product.' });
    }
  }, [firestore, user?.uid, toast]);

  /** Idle preview: request the camera so the seller can check the shot. */
  useEffect(() => {
    if (phase !== 'idle') return;
    let stream: MediaStream | null = null;
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setCameraDenied(false);
        if (previewRef.current) {
          previewRef.current.srcObject = stream;
          previewRef.current.play().catch(() => undefined);
        }
      } catch {
        setCameraDenied(true);
      }
    })();

    return () => {
      stream?.getTracks().forEach((track) => track.stop());
      if (previewRef.current) previewRef.current.srcObject = null;
    };
  }, [phase]);

  const goLive = useCallback(async () => {
    if (!user) return;
    setPhase('starting');
    // Release the idle preview so the LiveKit Room owns the camera from here on.
    if (previewRef.current?.srcObject) {
      (previewRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      previewRef.current.srcObject = null;
    }

    try {
      const res = await fetch('/api/live-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || undefined, status: 'live' }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Config problems light up the persistent "Setup required" box; every
        // other failure (points, conflict) just toasts, as before.
        if (data?.error === 'CONFIG_MISSING') {
          setTokenError(data.message || 'Live streaming is not configured on this server.');
        }
        throw new Error(data.message || data.error || 'Could not start the broadcast.');
      }

      if (data?.alreadyLive) {
        // Resume, not rejection: an active session still owns this account.
        setAlreadyLive({
          title: typeof data.title === 'string' ? data.title : '',
          remainingMs: typeof data.remainingMs === 'number' ? data.remainingMs : 0,
        });
        setPhase('idle');
        toast({
          title: 'You are already live',
          description: 'Your broadcast is still running — open it or start fresh below.',
        });
        return;
      }

      // The server answers on whichever transport it can actually run:
      // LiveKit (preferred) or VideoSDK (fallback). Anything else means no
      // broadcast was started — surface that instead of half-mounting a stage.
      if (data.provider === 'livekit') {
        if (!data.livekitRoomName || !data.token || !data.wsUrl) {
          throw new Error('The server did not return LiveKit connection details. The broadcast was not started.');
        }
        setSession({ provider: 'livekit', wsUrl: data.wsUrl, roomName: data.livekitRoomName, token: data.token });
      } else if (data.provider === 'videosdk') {
        if (!data.videosdkMeetingId || !data.token) {
          throw new Error('The server did not return VideoSDK connection details. The broadcast was not started.');
        }
        setSession({ provider: 'videosdk', meetingId: data.videosdkMeetingId, token: data.token });
      } else {
        throw new Error('The server did not return a usable transport. The broadcast was not started.');
      }
      setTokenError(null);
      setAlreadyLive(null);
      setPhase('live');
      toast({ title: 'You are live', description: 'Buyers can now watch you in VIDNOV LIVE.' });
    } catch (error) {
      setPhase('idle');
      toast({
        variant: 'destructive',
        title: 'Could not go live',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  }, [user, title, toast]);

  const endLive = useCallback(async () => {
    if (user) {
      try {
        await fetch('/api/live-session', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ liveSessionId: user.uid }),
        });
      } catch {
        // the session still ends locally
      }
    }
    setPhase('idle');
    setSession(null);
    toast({ title: 'Broadcast ended', description: 'Your camera and microphone are off.' });
  }, [user, toast]);

  /*
   * The 70-minute cap on a paid live session.
   *
   * A countdown the seller can SEE, because a stream that silently dies at
   * the end with no warning reads as a crash and loses them the sale they were
   * mid-way through. The last 20 seconds turn red so "wrap it up" arrives
   * before the cut rather than with it.
   *
   * Client-side on purpose: it is instant, needs no server round-trip, and the
   * seller controls it. It is not a guarantee — a seller who closes the tab
   * keeps broadcasting until the server notices — which is why the server-side
   * watchdog in `lib/live/service.ts` also enforces the same ceiling.
   */
  const [secondsLeft, setSecondsLeft] = React.useState(MAX_LIVE_SECONDS);
  const endedRef = React.useRef(false);

  React.useEffect(() => {
    if (phase !== 'live') return;
    endedRef.current = false;
    setSecondsLeft(MAX_LIVE_SECONDS);

    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (!endedRef.current) {
            endedRef.current = true;
            void endLive();
            toast({
              title: 'Broadcast complete',
              description: 'That was your 70 minutes. Go live again any time.',
            });
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [phase, endLive, toast]);

  const copyLink = useCallback(async () => {
    if (!user) return;
    const link = `${window.location.origin}${viewerBasePath}/${user.uid}`;
    await navigator.clipboard?.writeText(link);
    toast({ title: 'Link copied', description: 'Share your live link to bring viewers in.' });
  }, [user, toast, viewerBasePath]);

  /** End the old session (idempotent server-side) so Go live can start fresh. */
  const endAndRestart = useCallback(async () => {
    await endLive();
    setAlreadyLive(null);
    toast({
      title: 'Old broadcast ended',
      description: 'Tap Go live now to start a fresh session.',
    });
  }, [endLive, toast]);

  /* ------------------------------ live ------------------------------ */
  if (phase === 'live' && session) {
    const urgent = secondsLeft <= 20;
    const sellerName = userProfile?.shopName || userProfile?.fullName || 'Seller';
    return (
      <div className="relative h-full w-full overflow-hidden bg-black">
        {session.provider === 'livekit' ? (
          <HostPreview
            wsUrl={session.wsUrl}
            roomName={session.roomName}
            token={session.token}
            participantName={sellerName}
            onEnd={endLive}
            onViewerCount={setViewerCount}
          />
        ) : (
          <VideosdkHostPreview
            meetingId={session.meetingId}
            token={session.token}
            participantName={sellerName}
            onEnd={endLive}
          />
        )}

        {/* Session clock + live audience, always visible over the camera. */}
        <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2">
          <span
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-black tabular-nums backdrop-blur-md',
              urgent ? 'bg-red-500/90 text-white' : 'bg-black/60 text-white',
            )}
            role="timer"
            aria-live="off"
          >
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
            {urgent && <span className="ml-1.5 text-[10px] uppercase tracking-widest">wrap up</span>}
          </span>
          {/* Viewer count comes from the LiveKit room; the VideoSDK fallback
              has no participant feed, so the badge is shown only when real
              numbers exist rather than a false zero. */}
          {session.provider === 'livekit' && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md"
              title="Viewers watching now"
            >
              <Users className="h-3.5 w-3.5" />
              {viewerCount}
            </span>
          )}
        </div>

        {/* Stage controls sit above the camera/mic/end bar so nothing is covered. */}
        {!panel && (
          <div className="absolute bottom-24 right-3 z-40 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => setPanel('chat')}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition hover:bg-black/80"
              aria-label="Open live comments"
            >
              <MessageSquare className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setPanel('products')}
              className="relative flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition hover:bg-black/80"
              aria-label="Open product shelf"
            >
              <ShoppingBag className="h-5 w-5" />
              {pinnedProductId && (
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-black bg-green-500" />
              )}
            </button>
          </div>
        )}

        {/*
          The comments + product shelf sheet. Opens on COMMENTS the moment the
          seller goes live — the stage is a working broadcast desk, never a
          blank camera. The bottom controls stay visible below the sheet, and
          the sheet never traps the seller (X always closes it).
        */}
        {panel && user && (
          <div className="absolute inset-x-0 bottom-24 z-30 flex h-[52%] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-neutral-950/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPanel('chat')}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition',
                    panel === 'chat'
                      ? 'bg-white text-black'
                      : 'bg-white/10 text-white/60 hover:bg-white/15',
                  )}
                >
                  Comments
                </button>
                <button
                  type="button"
                  onClick={() => setPanel('products')}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition',
                    panel === 'products'
                      ? 'bg-white text-black'
                      : 'bg-white/10 text-white/60 hover:bg-white/15',
                  )}
                >
                  Products
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPanel(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1">
              {panel === 'chat' ? (
                /* The exact chat the buyer watch page reads and writes. */
                <LiveChat streamId={user.uid} />
              ) : (
                /* Pinning writes liveSessions/{sellerId}.pinnedProductId — buyers see it instantly. */
                <LiveProductShelf
                  sellerId={user.uid}
                  pinnedProductId={pinnedProductId}
                  onPinProduct={pinProduct}
                  onUnpinProduct={unpinProduct}
                />
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------ idle ------------------------------ */
  return (
    <div className="relative h-full min-h-[calc(100vh-4rem)] w-full overflow-hidden bg-black">
      <video
        ref={previewRef}
        autoPlay
        muted
        playsInline
        className={cn(
          'absolute inset-0 h-full w-full object-cover transition-all duration-700',
          cameraDenied ? 'opacity-10 blur-xl grayscale' : 'opacity-40',
        )}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/70" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-8 px-6 py-10 text-center">
        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] text-primary">
            <Radio className="h-3.5 w-3.5" /> Vidnov Live
          </p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white md:text-5xl">
            {title.trim() || 'Your broadcast preview'}
          </h1>
          <p className="mx-auto max-w-md text-sm text-white/50">
            {cameraDenied
              ? 'Allow camera and microphone access in your browser to go live.'
              : 'This preview is private — buyers only see it once you are live.'}
          </p>
        </div>

        {alreadyLive ? (
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-left">
            <p className="text-xs font-black uppercase tracking-widest text-red-400">
              You&rsquo;re already live
            </p>
            <p className="mt-1.5 text-sm text-white/70">
              {alreadyLive.title ? (
                <>
                  Your broadcast <span className="text-white">&ldquo;{alreadyLive.title}&rdquo;</span> is
                  still running
                </>
              ) : (
                'Your broadcast is still running'
              )}
              {alreadyLive.remainingMs > 0 && (
                <>
                  {' '}— about{' '}
                  <span className="text-white">
                    {Math.max(1, Math.round(alreadyLive.remainingMs / 60000))} minutes
                  </span>{' '}
                  left on this session
                </>
              )}
              . Buyers can watch it right now, and nothing was charged for this tap.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                asChild
                className="h-11 rounded-xl bg-red-600 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-red-600/20 hover:bg-red-700"
              >
                <a href={`${viewerBasePath}/${user?.uid ?? ''}`} target="_blank" rel="noreferrer">
                  Open my live stream
                </a>
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-xl border-white/15 bg-white/5 text-xs font-bold uppercase tracking-wide text-white hover:bg-white/10"
                onClick={endAndRestart}
              >
                End broadcast &amp; start fresh
              </Button>
              <Button
                variant="ghost"
                className="h-11 text-xs font-bold uppercase tracking-wide text-white/50 hover:text-white/80"
                onClick={() => setAlreadyLive(null)}
              >
                Not now
              </Button>
            </div>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-white/30">
              Starting fresh begins a new {SESSION_COST}-point session — this one is never charged twice
            </p>
          </div>
        ) : tokenError ? (
          <div className="max-w-md rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-left">
            <p className="text-xs font-black uppercase tracking-widest text-amber-300">Setup required</p>
            <p className="mt-1.5 text-sm text-white/70">{tokenError}</p>
            <Button variant="outline" className="mt-4 border-white/15 text-white" onClick={() => setTokenError(null)}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-sm space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Show title (optional)"
              maxLength={80}
              className="h-12 rounded-xl border-white/10 bg-black/50 text-white placeholder:text-white/35"
            />

            <Button
              size="lg"
              onClick={goLive}
              disabled={!canStart || isProfileLoading || phase === 'starting'}
              className="h-14 w-full rounded-xl bg-red-600 text-sm font-black uppercase tracking-wide text-white shadow-xl shadow-red-600/30 hover:bg-red-700"
            >
              {phase === 'starting' ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Camera className="mr-2 h-5 w-5" />
              )}
              {phase === 'starting' ? 'Going live…' : 'Go live now'}
            </Button>

            <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
              <BadgeCent className="h-3.5 w-3.5" />
              {SESSION_COST} points · balance {points.toLocaleString()}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="h-11 flex-1 rounded-xl border-white/15 bg-white/5 text-xs font-bold uppercase tracking-wide text-white hover:bg-white/10"
                onClick={copyLink}
              >
                <Share2 className="mr-2 h-4 w-4" /> Copy live link
              </Button>
              <Button
                variant="outline"
                asChild
                className="h-11 rounded-xl border-white/15 bg-white/5 text-xs font-bold uppercase tracking-wide text-white hover:bg-white/10"
              >
                <Link href={backHref}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> {backLabel}
                </Link>
              </Button>
            </div>
          </div>
        )}

        {!tokenError && (
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">
            <Square className="h-3 w-3" /> 100 points per live session · camera off when you leave
          </p>
        )}
      </div>
    </div>
  );
}

export default SellerLiveStudio;