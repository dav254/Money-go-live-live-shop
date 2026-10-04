'use client';

/**
 * VIDNOV LIVE — buyer watch view (spec §22–§33).
 *
 * Joins via GET /api/live/[id] (visibility-checked, viewer token), subscribes
 * through useLiveRoom('viewer'), polls chat, and links out to the existing
 * Vidnov commerce surfaces: /products/[id], /messages, /requests/new.
 * LiveKit stays invisible — the buyer only ever sees Vidnov UI.
 */

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { publicOrigin } from '@/lib/site-url';
import { useUser, useFirestore } from '@/firebase';
import { collection, doc, getDoc, getDocs, query, where, setDoc, serverTimestamp } from 'firebase/firestore';
import type { LiveStream } from '@/lib/live/types';
import { LIVE_REPORT_REASONS } from '@/lib/live/types';
import dynamic from 'next/dynamic';
import { useLiveRoom } from '@/components/live/use-live-room';

// The VideoSDK browser SDK must never run during SSR.
const VideoSDKViewer = dynamic(() => import('@/components/buyer/VideoSDKViewer'), {
  ssr: false,
});
import { LiveChatPanel } from '@/components/live/live-chat-panel';
import {
  Radio, Eye, Loader2, ArrowLeft, MessageSquare, Share2, Flag,
  ShoppingBag, WifiOff, XCircle, UserPlus, UserCheck,
} from 'lucide-react';

export default function LiveWatchPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const live = useLiveRoom('viewer', videoRef);
  // VideoSDK transport (used when LiveKit is not configured).
  const [videoSdkMeetingId, setVideoSdkMeetingId] = React.useState<string | null>(null);

  const [stream, setStream] = React.useState<LiveStream | null>(null);
  const [error, setError] = React.useState<{ code: number; message: string } | null>(null);
  const [ended, setEnded] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [reportReason, setReportReason] = React.useState<string>('');
  const [reporting, setReporting] = React.useState(false);
  const [followed, setFollowed] = React.useState(false);
  const [messageBusy, setMessageBusy] = React.useState(false);

  // ---- Join (§22): fetch stream + viewer token, then connect ----
  React.useEffect(() => {
    if (!user || !id) return;
    let alive = true;
    void (async () => {
      try {
        const token = await (user as any).getIdToken();
        const res = await fetch(`/api/live/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!alive) return;
        if (!res.ok) {
          if (res.status === 410) {
            setStream((data.stream as LiveStream) ?? null);
            setEnded(true);
          } else {
            setError({ code: res.status, message: data.error || 'Could not open this live.' });
          }
          return;
        }
        setStream(data as LiveStream);
        if (data.provider === 'videosdk') {
          setVideoSdkMeetingId(data.meetingId);
        } else {
          await live.connect(data.wsUrl, data.token);
        }
      } catch {
        if (alive) setError({ code: 500, message: 'Could not open this live.' });
      }
    })();
    return () => {
      alive = false;
      // Announce leave so viewer count stays honest (§37).
      void (async () => {
        try {
          const t = await (user as any).getIdToken();
          await fetch(`/api/live/${id}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${t}` },
          });
        } catch {
          // best-effort
        }
      })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  // Sellers can end their own stream from here too — skip: owners use the studio.
  const isOwner = !!user && stream?.sellerId === user.uid;

  // ---- Follow (§27): uses the existing /api/follow system ----
  const toggleFollow = async () => {
    if (!user || !stream) return;
    try {
      const token = await (user as any).getIdToken();
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId: stream.sellerId, action: followed ? 'unfollow' : 'follow' }),
      });
      if (!res.ok) throw new Error();
      setFollowed(!followed);
    } catch {
      toast({ variant: 'destructive', title: 'Could not update follow.' });
    }
  };

  // Initial follow state from the buyer's own profile.
  React.useEffect(() => {
    if (!firestore || !user || !stream) return;
    void (async () => {
      try {
        const snap = await getDoc(doc(firestore, 'userProfiles', user.uid));
        const following = (snap.data()?.following ?? []) as unknown[];
        setFollowed(following.includes(stream.sellerId));
      } catch {
        // default to not-following
      }
    })();
  }, [firestore, user, stream]);

  // ---- Message seller (§28): reuse existing chats, tag the live source ----
  const messageSeller = async () => {
    if (!user || !stream || !firestore) return;
    setMessageBusy(true);
    try {
      const chatsRef = collection(firestore, 'chats');
      const snap = await getDocs(query(chatsRef, where('participantIds', 'array-contains', user.uid)));
      let existing: string | null = null;
      snap.forEach((d) => {
        const ids: string[] = d.data().participantIds ?? [];
        if (ids.includes(stream.sellerId)) existing = d.id;
      });
      if (!existing) {
        const ref = doc(chatsRef);
        await setDoc(ref, {
          id: ref.id,
          participantIds: [user.uid, stream.sellerId],
          lastMessage: 'Conversation started from a live stream.',
          liveStreamId: stream.id,
          lastMessageTimestamp: serverTimestamp(),
        });
      }
      router.push(`/messages${existing ? `?chatWith=${stream.sellerId}` : ''}`);
    } catch {
      toast({ variant: 'destructive', title: 'Could not open messages.' });
    } finally {
      setMessageBusy(false);
    }
  };

  // ---- Share (§32): public URL vidnov.com/live/[streamId] ----
  const share = async () => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : publicOrigin()}/live/${id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: stream?.title ?? 'VIDNOV LIVE', url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied', description: 'Share this live anywhere.' });
      }
    } catch {
      // user cancelled — ignore
    }
  };

  // ---- Report (§33) ----
  const submitReport = async () => {
    if (!reportReason) return;
    setReporting(true);
    try {
      const token = await (user as any).getIdToken();
      const res = await fetch(`/api/live/${id}/report`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reportReason }),
      });
      if (!res.ok) throw new Error();
      setReportOpen(false);
      setReportReason('');
      toast({ title: 'Report sent', description: 'Our moderation team will review it.' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not send report.' });
    } finally {
      setReporting(false);
    }
  };

  /* ---------------- Error / ended states ---------------- */
  if (error) {
    return (
      <BuyerLayout>
        <div className="mx-auto max-w-md space-y-4 p-6 py-24 text-center vn-page-enter">
          <XCircle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="font-grotesk text-2xl font-bold text-foreground">{error.message}</h1>
          <Button onClick={() => router.push('/live')} className="rounded-xl px-8 font-bold uppercase tracking-widest">
            Back to LIVE
          </Button>
        </div>
      </BuyerLayout>
    );
  }

  if (ended || (stream && stream.status !== 'LIVE' && stream.status !== 'STARTING')) {
    return (
      <BuyerLayout>
        <div className="mx-auto max-w-md space-y-4 p-6 py-24 text-center vn-page-enter">
          <Radio className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <h1 className="font-grotesk text-2xl font-bold text-foreground">LIVE ENDED</h1>
          <p className="text-sm text-muted-foreground">
            {stream?.title ? `“${stream.title}” has finished.` : 'This stream is over.'}
          </p>
          <Button onClick={() => router.push('/live')} className="rounded-xl px-8 font-bold uppercase tracking-widest">
            Discover more lives
          </Button>
        </div>
      </BuyerLayout>
    );
  }

  /* ---------------- Loading ---------------- */
  if (!stream) {
    return (
      <BuyerLayout>
        <div className="flex items-center justify-center gap-2 p-6 py-24 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening the live room…
        </div>
      </BuyerLayout>
    );
  }

  /* ---------------- Watch view (§25) ---------------- */
  const attachedProductIds = stream.attachedProductIds ?? [];

  return (
    <BuyerLayout fullWidth>
      <div className="grid h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[1fr_340px]">
        {/* Stage */}
        <div className="relative flex flex-col bg-black">
          <div className="relative flex-1">
            {videoSdkMeetingId ? (
              <VideoSDKViewer meetingId={videoSdkMeetingId} />
            ) : (
              <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
            )}

            {/* Overlays */}
            <div className="absolute left-4 top-4 flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[10px] font-bold text-white backdrop-blur">
                <Eye className="h-3 w-3" /> {stream.viewerCount}
              </span>
              {live.status === 'reconnecting' && (
                <span className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[9px] font-bold uppercase text-white/80 backdrop-blur">
                  <WifiOff className="h-3 w-3" /> Reconnecting…
                </span>
              )}
            </div>
            <Link
              href="/live"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
              aria-label="Back to discovery"
            >
              <ArrowLeft className="h-4 w-4 rotate-180" />
            </Link>

            {/* Bottom info bar */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-14">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-bold uppercase tracking-widest text-white/60">
                    {stream.category || 'VIDNOV LIVE'}
                  </p>
                  <h1 className="truncate font-grotesk text-lg font-bold text-white">{stream.title}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={toggleFollow} disabled={isOwner}
                    className="h-8 rounded-full border-white/30 bg-black/40 text-white hover:bg-white/10">
                    {followed ? <UserCheck className="mr-1.5 h-3.5 w-3.5" /> : <UserPlus className="mr-1.5 h-3.5 w-3.5" />}
                    {followed ? 'Following' : 'Follow'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={messageSeller} disabled={messageBusy}
                    className="h-8 rounded-full border-white/30 bg-black/40 text-white hover:bg-white/10">
                    <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Message
                  </Button>
                  <Button size="sm" variant="outline" onClick={share}
                    className="h-8 rounded-full border-white/30 bg-black/40 text-white hover:bg-white/10">
                    <Share2 className="mr-1.5 h-3.5 w-3.5" /> Share
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setReportOpen(true)}
                    className="h-8 rounded-full border-white/30 bg-black/40 text-white hover:bg-white/10">
                    <Flag className="mr-1.5 h-3.5 w-3.5" /> Report
                  </Button>
                </div>
              </div>
            </div>

            {/* Connect state */}
            {live.status !== 'connected' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-white">
                {live.status === 'error' ? (
                  <>
                    <XCircle className="h-8 w-8 text-red-400" />
                    <p className="text-sm">{live.error || 'Connection failed.'}</p>
                    <Button size="sm" onClick={() => window.location.reload()} className="rounded-full">Retry</Button>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-xs font-bold uppercase tracking-widest">
                      {live.status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Attached product strip (§18, §29 — existing commerce) */}
          {attachedProductIds.length > 0 && (
            <div className="flex gap-3 overflow-x-auto border-t border-white/10 bg-[#0A1224] p-3">
              {attachedProductIds.map((pid) => (
                <Link key={pid} href={`/products/${pid}`}
                  className="group flex shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:border-white/30">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#FF4D2E] to-[#FF7A45] text-white">
                    <ShoppingBag className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-white/60">Featured product</span>
                    <span className="block text-sm font-bold text-white group-hover:text-primary">View & order →</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Chat rail (§26) */}
        <div className="hidden flex-col border-l border-white/10 bg-[#0A1224] lg:flex">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <MessageSquare className="h-4 w-4 text-white/60" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">Live chat</p>
          </div>
          <LiveChatPanel streamId={id} userToken={() => (user as any).getIdToken()} className="flex-1" />
        </div>

        {/* Report dialog (§33) */}
        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Report this live</DialogTitle>
              <DialogDescription>
                Tell us what's wrong — our moderation team reviews every report.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {LIVE_REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReportReason(r)}
                  className={cn(
                    'w-full rounded-xl border p-3 text-left text-sm vn-transition',
                    reportReason === r ? 'border-primary bg-primary/5 font-semibold' : 'border-border hover:border-foreground/30',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={submitReport} disabled={!reportReason || reporting}>
                {reporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Flag className="mr-2 h-4 w-4" />}
                Send report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </BuyerLayout>
  );
}
