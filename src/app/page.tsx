'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, CirclePlay, Flame, Radio, ShieldCheck, Sparkles, Star, TrendingUp, Users, Eye } from 'lucide-react';

import { useEffect, useState } from 'react';
import { LandingLayout } from '@/components/layout/landing-layout';
import { Button } from '@/components/ui/button';

/** A seller's room on the live strip — real (on air now) or a demo tile. */
type LiveRoom = {
  /** Firestore doc id — the list key. Unique, unlike the sellerId field. */
  id: string;
  sellerId: string;
  title: string;
  viewerCount: number;
  /** Demo tiles carry real imagery; live tiles use the brand gradient. */
  image?: string;
};

/**
 * Demo rooms for the on-air strip — the landing page must never look empty.
 * These are clearly tagged "Sample room" (they link to Discovery, they do
 * not pretend to be broadcasting) and only render when NO seller is live.
 * Imagery follows the same Unsplash CDN pattern the rest of the page uses.
 */
const DEMO_ROOMS: LiveRoom[] = [
  {
    id: 'demo-fashion',
    sellerId: 'demo-fashion',
    title: 'Nairobi Streetwear Drop',
    viewerCount: 214,
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'demo-creator',
    sellerId: 'demo-creator',
    title: 'Beauty & Creator Picks',
    viewerCount: 168,
    image: 'https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'demo-collector',
    sellerId: 'demo-collector',
    title: 'Watch Collector Hour',
    viewerCount: 96,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'demo-luxury',
    sellerId: 'demo-luxury',
    title: 'Private Luxury Closet',
    viewerCount: 331,
    image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=600&q=80',
  },
];

/**
 * Real live rooms — served by GET /api/home/live, which reads the VPS store
 * first and Firestore second, so the landing page never depends on the
 * visitor's browser being able to reach Firebase (a blocked Firestore used to
 * hang or empty this strip). The endpoint de-duplicates to one tile per
 * seller and answers `[]` on any failure, which renders the designed
 * "floor is quiet" state — never a broken section. Refreshed every 30s so a
 * newly on-air seller shows up without a reload.
 */
function useLiveNow(count = 6) {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/home/live`, { cache: 'no-store' });
        if (!res.ok) throw new Error('live strip failed');
        const data = (await res.json()) as {
          rooms?: Array<{ id: string; sellerId: string; title: string; viewerCount: number }>;
        };
        if (cancelled) return;
        setRooms((data.rooms ?? []).slice(0, count));
      } catch {
        if (!cancelled) setRooms([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [count]);

  return { rooms, isLoading };
}

const featurePills = ['Live drops', 'Luxury goods', 'Creator brands', 'Private access'];

const livePeople = [
  { name: 'Ava', tone: 'bg-[#ff5a36]' },
  { name: 'Leo', tone: 'bg-[#f4d8b2]' },
  { name: 'Mia', tone: 'bg-[#ffb6a3]' },
  { name: 'Kai', tone: 'bg-[#d9d9d9]' },
];

const stats = [
  { value: '12.4k', label: 'Watching live' },
  { value: '+28%', label: 'Conversion lift' },
  { value: '9m 42s', label: 'Avg. watch time' },
];

const cards = [
  {
    title: 'Luxury drops',
    text: 'Limited-run product moments designed to feel rare, premium, and impossible to pass by.',
    icon: Flame,
  },
  {
    title: 'Creator-led sales',
    text: 'Trust is built through live product energy, direct storytelling, and real-time buyer reactions.',
    icon: Users,
  },
  {
    title: 'Live commerce engine',
    text: 'Short-form demand, instant intent, and premium storytelling in a single seamless flow.',
    icon: TrendingUp,
  },
];

/**
 * Intro video (spec §B5). The ONLY video URL allowed here is the configured
 * NEXT_PUBLIC_VIDNOV_INTRO_VIDEO_URL — nothing is invented. When it is unset
 * or fails to load, the section falls back to its poster image and the rest
 * of the homepage is untouched.
 */
const INTRO_VIDEO_URL = process.env.NEXT_PUBLIC_VIDNOV_INTRO_VIDEO_URL || '';
const INTRO_POSTER =
  'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=1200&q=80';

export default function VidnovHomePage() {
  const { rooms: liveRooms, isLoading: isLiveLoading } = useLiveNow();
  const liveCount = liveRooms.length;
  const [introFailed, setIntroFailed] = useState(false);

  return (
    <LandingLayout>
      <div className="relative overflow-hidden bg-[#090909] text-[#f9f5ee]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,82,54,0.22),transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.08),transparent_28%),linear-gradient(180deg,#090909_0%,#101010_100%)]" />

        <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14">
          <div className="grid items-center gap-10 lg:grid-cols-[1.03fr_0.97fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#ff5a36]/40 bg-[#111111]/85 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#f9d4c4] shadow-[0_0_25px_rgba(255,90,54,0.15)]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5a36]" />
                Live commerce empire
              </div>

              <h1 className="mt-6 max-w-xl font-grotesk text-[clamp(3.1rem,7vw,6.3rem)] font-black leading-[0.9] tracking-[-0.08em] text-white">
                TURN
                <span className="block text-[#ff5a36]">ATTENTION</span>
                INTO SALES.
              </h1>

              <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#d9d1c6]">
                Vidnov is where premium brands, live creators, and high-converting storytelling meet — built to make your product feel expensive, urgent, and impossible to ignore.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-full border border-[#ff5a36] bg-[#ff5a36] px-7 text-sm font-bold text-[#150d0b] shadow-[0_12px_30px_rgba(255,90,54,0.35)] transition-all hover:-translate-y-0.5 hover:bg-[#ff6b49]">
                  <Link href="/buyer/discovery">
                    Watch live
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>

                <Button asChild variant="outline" size="lg" className="h-12 rounded-full border border-white/15 bg-transparent px-7 text-sm font-bold text-white hover:bg-white hover:text-[#111111]">
                  <Link href="/ai-studio">Create sales moment</Link>
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {featurePills.map((pill) => (
                  <span key={pill} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#f0d0c5]">
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[560px]">
              <div className="absolute -left-4 top-6 h-24 w-24 rounded-full border-[8px] border-[#ff5a36]/40 blur-[2px]" />
              <div className="absolute -right-2 bottom-8 h-28 w-28 rounded-full border-[10px] border-[#ffb5a3]/30" />

              <div className="relative overflow-hidden rounded-[32px] border border-[#ff5a36]/15 bg-[#101010] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.75)]">
                <div className="relative h-[560px] overflow-hidden rounded-[24px] border border-white/10 bg-[#111111]">
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage:
                        "linear-gradient(180deg, rgba(10,10,10,0.1), rgba(10,10,10,0.62)), url('https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80')",
                    }}
                  />

                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,90,54,0.28),transparent_25%)]" />

                  <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-[#111111]/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#f7d9cd] backdrop-blur-sm">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5a36]" />
                    LIVE
                  </div>

                  <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-[#111111]/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#f7d9cd] backdrop-blur-sm">
                    {liveCount > 0 ? `${liveCount} live now` : '2.8k watching'}
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <div className="rounded-[24px] border border-white/10 bg-[#111111]/80 p-4 backdrop-blur-md">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-[#ffcfbf]">
                        <span>Maison One</span>
                        <span>Luxury drop</span>
                      </div>

                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[#c9b7af]">Limited edition</p>
                          <h3 className="mt-2 font-grotesk text-[2.8rem] font-black leading-none text-white">NOVA</h3>
                        </div>
                        <div className="rounded-[18px] border border-[#ff5a36]/20 bg-[#ff5a36] px-3 py-2 text-right text-[#1c0907] shadow-[5px_5px_0_0_rgba(255,90,54,0.25)]">
                          <div className="text-[9px] uppercase tracking-[0.18em]">From</div>
                          <div className="font-grotesk text-2xl font-black">$249</div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2">
                        <div className="flex -space-x-2">
                          {livePeople.map((person) => (
                            <span key={person.name} className={`flex h-8 w-8 items-center justify-center rounded-full border border-[#111111] text-[9px] font-black uppercase text-[#1c0907] ${person.tone}`}>
                              {person.name.slice(0, 1)}
                            </span>
                          ))}
                        </div>
                        <button className="inline-flex items-center gap-2 rounded-full bg-[#ff5a36] px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#1c0907]">
                          <CirclePlay className="h-3.5 w-3.5 fill-current" />
                          Join
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  {stats.map((item) => (
                    <div key={item.label} className="rounded-[18px] border border-white/10 bg-white/5 p-3">
                      <div className="font-grotesk text-2xl font-black leading-none text-white">{item.value}</div>
                      <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-[#d5cdc5]">{item.label}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[9px] uppercase tracking-[0.14em] text-[#8a817a]">
                  Illustrative preview figures — not live platform data
                </p>
              </div>
            </div>
          </div>
        </section>

        {/*
          ON AIR RIGHT NOW — real sellers streaming into Vidnov at this moment
          (the same `liveSessions` query the buyer header runs). Each card
          opens the watch room; when nobody is live the section degrades into
          a designed "floor is quiet" state instead of disappearing.
        */}
        <section className="relative border-t border-[#ff5a36]/25 bg-[#0b0b0b]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#ff5a36]/30 bg-[#171717] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-[#ffcbba]">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff5a36] opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ff5a36]" />
                  </span>
                  {liveCount > 0
                    ? `${liveCount} ${liveCount === 1 ? 'seller is' : 'sellers are'} live`
                    : isLiveLoading
                      ? 'Checking the floor…'
                      : 'Live rooms open daily'}
                </div>
                <h2 className="mt-3 font-grotesk text-4xl font-black tracking-[-0.06em] text-white sm:text-5xl">
                  On air <span className="text-[#ff5a36]">right now.</span>
                </h2>
              </div>

              <Link
                href="/buyer/discovery"
                className="inline-flex items-center gap-2 text-sm font-bold text-white underline-offset-4 hover:underline"
              >
                Watch the live floor
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/*
              Real rooms when sellers are on air; clearly-tagged demo rooms
              with real imagery otherwise — the strip always shows what a live
              room looks like, and never pretends a demo is broadcasting.
            */}
            <div className="mt-8 flex gap-4 overflow-x-auto pb-2">
              {(liveCount > 0 ? liveRooms : DEMO_ROOMS).map((room) => {
                const demo = liveCount === 0;
                return (
                  <Link
                    key={room.id}
                    href={demo ? '/buyer/discovery' : `/buyer/live/${room.sellerId}`}
                    className="group relative h-[224px] w-[240px] shrink-0 overflow-hidden rounded-[24px] border border-[#ff5a36]/20 bg-[#171717] transition-all hover:-translate-y-1 hover:border-[#ff5a36]/60"
                  >
                    {room.image ? (
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{
                          backgroundImage: `linear-gradient(180deg, rgba(10,10,10,0.12), rgba(10,10,10,0.80)), url('${room.image}')`,
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,90,54,0.35),transparent_60%)]" />
                    )}

                    <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#ff5a36] px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#1c0907]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#1c0907]" />
                      Live
                    </div>

                    {demo && (
                      <div className="absolute right-3 top-3 rounded-full border border-white/15 bg-[#111111]/85 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#f7d9cd]">
                        Sample
                      </div>
                    )}

                    <div className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#111111]/80 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#f7d9cd]">
                      <Eye className="h-3 w-3" />
                      {room.viewerCount}
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="truncate font-grotesk text-base font-black text-white">
                        {room.title || 'Live show'}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[#c9b7af] group-hover:text-[#ffcfbf]">
                        {demo ? 'What a live room looks like' : 'Tap to enter the room'}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/*
          AI STUDIO — what it is and what it does for a seller: one product
          photo in, a campaign out. Links straight into the studio sellers
          already use (/ai-studio) and the full tools list.
        */}
        <section className="relative border-t border-[#ff5a36]/20 bg-[#0d0d0d]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#ff5a36]/30 bg-[#171717] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-[#ffcbba]">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Studio
                </div>

                <h2 className="mt-4 font-grotesk text-4xl font-black tracking-[-0.06em] text-white sm:text-5xl">
                  One photo in.
                  <span className="block text-[#ff5a36]">A whole campaign out.</span>
                </h2>

                <p className="mt-5 max-w-lg text-base leading-relaxed text-[#d6cfc5]">
                  The AI Studio is Vidnov's production crew in your pocket: turn a single
                  product photo into a scroll-stopping video, write captions and deals in your
                  brand voice, and clean up phone footage — all before your coffee goes cold.
                </p>

                <ul className="mt-8 space-y-4">
                  {[
                    {
                      title: 'Photo → Video',
                      text: 'Upload one product image; get a narrated, music-backed clip ready for the feed and your live shelf.',
                    },
                    {
                      title: 'Text → Video',
                      text: 'Describe the drop in a sentence — the studio scripts, voices and cuts the clip for you.',
                    },
                    {
                      title: 'Video Enhancer',
                      text: 'Upscale, steady and sharpen phone footage into broadcast-quality video.',
                    },
                    {
                      title: 'Captions & Deal Maker',
                      text: 'On-brand captions, hashtags and limited-time deal kits for any product.',
                    },
                  ].map(({ title, text }) => (
                    <li key={title} className="flex gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#ff5a36]/40 bg-[#ff5a36]/15 text-[#ffb9a5]">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <p className="font-grotesk text-base font-black text-white">{title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-[#cfc6bd]">{text}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="h-12 rounded-full border border-[#ff5a36] bg-[#ff5a36] px-7 text-sm font-bold text-[#150d0b] shadow-[0_12px_30px_rgba(255,90,54,0.3)] hover:-translate-y-0.5 hover:bg-[#ff6b49]">
                    <Link href="/ai-studio">
                      Open the AI Studio
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="h-12 rounded-full border border-white/15 bg-transparent px-7 text-sm font-bold text-white hover:bg-white hover:text-[#111111]">
                    <Link href="/dashboard/seller/ai-tools">See all seller tools</Link>
                  </Button>
                </div>
              </div>

              {/* Before → after: the product photo, then the clip it became. */}
              <div className="relative mx-auto w-full max-w-[560px]">
                <div className="rounded-[30px] border border-[#ff5a36]/20 bg-[linear-gradient(135deg,rgba(255,90,54,0.12),rgba(255,255,255,0.02))] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[22px] border border-white/10 bg-[#111111] p-2">
                      <div
                        className="relative h-56 overflow-hidden rounded-[16px] bg-cover bg-center"
                        style={{
                          backgroundImage:
                            "url('https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=80')",
                        }}
                      >
                        <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-[#111111]/80 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#f7d9cd]">
                          Your photo
                        </div>
                      </div>
                      <p className="px-1 pb-1 pt-3 text-[10px] uppercase tracking-[0.18em] text-[#c9b7af]">
                        One product image
                      </p>
                    </div>

                    <div className="rounded-[22px] border border-[#ff5a36]/30 bg-[#111111] p-2">
                      <div
                        className="relative h-56 overflow-hidden rounded-[16px] bg-cover bg-center"
                        style={{
                          backgroundImage:
                            "linear-gradient(180deg, rgba(10,10,10,0.05), rgba(10,10,10,0.55)), url('https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80')",
                        }}
                      >
                        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#ff5a36] px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#1c0907]">
                          <CirclePlay className="h-3 w-3 fill-current" />
                          AI video
                        </div>
                        <div className="absolute inset-x-3 bottom-3 h-1.5 overflow-hidden rounded-full bg-white/20">
                          <div className="h-full w-2/3 rounded-full bg-[#ff5a36]" />
                        </div>
                      </div>
                      <p className="px-1 pb-1 pt-3 text-[10px] uppercase tracking-[0.18em] text-[#ffcfbf]">
                        Feed-ready clip in ~60s
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {[
                      { value: '60s', label: 'To first cut' },
                      { value: '1 tap', label: 'Post to feed' },
                      { value: '0 crew', label: 'Needed' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-[18px] border border-white/10 bg-white/5 p-3 text-center">
                        <div className="font-grotesk text-xl font-black leading-none text-white">{item.value}</div>
                        <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-[#d5cdc5]">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-t border-[#ff5a36]/25 bg-[#121212]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#ff9d7d]">Why people stop</p>
                <h2 className="mt-3 max-w-2xl font-grotesk text-4xl font-black tracking-[-0.06em] text-white sm:text-5xl">
                  A homepage built for desire, not just clicks.
                </h2>
              </div>
              <Link href="/buyer/discovery" className="inline-flex items-center gap-2 text-sm font-bold text-white underline-offset-4 hover:underline">
                Explore live rooms <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {cards.map(({ title, text, icon: Icon }) => (
                <div key={title} className="rounded-[28px] border border-[#ff5a36]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ff5a36]/20 bg-[#ff5a36]/10 text-[#ffb7a1]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-grotesk text-2xl font-black tracking-[-0.05em] text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#d0c4bb]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative border-t border-[#ff5a36]/20 bg-[#090909]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#ff5a36]/25 bg-[#171717] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-[#ffb9a5]">
                  <Radio className="h-3.5 w-3.5" />
                  Live now
                </div>

                <h2 className="font-grotesk text-4xl font-black tracking-[-0.06em] text-white sm:text-5xl">
                  Where products feel alive, rare, and premium.
                </h2>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {[
                    {
                      title: 'Luxury brand rooms',
                      image: "url('https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1000&q=80')",
                    },
                    {
                      title: 'Creator-led reveals',
                      image: "url('https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1000&q=80')",
                    },
                    {
                      title: 'Private drops',
                      image: "url('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80')",
                    },
                    {
                      title: 'Collector edits',
                      image: "url('https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=1000&q=80')",
                    },
                  ].map((item) => (
                    <div key={item.title} className="group overflow-hidden rounded-[24px] border border-white/10 bg-[#121212] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.3)]">
                      <div
                        className="relative h-52 rounded-[18px] bg-cover bg-center"
                        style={{ backgroundImage: item.image }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-[#090909]/80 via-transparent to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 p-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ffcfbf]">Featured</div>
                          <div className="mt-1 font-grotesk text-2xl font-black text-white">{item.title}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-[#ff5a36]/20 bg-[linear-gradient(135deg,rgba(255,90,54,0.12),rgba(255,255,255,0.02),rgba(255,255,255,0.03))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
                <div className="rounded-[22px] border border-white/10 bg-[#111111] p-5">
                  <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#ffb59a]">
                    <span>Brand signal</span>
                    <span className="rounded-full border border-[#ff5a36]/25 bg-[#ff5a36]/10 px-2 py-1">High intent</span>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="rounded-[18px] border border-white/10 bg-[#171717] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-[0.18em] text-[#ffb59a]">Audience</span>
                        <Users className="h-4 w-4 text-[#ff5a36]" />
                      </div>
                      <div className="mt-3 font-grotesk text-4xl font-black text-white">14.2k</div>
                    </div>

                    <div className="rounded-[18px] border border-white/10 bg-[#171717] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-[0.18em] text-[#ffb59a]">Buyers</span>
                        <Star className="h-4 w-4 text-[#ff5a36]" />
                      </div>
                      <div className="mt-3 font-grotesk text-4xl font-black text-white">+64%</div>
                    </div>

                    <div className="rounded-[18px] border border-[#ff5a36]/20 bg-[#ff5a36]/10 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-[0.18em] text-[#ffcfbf]">Creator earnings</span>
                        <TrendingUp className="h-4 w-4 text-[#ffb9a5]" />
                      </div>
                      <div className="mt-3 font-grotesk text-4xl font-black text-white">$48k</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-t border-[#ff5a36]/20 bg-[#0d0d0d]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#ff5a36]/25 bg-[#171717] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-[#ffb9a5]">
                  <CirclePlay className="h-3.5 w-3.5" />
                  What Vidnov does
                </div>
                <h2 className="font-grotesk text-4xl font-black tracking-[-0.06em] text-white sm:text-5xl">
                  See the whole marketplace
                  <span className="block text-[#ff5a36]">in under a minute.</span>
                </h2>
                <ul className="mt-6 space-y-2.5 text-sm leading-relaxed text-[#d0c4bb]">
                  {[
                    'Sellers record product videos straight from their phone in the Video Studio.',
                    'Customers discover products and local services in the vertical feed.',
                    'Viewers open a seller\u2019s shop and the exact listing behind any video.',
                    'Buyers contact sellers and send enquiries through built-in messaging.',
                    'Businesses gain real exposure from content people actually watch.',
                  ].map((line) => (
                    <li key={line} className="flex gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ff5a36]" />
                      {line}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button asChild className="h-11 rounded-full bg-[#ff5a36] px-6 text-sm font-bold text-[#150d0b] hover:bg-[#ff6a49]">
                    <Link href="/buyer/discovery">
                      Discover products <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-full border-white/15 px-6 text-sm font-bold text-white hover:bg-white hover:text-[#111111]">
                    <Link href="/search">Explore Vidnov</Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-full border-white/15 px-6 text-sm font-bold text-white hover:bg-white hover:text-[#111111]">
                    <Link href="/signup">Open your shop</Link>
                  </Button>
                  <Button asChild className="h-11 rounded-full border border-[#ff5a36]/40 bg-[#ff5a36]/10 px-6 text-sm font-bold text-[#ffb9a5] hover:bg-[#ff5a36]/20">
                    <Link href="/dashboard/seller/video-studio">Create your first video</Link>
                  </Button>
                </div>
              </div>

              {/*
                Intro video — the asset comes from NEXT_PUBLIC_VIDNOV_INTRO_VIDEO_URL
                only. No URL is invented: when it is unset (or fails to load) the
                section renders its fallback image and the page is unaffected.
              */}
              <div className="overflow-hidden rounded-[28px] border border-[#ff5a36]/20 bg-[#111111] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
                {INTRO_VIDEO_URL && !introFailed ? (
                  <video
                    src={INTRO_VIDEO_URL}
                    poster={INTRO_POSTER}
                    controls
                    playsInline
                    preload="metadata"
                    onError={() => setIntroFailed(true)}
                    className="aspect-video w-full rounded-[20px] bg-black object-cover"
                  >
                    Your browser does not support embedded video.
                  </video>
                ) : (
                  <div
                    className="relative aspect-video w-full rounded-[20px] bg-cover bg-center"
                    style={{ backgroundImage: `url('${INTRO_POSTER}')` }}
                    role="img"
                    aria-label="Sellers recording product videos for the Discovery feed"
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-[#090909]/85 via-transparent to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ffcfbf]">
                        Vidnov in action
                      </div>
                      <p className="mt-1 font-grotesk text-xl font-black text-white">
                        Record. Publish. Sell.
                      </p>
                    </div>
                  </div>
                )}
                <p className="px-2 pb-1 pt-3 text-[11px] leading-relaxed text-[#9d948c]">
                  From a phone-shot product video to a live listing, a shop visit and a real
                  enquiry — the whole flow, on one marketplace.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-t border-[#ff5a36]/20 bg-[#0d0d0d]">
          <div className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8">
            <div className="rounded-[32px] border border-[#ff5a36]/20 bg-[linear-gradient(135deg,rgba(255,90,54,0.1),rgba(255,255,255,0.01),rgba(255,255,255,0.03))] p-8 text-center shadow-[0_24px_50px_rgba(0,0,0,0.45)]">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#ff5a36]/30 bg-[#171717] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-[#ffcbba]">
                <ShieldCheck className="h-3.5 w-3.5" />
                The premium selling point
              </div>

              <h2 className="mx-auto mt-8 max-w-4xl font-grotesk text-[clamp(2.8rem,7vw,5.6rem)] font-black leading-[0.92] tracking-[-0.07em] text-white">
                PEOPLE DO NOT
                <span className="block text-[#ff5a36]">REMEMBER</span>
                AVERAGE BRANDS.
              </h2>

              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#d6cfc5]">
                This is the kind of homepage that makes someone understand your value instantly — premium, real, live, and impossible to scroll past.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-full border border-[#ff5a36] bg-[#ff5a36] px-8 text-sm font-bold text-[#150d0b] shadow-[0_12px_30px_rgba(255,90,54,0.35)] hover:-translate-y-0.5 hover:bg-[#ff6a49]">
                  <Link href="/buyer/discovery">
                    Start the experience
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>

                <Button asChild variant="outline" size="lg" className="h-12 rounded-full border border-white/15 bg-transparent px-8 text-sm font-bold text-white hover:bg-white hover:text-[#111111]">
                  <Link href="/ai-studio">Build a live launch</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </LandingLayout>
  );
}
