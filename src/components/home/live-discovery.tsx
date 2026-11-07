'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, CirclePlay, Radio, Sparkles, Video } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * LIVE + VIDEO DISCOVERY STRIP.
 *
 * Reads `/api/home/live` — the existing public route that queries the VPS store
 * first and Firestore second. Nothing is synthesised: when no verified seller
 * is broadcasting, the section says so and explains how to go live instead of
 * showing a fake room.
 *
 * The watch link is the public `/live/[id]` route, and the seller routes are the
 * studio surfaces that already exist.
 */

interface Room {
  id: string;
  sellerId: string;
  title: string;
  viewerCount: number;
}

export function LiveDiscovery() {
  const [rooms, setRooms] = React.useState<Room[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/api/home/live', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const payload = (await response.json()) as { rooms?: Room[] };
        if (cancelled) return;
        setRooms(
          (Array.isArray(payload.rooms) ? payload.rooms : []).filter(
            (room) => room && typeof room.id === 'string' && room.id.length > 0,
          ),
        );
      } catch {
        if (!cancelled && !controller.signal.aborted) setFailed(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  if (rooms === null && !failed) {
    return (
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
            <Skeleton className="h-32 w-full rounded-2xl bg-white/10" />
            <Skeleton className="mt-4 h-4 w-3/4 rounded bg-white/10" />
            <Skeleton className="mt-2 h-3 w-1/3 rounded bg-white/10" />
          </div>
        ))}
      </div>
    );
  }

  if (!rooms || rooms.length === 0) {
    return (
      <div className="mt-10 overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.04]">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#FF4D2E]/30 bg-[#FF4D2E]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-[#FFB9A8]">
              <Radio className="h-3 w-3" />
              {failed ? 'Live status unavailable' : 'No one is live right now'}
            </p>
            <h3 className="mt-4 font-grotesk text-2xl font-black tracking-[-0.03em] text-white sm:text-3xl">
              The live floor opens the moment a seller goes on air.
            </h3>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
              Live rooms are created by verified sellers from the live feed studio
              inside their dashboard — product demos, drops and Q&amp;A. Nothing is
              staged here: this space stays empty until a real session starts.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard/seller/live-feed"
                className="inline-flex items-center gap-2 rounded-full bg-[#FF4D2E] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#e63f21]"
              >
                Start a live session
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/dashboard/seller/video-studio"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold text-white/80 transition-colors hover:border-white/40 hover:text-white"
              >
                <Video className="h-3.5 w-3.5" />
                Record a product video
              </Link>
            </div>
          </div>

          <ul className="grid gap-3 text-sm text-white/70">
            {[
              { icon: CirclePlay, title: 'Go live from your dashboard', text: 'Start a room, add products and talk to buyers in real time.' },
              { icon: Sparkles, title: 'Publish product videos', text: 'Record demos in the video studio and attach them to your listings.' },
              { icon: Radio, title: 'Appear in discovery', text: 'Live sessions and published videos surface on Vidnov discovery.' },
            ].map((item) => (
              <li
                key={item.title}
                className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-[#FF4D2E]" aria-hidden />
                <div>
                  <p className="text-xs font-bold text-white">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/55">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rooms.map((room) => (
          <Link
            key={room.id}
            href={`/live/${room.id}`}
            className="group relative w-[78%] shrink-0 snap-start overflow-hidden rounded-[24px] border border-white/10 bg-[#101013] transition-colors hover:border-[#FF4D2E]/50 sm:w-[300px]"
          >
            <div className="relative flex h-36 items-end bg-[radial-gradient(circle_at_30%_20%,rgba(255,77,46,0.35),transparent_60%),linear-gradient(160deg,#17171b,#0b0b0d)] p-4">
              <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-[#FF4D2E] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                Live
              </span>
              <CirclePlay className="absolute right-4 top-4 h-5 w-5 text-white/50 transition-colors group-hover:text-white" />
              <p className="line-clamp-2 font-grotesk text-lg font-bold leading-snug text-white">
                {room.title?.trim() || 'Live session'}
              </p>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
              <span className="text-[11px] text-white/50">
                {room.viewerCount > 0
                  ? `${room.viewerCount} watching`
                  : 'Just started'}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FF8A76]">
                Watch
                <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-4">
        <Link
          href="/live"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/60 transition-colors hover:text-white"
        >
          Explore every live room
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
