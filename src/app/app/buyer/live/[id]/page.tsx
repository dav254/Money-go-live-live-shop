'use client';

/**
 * BUYER APP · LIVE WATCH — the room, natively.
 *
 * ## Why this exists
 *
 * The buyer sidebar now has a Live destination. The obvious implementation is
 * to point it at the website's `/live`, and that is exactly what this section
 * must not do: the first tap would leave the installed app for the website's
 * desktop `BuyerLayout`, and every "back" from there lands in the wrong shell.
 * So the sidebar links to `/app/buyer/live`, and this is its watch screen.
 *
 * ## What is reused
 *
 * The transport and the social layer, both of which are already surface-agnostic:
 *
 *   • `GET /api/live/[id]` — visibility-checked, returns a viewer token. The
 *     same endpoint the website's watch page calls.
 *   • `useLiveRoom('viewer')` — the LiveKit client wrapper. It owns transport,
 *     reconnection and track attachment; it knows nothing about Vidnov routes.
 *   • `VideoSDKViewer` — the fallback transport when LiveKit is not configured.
 *   • `LiveChatPanel` — chat over the existing live-chat endpoint.
 *
 * None of those is a link to a website route; they are API calls and shared
 * components. That distinction is the whole point.
 *
 * ## What is deliberately absent
 *
 * The website watch page carries follow, report and an attached-products rail,
 * and those link to `/products/[id]`, `/messages` and `/requests/new` — website
 * routes. Cloning them here would have put three exits back inside the screen
 * this work exists to close, so the app screen is watch + chat + leave, which
 * is the part a buyer can complete without leaving. The commerce actions belong
 * in this section too, but as this section's own screens, not as links out.
 *
 * ## Immersive
 *
 * This route is in `IMMERSIVE_ROUTES` (by prefix — the id is dynamic). The stage
 * is the screen, so the h-12 bar keeps only the menu and back buttons, and the
 * menu matters more here than anywhere else in the section: without it this
 * would have no way out at all.
 */

import * as React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Eye, Loader2, MessageSquare, Radio, WifiOff,
} from 'lucide-react';
import { useUser } from '@/firebase';
import { useLiveRoom } from '@/components/live/use-live-room';
import { LiveChatPanel } from '@/components/live/live-chat-panel';
import type { LiveStream } from '@/lib/live/types';

// The VideoSDK browser SDK must never run during SSR.
const VideoSDKViewer = dynamic(() => import('@/components/buyer/VideoSDKViewer'), {
  ssr: false,
});

export default function BuyerSectionLiveWatch() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const { user } = useUser();

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const live = useLiveRoom('viewer', videoRef);

  const [videoSdkMeetingId, setVideoSdkMeetingId] = React.useState<string | null>(null);
  const [stream, setStream] = React.useState<LiveStream | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [ended, setEnded] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);

  // The chat panel asks for a fresh token on its own schedule rather than
  // receiving one, so the token is re-read per call and never goes stale.
  const userToken = React.useCallback(async () => {
    if (!user) throw new Error('Not signed in');
    return (user as unknown as { getIdToken: () => Promise<string> }).getIdToken();
  }, [user]);

  // ---- Join: fetch the stream + viewer token, then connect ----
  React.useEffect(() => {
    if (!user || !id) return;
    let alive = true;

    void (async () => {
      try {
        const token = await userToken();
        const res = await fetch(`/api/live/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!alive) return;

        if (!res.ok) {
          // 410 is a stream that has finished, not a failure: the stream body
          // still comes back so the buyer sees what they were watching.
          if (res.status === 410) {
            setStream((data.stream as LiveStream) ?? null);
            setEnded(true);
          } else {
            setError(data.error || 'Could not open this live.');
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
        if (alive) setError('Could not open this live.');
      }
    })();

    return () => {
      alive = false;
      // Announce the leave so the viewer count stays honest for everyone else.
      void (async () => {
        try {
          const t = await userToken();
          await fetch(`/api/live/${id}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${t}` },
          });
        } catch {
          // best-effort: the count self-corrects when the room expires
        }
      })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  /* ---------------- Ended ---------------- */
  if (ended) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-4 px-6 text-center">
        <Radio className="h-9 w-9 text-white/20" />
        <h1 className="font-grotesk text-2xl font-bold text-foreground">Live ended</h1>
        <p className="font-sans text-sm text-muted-foreground">
          {stream?.title ? `“${stream.title}” has finished.` : 'This stream is over.'}
        </p>
        <Link
          href="/app/buyer/live"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-2.5 font-sans text-xs font-bold uppercase tracking-widest text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Find another live
        </Link>
      </div>
    );
  }

  /* ---------------- Error ---------------- */
  if (error) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-4 px-6 text-center">
        <Radio className="h-9 w-9 text-red-400/60" />
        <h1 className="font-grotesk text-2xl font-bold text-foreground">Cannot join</h1>
        <p className="font-sans text-sm text-muted-foreground">{error}</p>
        <Link
          href="/app/buyer/live"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-2.5 font-sans text-xs font-bold uppercase tracking-widest text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to live
        </Link>
      </div>
    );
  }

  /* ---------------- Loading ---------------- */
  if (!stream) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center gap-2 font-sans text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
        Opening the live room…
      </div>
    );
  }

  /* ---------------- Watch ---------------- */
  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-black">
      {/* Stage */}
      <div className="relative min-h-0 flex-1">
        {videoSdkMeetingId ? (
          <VideoSDKViewer meetingId={videoSdkMeetingId} />
        ) : (
          <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
        )}

        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 font-sans text-[9px] font-black uppercase tracking-widest text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Live
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 font-sans text-[10px] font-bold text-white backdrop-blur">
            <Eye className="h-3 w-3" />
            {stream.viewerCount}
          </span>
          {live.status === 'reconnecting' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 font-sans text-[9px] font-bold uppercase text-white/80 backdrop-blur">
              <WifiOff className="h-3 w-3" />
              Reconnecting
            </span>
          )}
        </div>

        {/* Chat toggle. Present on the stage rather than in the header because
            the header is 3rem tall and this screen cannot spare it. */}
        <button
          type="button"
          onClick={() => setChatOpen((v) => !v)}
          aria-label={chatOpen ? 'Hide chat' : 'Show chat'}
          aria-pressed={chatOpen}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
        >
          <MessageSquare className="h-4 w-4" />
        </button>

        <Link
          href="/app/buyer/live"
          aria-label="Back to live discovery"
          className="absolute right-3 top-14 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        {/* Bottom info bar */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 pb-4 pt-14">
          <p className="vn-micro text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">
            {stream.category || 'Vidnov Live'}
          </p>
          <h1 className="mt-1 font-grotesk text-lg font-bold leading-snug text-white">
            {stream.title}
          </h1>
        </div>
      </div>

      {/* Chat. Docked rather than overlaid so typing does not cover the stage,
          and collapsible because watching is the primary job. */}
      {chatOpen && (
        <div className="h-[42vh] shrink-0 border-t border-white/10 bg-[#0A1224]">
          <LiveChatPanel streamId={stream.id} userToken={userToken} className="h-full" />
        </div>
      )}
    </div>
  );
}