'use client';

/**
 * DISCOVERY — the Live lane.
 *
 * Only genuinely live things appear here. The data comes from
 * `GET /api/live?scope=active`, the same bearer-authed endpoint the website's
 * live grid and the buyer app's live screen already call — so this lane cannot
 * drift out of agreement with the rest of Vidnov, and an ended or offline
 * session drops out the moment the service says so.
 *
 * Nothing here labels an uploaded video as live. An ordinary product video is
 * a product video, and the only red dot on this screen belongs to a session
 * that is actually broadcasting.
 */

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Eye, Loader2, Radio, UserRound } from 'lucide-react';

import { useUser } from '@/firebase';

export interface DiscoveryLiveCard {
  id: string;
  title: string;
  status: string;
  thumbnailUrl?: string | null;
  businessName?: string | null;
  category?: string | null;
  location?: string | null;
  viewerCount: number;
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center">
      {children}
    </div>
  );
}

export function DiscoveryLiveLane() {
  const { user } = useUser();
  const [streams, setStreams] = React.useState<DiscoveryLiveCard[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (!user) {
      setStreams(null);
      return;
    }
    let alive = true;

    void (async () => {
      try {
        const token = await (user as unknown as { getIdToken: () => Promise<string> }).getIdToken();
        const res = await fetch('/api/live?scope=active', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error((await res.json().catch(() => ({}))).error || 'Could not load live streams.');
        }
        const data = await res.json();
        if (!alive) return;
        setStreams(data.streams ?? []);
        setFailed(false);
      } catch {
        if (!alive) return;
        setStreams([]);
        setFailed(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user, attempt]);

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <Panel>
          <Radio className="mx-auto h-6 w-6 text-white/50" aria-hidden />
          <p className="font-grotesk mt-3 text-[15px] font-bold text-white">Live shopping needs an account</p>
          <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-white/55">
            Sign in to watch businesses broadcast, chat and order in the moment.
          </p>
          <Link
            href="/login?returnTo=%2Fbuyer%2Fdiscovery"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-[color:var(--vn-discovery-accent)] px-5 text-[11px] font-bold uppercase tracking-wider text-[#0A0A0A]"
          >
            <UserRound className="h-3.5 w-3.5" />
            Sign in
          </Link>
        </Panel>
      </div>
    );
  }

  if (streams === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4">
        <Loader2 className="h-6 w-6 animate-spin text-[color:var(--vn-discovery-accent)]" />
        <p className="text-[11px] uppercase tracking-[0.25em] text-white/55">Finding live streams</p>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <Panel>
          <p className="font-grotesk text-[15px] font-bold text-white">Live is unavailable right now</p>
          <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-white/55">
            Your connection may have dropped. Nothing is broken — try again.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-[color:var(--vn-discovery-accent)] px-5 text-[11px] font-bold uppercase tracking-wider text-[#0A0A0A]"
          >
            Retry
          </button>
        </Panel>
      </div>
    );
  }

  if (streams.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <Panel>
          <Radio className="mx-auto h-6 w-6 text-white/50" aria-hidden />
          <p className="font-grotesk mt-3 text-[15px] font-bold text-white">Nobody is live at the moment</p>
          <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-white/55">
            When a business starts broadcasting it appears here instantly. Browse everything else in
            the meantime.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <section className="h-full overflow-y-auto px-4 py-4 sm:px-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 items-center gap-1.5 rounded-full bg-red-600 px-2.5 text-[9px] font-black uppercase tracking-[0.18em] text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden />
          Live
        </span>
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">
          {streams.length} broadcasting now
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {streams.map((stream) => (
          <Link
            key={stream.id}
            href={`/live/${stream.id}`}
            className="vn-discovery-card group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--vn-discovery-accent)]"
          >
            <div className="relative aspect-video w-full overflow-hidden bg-white/10">
              {stream.thumbnailUrl ? (
                <Image
                  src={stream.thumbnailUrl}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Radio className="h-10 w-10 text-white/20" aria-hidden />
                </div>
              )}

              <span className="absolute left-3 top-3 flex h-5 items-center gap-1.5 rounded-full bg-red-600 px-2 text-[9px] font-black uppercase tracking-[0.18em] text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden />
                Live
              </span>

              <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold tabular-nums text-white backdrop-blur">
                <Eye className="h-3 w-3" aria-hidden />
                {stream.viewerCount ?? 0}
              </span>
            </div>

            <div className="space-y-1.5 p-3">
              <p className="font-grotesk line-clamp-2 text-[14px] font-bold leading-snug text-white">
                {stream.title}
              </p>
              <p className="flex items-center justify-between gap-2 text-[11px] text-white/55">
                <span className="truncate">
                  {stream.businessName || 'Vidnov business'}
                  {stream.location ? ` · ${stream.location}` : ''}
                </span>
                <span className="flex shrink-0 items-center gap-1 font-bold uppercase tracking-wider text-[color:var(--vn-discovery-accent)]">
                  Watch
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
