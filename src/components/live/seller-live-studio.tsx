'use client';

/**
 * SELLER LIVE STUDIO — the only seller-facing live surface.
 *
 * One section, one job: preview your camera and go live. No setup form, no
 * product shelf, no chat rail, no analytics — buyers get all of that on the
 * viewer side. While you are live you see your own preview; nobody else does.
 *
 * Transport: LiveKit. POST /api/live-session authenticates the seller, charges
 * the session, mints a server-side broadcaster token and returns the room name
 * + websocket URL in one response, so the API secret never reaches the
 * browser.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser, useUserProfile } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, BadgeCent, Camera, Loader2, Radio, Share2, Square } from 'lucide-react';
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
  const [session, setSession] = useState<{ wsUrl: string; roomName: string; token: string } | null>(null);
  const [cameraDenied, setCameraDenied] = useState(false);

  const points = userProfile?.aiPoints ?? 0;
  const canStart = points >= SESSION_COST && !cameraDenied;

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
      if (data.provider !== 'livekit' || !data.livekitRoomName || !data.token || !data.wsUrl) {
        throw new Error('The server did not return LiveKit connection details. The broadcast was not started.');
      }

      setSession({ wsUrl: data.wsUrl, roomName: data.livekitRoomName, token: data.token });
      setTokenError(null);
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

  /* ------------------------------ live ------------------------------ */
  if (phase === 'live' && session) {
    const urgent = secondsLeft <= 20;
    return (
      <div className="relative h-full w-full overflow-hidden bg-black">
        <HostPreview
          wsUrl={session.wsUrl}
          roomName={session.roomName}
          token={session.token}
          participantName={userProfile?.shopName || userProfile?.fullName || 'Seller'}
          onEnd={endLive}
        />
        {/* Always visible, so the seller is never surprised by the cut. */}
        <div
          className={cn(
            'pointer-events-none absolute left-3 top-3 z-20 rounded-full px-3 py-1.5 text-xs font-black tabular-nums backdrop-blur-md',
            urgent ? 'bg-red-500/90 text-white' : 'bg-black/60 text-white',
          )}
          role="timer"
          aria-live="off"
        >
          {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          {urgent && <span className="ml-1.5 text-[10px] uppercase tracking-widest">wrap up</span>}
        </div>
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

        {tokenError ? (
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