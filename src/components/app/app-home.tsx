'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Banknote,
  ChevronLeft,
  Heart,
  LogIn,
  MessageCircle,
  Package,
  Radio,
  ShoppingBag,
  Sparkles,
  Store,
  Video,
  Wallet,
} from 'lucide-react';
import { Logo } from '@/components/logo';

/**
 * APP HOME — the front door of the app.
 *
 * ## What this page used to be
 *
 * Two earlier versions, both rejected:
 *
 *   1. It described the ARCHITECTURE, not the product — "the app for sellers
 *      and buyers", "two sections, nothing shared between them". A fact about
 *      our source tree, and no fact at all about Vidnov.
 *   2. It was then all text. Correct copy, but a gateway page that is a wall
 *      of words is a wall of words: nobody scrolls a stranger twice.
 *
 * ## Why there are no photographs on this page
 *
 * The honest answer is that we have no photography. Every product image in the
 * system currently sits behind a Firebase Storage bucket that answers 402, so
 * dropping stock tiles on the homepage would either show grey boxes or quietly
 * contradict what a buyer sees in the app.
 *
 * So the hero image is CONSTRUCTED: a phone rendering our own live-shopping
 * screen out of real components — the LIVE badge, the product sheet, the buy
 * button, the reaction rail. It is an illustration of the product, not a
 * screenshot of it, and it is labelled as such in code so nobody later mistakes
 * it for a capture of live data.
 *
 * Everything on it is drawn, so it cannot rot when a bucket URL dies, it weighs
 * nothing, and it stays sharp on any screen. If real product photography lands
 * later, the mockup is a drop-in swap for an image of the same size.
 *
 * ## Why no numbers and no testimonials
 *
 * There is not one user count, GMV figure or customer quote on this page. Every
 * one would be invented, and an invented number in a gateway page is not a
 * placeholder — it is a claim the company then has to defend. Capability
 * statements are the honest ceiling until someone hands us verified figures.
 *
 * ## The three voices
 *
 *   Space Grotesk  — structure: headings, numbers, UI
 *   Instrument Serif — accent words only, and only in the hero
 *   Inter          — micro-labels and metadata
 *
 * Two grotesks make every page look like every other page. The serif is the
 * cheapest available way to stop that, and confining it to two words keeps it
 * an accent rather than a theme.
 *
 * Signed-in users never see this screen; the app entry routes them into their
 * own section.
 */

/**
 * THE RAIL — the destinations, as tiles you can reach in one tap.
 *
 * Every href below was route-checked before it was written. A tile that 404s
 * is worse than no tile, so nothing on this page is decorative navigation:
 * if it looks like a door, it opens.
 */
const RAIL = [
  { label: 'Shop', icon: ShoppingBag, href: '/app/buyer/shop', plate: 'from-violet-400 to-indigo-500' },
  { label: 'Go live', icon: Radio, href: '/app/seller/live', plate: 'from-rose-500 to-red-600' },
  { label: 'Requests', icon: MessageCircle, href: '/app/buyer/requests', plate: 'from-sky-400 to-cyan-500' },
  { label: 'AI Studio', icon: Sparkles, href: '/app/seller/ai-studio', plate: 'from-fuchsia-500 to-purple-600' },
  { label: 'Orders', icon: Package, href: '/app/buyer/orders', plate: 'from-amber-400 to-orange-500' },
  { label: 'Payouts', icon: Wallet, href: '/app/seller/payments', plate: 'from-emerald-400 to-teal-500' },
] as const;

/**
 * THE FOUR MOVES — what a seller or buyer actually comes here to do.
 *
 * These replace an earlier set of three capability paragraphs. Same ground,
 * but every one is now a card that goes somewhere, which is what a gateway
 * page is for.
 */
const ACTIONS = [
  {
    art: 'studio' as const,
    title: 'Create with AI',
    body: 'Generate the images and video your listing is missing.',
    cta: 'AI Studio',
    href: '/app/seller/ai-studio',
    plate: 'from-fuchsia-500 via-purple-500 to-indigo-600',
  },
  {
    art: 'live' as const,
    title: 'Go live',
    body: 'Stream, showcase and sell in real time, without leaving the app.',
    cta: 'Start live',
    href: '/app/seller/live',
    plate: 'from-rose-500 via-red-500 to-orange-500',
  },
  {
    art: 'request' as const,
    title: 'Post a request',
    body: 'Say what you need and let sellers come to you with offers.',
    cta: 'Post a request',
    href: '/app/buyer/requests',
    plate: 'from-sky-400 via-cyan-500 to-teal-500',
  },
  {
    art: 'grow' as const,
    title: 'Grow your business',
    body: 'Stock, orders, earnings and payouts — tracked in one place.',
    cta: 'Get started',
    href: '/app/seller/payments',
    plate: 'from-amber-400 via-orange-500 to-amber-600',
  },
] as const;

/** The loop. This is the part worth remembering after they scroll away. */
const LOOP = [
  { icon: Store, label: 'List it', detail: 'Stock, pricing, photos, video' },
  { icon: Radio, label: 'Go live', detail: 'Show it to a real audience' },
  { icon: ShoppingBag, label: 'They buy', detail: 'Chat, order, pay in the app' },
  { icon: Banknote, label: 'You get paid', detail: 'Split, ledger, payout' },
] as const;

const CATEGORIES = [
  'Fashion',
  'Phones',
  'Beauty',
  'Home',
  'Groceries',
  'Handmade',
  'Shoes',
  'Electronics',
  'Skincare',
  'Furniture',
] as const;

/**
 * TILE ART — four mini scenes, one per card.
 *
 * The deployed homepage uses photographs we do not have in this codebase, and
 * the product bucket answers 402, so stock tiles are not an option. These are
 * the same trade as the basket: drawn, sharp, unbreakable, and each one
 * actually depicts what the card says — a studio with a spark, a broadcast
 * rig, a request note, a growth chart.
 *
 * `id` values are namespaced per art key on purpose. SVG ids are document-wide,
 * so two cards sharing a gradient id would make the second one silently
 * resolve to the first one's fill.
 */
function TileArt({ art }: { art: (typeof ACTIONS)[number]['art'] }) {
  if (art === 'studio') {
    return (
      <svg viewBox="0 0 160 90" className="h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="tile-studio-glow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <circle cx="80" cy="45" r="42" fill="url(#tile-studio-glow)" />
        {/* Aperture blades — a lens, not a generic sparkle. */}
        <g transform="translate(80 45)">
          {[0, 60, 120, 180, 240, 300].map((angle) => (
            <path
              key={angle}
              d="M0 0 L26 -9 L22 8 Z"
              fill="rgba(255,255,255,0.9)"
              transform={`rotate(${angle})`}
            />
          ))}
          <circle r="8" fill="rgba(255,255,255,0.95)" />
        </g>
        <circle cx="34" cy="22" r="3" fill="rgba(255,255,255,0.8)" />
        <circle cx="128" cy="28" r="2.5" fill="rgba(255,255,255,0.7)" />
        <circle cx="120" cy="70" r="2" fill="rgba(255,255,255,0.6)" />
      </svg>
    );
  }

  if (art === 'live') {
    return (
      <svg viewBox="0 0 160 90" className="h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="tile-live-beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        {/* Broadcast beam */}
        <path d="M52 26 L14 8 L14 82 L52 64 Z" fill="url(#tile-live-beam)" />
        {/* Camera */}
        <rect x="52" y="26" width="58" height="38" rx="9" fill="rgba(255,255,255,0.92)" />
        <path d="M110 40 L134 30 L134 60 L110 50 Z" fill="rgba(255,255,255,0.75)" />
        <circle cx="72" cy="45" r="9" fill="rgba(120,20,40,0.75)" />
        <circle cx="99" cy="36" r="3" fill="rgba(120,20,40,0.55)" />
        {/* Signal arcs */}
        <path
          d="M126 28 a18 18 0 0 1 0 34"
          fill="none"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M138 20 a28 28 0 0 1 0 50"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (art === 'request') {
    return (
      <svg viewBox="0 0 160 90" className="h-full w-full" aria-hidden>
        {/* Note */}
        <rect
          x="34"
          y="14"
          width="82"
          height="64"
          rx="9"
          fill="rgba(255,255,255,0.93)"
          transform="rotate(-5 75 46)"
        />
        {[0, 1, 2].map((line) => (
          <rect
            key={line}
            x="46"
            y={34 + line * 11}
            width={line === 2 ? 34 : 56}
            height="4"
            rx="2"
            fill="rgba(10,60,90,0.32)"
            transform="rotate(-5 75 46)"
          />
        ))}
        {/* Envelope behind it */}
        <g transform="translate(88 44) rotate(8)">
          <rect x="0" y="0" width="50" height="34" rx="7" fill="rgba(255,255,255,0.7)" />
          <path
            d="M2 4 L25 21 L48 4"
            fill="none"
            stroke="rgba(10,60,90,0.35)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 160 90" className="h-full w-full" aria-hidden>
      {/* Axis */}
      <rect x="26" y="70" width="112" height="3" rx="1.5" fill="rgba(255,255,255,0.45)" />
      {/* Rising bars + trend line: the only honest growth chart is one that
          goes up, and this one is drawn as data rather than decoration. */}
      {[
        { x: 36, h: 16 },
        { x: 60, h: 26 },
        { x: 84, h: 38 },
        { x: 108, h: 52 },
      ].map((bar) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={70 - bar.h}
          width="16"
          height={bar.h}
          rx="4"
          fill="rgba(255,255,255,0.9)"
        />
      ))}
      <path
        d="M36 56 L68 42 L92 32 L124 14"
        fill="none"
        stroke="rgba(255,255,255,0.95)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="124" cy="14" r="5" fill="rgba(255,255,255,1)" />
    </svg>
  );
}

/**
 * THE STILL — an illustration of the product being sold.
 *
 * Why this is drawn rather than photographed:
 *
 *   • Every product image in the system sits behind a Storage bucket that
 *     answers 402, so a real photo would render as a broken frame on the one
 *     page nobody can afford to have broken.
 *   • There is an unused `public/live/live.jpg` in the repo, but nothing
 *     references it and its contents were never verified — shipping an
 *     unlooked-at file as the hero of the company's front door is a coin flip.
 *
 * So the subject is drawn to match the product the copy names ("Handwoven
 * storage basket"), which means the picture and the words cannot disagree. It
 * is vector, so it is sharp at any size, weighs nothing, and cannot 402. When
 * real photography exists this is a drop-in swap for one `<img>`.
 */
function BasketStill() {
  return (
    <svg
      viewBox="0 0 200 180"
      className="h-full w-full"
      role="img"
      aria-label="Illustration of a handwoven storage basket"
    >
      <defs>
        <linearGradient id="vn-basket-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E2B071" />
          <stop offset="55%" stopColor="#C08B4E" />
          <stop offset="100%" stopColor="#8A5A2B" />
        </linearGradient>
        {/* The weave. Two offset bands rotated against each other read as
            plaiting from the distance the phone mockup is seen at. */}
        <pattern
          id="vn-basket-weave"
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(38)"
        >
          <rect width="12" height="12" fill="none" />
          <line x1="0" y1="0" x2="0" y2="12" stroke="rgba(255,255,255,0.22)" strokeWidth="3" />
          <line x1="6" y1="0" x2="6" y2="12" stroke="rgba(60,30,0,0.18)" strokeWidth="2.5" />
        </pattern>
        <radialGradient id="vn-basket-mouth" cx="50%" cy="38%">
          <stop offset="0%" stopColor="#4A2E12" />
          <stop offset="100%" stopColor="#2C1B0A" />
        </radialGradient>
        <linearGradient id="vn-basket-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0C68C" />
          <stop offset="100%" stopColor="#A9713A" />
        </linearGradient>
      </defs>

      {/* Handle — behind the body so the body overlaps its feet. */}
      <path
        d="M56 66 Q100 16 144 66"
        fill="none"
        stroke="#A9713A"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M56 66 Q100 16 144 66"
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Body */}
      <path
        d="M40 64 C40 104 47 132 57 152 L143 152 C153 132 160 104 160 64 Z"
        fill="url(#vn-basket-body)"
      />
      <path
        d="M40 64 C40 104 47 132 57 152 L143 152 C153 132 160 104 160 64 Z"
        fill="url(#vn-basket-weave)"
      />

      {/* Contact shadow so it sits on something. */}
      <ellipse cx="100" cy="156" rx="46" ry="7" fill="rgba(0,0,0,0.28)" />

      {/* Opening, then the rim over its edge. */}
      <ellipse cx="100" cy="64" rx="60" ry="17" fill="url(#vn-basket-mouth)" />
      <ellipse
        cx="100"
        cy="64"
        rx="60"
        ry="17"
        fill="none"
        stroke="url(#vn-basket-rim)"
        strokeWidth="7"
      />
    </svg>
  );
}

/**
 * HERO MOCKUP — our live screen, drawn.
 *
 * The video area carries the product still under a sweeping sheen rather than a
 * looping clip, because a clip would either autoplay silently on mobile or
 * need a poster we do not have.
 */
function LiveScreenMock() {
  return (
    <div className="relative mx-auto w-full max-w-[260px]">
      {/* Depth card: the payout that lands while you are still broadcasting. */}
      <div className="vn-float absolute -left-3 top-16 z-20 hidden w-44 rounded-2xl border border-white/12 bg-[#111C33]/95 p-3 shadow-2xl shadow-black/50 backdrop-blur sm:block">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20">
            <Banknote className="h-3.5 w-3.5 text-emerald-400" />
          </span>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/45">
              Payout cleared
            </p>
            <p className="font-grotesk text-xs font-bold text-emerald-400">
              + KSh 4,180.00
            </p>
          </div>
        </div>
      </div>

      {/* Depth card: a buyer asking a question mid-stream. */}
      <div className="vn-float-delayed absolute -right-4 bottom-24 z-20 hidden w-44 rounded-2xl border border-white/12 bg-[#111C33]/95 p-3 shadow-2xl shadow-black/50 backdrop-blur sm:block">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20">
            <MessageCircle className="h-3.5 w-3.5 text-cyan-400" />
          </span>
          <p className="min-w-0 text-[11px] leading-snug text-white/80">
            Do you ship to Mombasa?
          </p>
        </div>
      </div>

      {/* The phone. */}
      <div className="relative rounded-[2.5rem] border border-white/15 bg-[#0B1226] p-2 shadow-2xl shadow-cyan-500/10">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#080D1C]">
          {/* Video area */}
          <div className="vn-sheen relative aspect-[9/14] w-full overflow-hidden bg-gradient-to-br from-amber-500/80 via-rose-500/70 to-violet-700/80">
            <div
              aria-hidden
              className="absolute -left-6 top-10 h-24 w-24 rounded-full bg-white/25 blur-2xl"
            />
            <div
              aria-hidden
              className="absolute -right-4 bottom-24 h-28 w-28 rounded-full bg-amber-200/30 blur-2xl"
            />

            {/* The product being shown in the broadcast. */}
            <div className="absolute inset-x-0 top-[14%] bottom-[38%] flex items-end justify-center px-6">
              <BasketStill />
            </div>

            {/* Top chrome */}
            <div className="relative flex items-center justify-between px-3 pt-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-white">
                <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
                Live
              </span>
              <span className="rounded-full bg-black/35 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/80 backdrop-blur">
                Watching
              </span>
            </div>

            {/* Reaction rail */}
            <div className="absolute right-2.5 top-12 flex flex-col items-center gap-2.5">
              {[
                { icon: Heart, tint: 'text-red-400', bg: 'bg-white/15' },
                { icon: MessageCircle, tint: 'text-white', bg: 'bg-white/15' },
                { icon: ShoppingBag, tint: 'text-white', bg: 'bg-white/15' },
              ].map((rail) => (
                <span
                  key={rail.icon.displayName ?? rail.tint}
                  className="flex flex-col items-center gap-0.5"
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${rail.bg} backdrop-blur`}
                  >
                    <rail.icon className={`h-3.5 w-3.5 ${rail.tint}`} />
                  </span>
                </span>
              ))}
            </div>

            {/* Seller + product sheet */}
            <div className="absolute inset-x-2.5 bottom-2.5 rounded-2xl border border-white/15 bg-black/45 p-3 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-red-500 text-[10px] font-black text-white">
                  N
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-bold text-white">
                    Nairobi Home Co.
                  </p>
                  <p className="text-[8px] uppercase tracking-[0.15em] text-white/55">
                    Verified seller
                  </p>
                </div>
              </div>

              <div className="mt-2.5 rounded-xl bg-white/10 p-2.5">
                <p className="text-[11px] font-bold leading-tight text-white">
                  Handwoven storage basket
                </p>
                <p className="mt-1 font-grotesk text-sm font-bold text-amber-300">
                  KSh 3,200
                </p>
              </div>

              <span className="mt-2 flex h-8 w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 text-[10px] font-black uppercase tracking-[0.15em] text-[#0A1224]">
                Buy now
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppHome() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0A1224] text-white">
      {/* Ambient light. Three washes at different depths so the page does not
          read as one lit box the whole way down. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-32 h-80 w-80 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-violet-500/15 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-lg px-5 pb-16">
        {/* ── Masthead ─────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between py-5">
          <Logo className="text-2xl" />
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
            Kenya
          </span>
        </header>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="pb-12 pt-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-400">
            Live shopping · Marketplace
          </p>

          <h1 className="font-grotesk mt-3 text-[2.75rem] font-bold leading-[1.02] tracking-tight">
            Sell it
            <br />
            while it{' '}
            <em className="font-display bg-gradient-to-r from-amber-300 via-orange-400 to-red-500 bg-clip-text text-transparent not-italic italic">
              moves.
            </em>
          </h1>

          <p className="mt-5 text-[15px] leading-relaxed text-white/70">
            Vidnov is where sellers broadcast live and buyers shop inside the
            broadcast. Ask questions while you watch, buy in the moment, and
            watch the split land — paid to your bank without a single
            spreadsheet.
          </p>

          {/* The constructed product image, placed above the CTAs on wide
              screens so the value is visible before the ask. */}
          <div className="mt-9">
            <LiveScreenMock />
          </div>

          <div className="mt-9 flex flex-col gap-2.5">
            <Link
              href="/login?returnTo=/app"
              className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-7 py-4 text-sm font-bold uppercase tracking-widest text-[#0A1224] shadow-lg shadow-violet-500/30 transition hover:from-cyan-300 hover:to-violet-400"
            >
              <LogIn className="h-4 w-4" />
              Sign in
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2.5 rounded-full border border-white/20 bg-white/5 px-7 py-4 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-white/10"
            >
              <Store className="h-4 w-4" />
              Create an account
            </Link>
          </div>

          <p className="mt-4 text-center text-[11px] text-white/40">
            One account. Website or app — your call, your section.
          </p>
        </section>

        {/* ── Category ticker ──────────────────────────────────────────── */}
        {/* The one horizontal-scroll band on a vertical page. It buys rhythm
            and it names the breadth of the catalogue without a single claim
            about it. */}
        <section className="relative border-y border-white/10 py-4">
          <div className="overflow-hidden">
            <div className="vn-marquee-track vn-marquee">
              {[...CATEGORIES, ...CATEGORIES].map((category, index) => (
                <span
                  key={`${category}-${index}`}
                  className="flex shrink-0 items-center gap-3 px-5 text-[11px] font-bold uppercase tracking-[0.22em] text-white/45"
                >
                  {category}
                  <span className="h-1 w-1 rounded-full bg-cyan-400/60" />
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── The rail ─────────────────────────────────────────────────── */}
        {/* Every tile is a real destination, all route-checked. Horizontally
            scrollable because six tiles will not fit a phone, and a wrapped
            six-across grid would shrink every target under 44px. */}
        <section className="pt-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
            Go anywhere
          </p>
          <div className="-mx-5 mt-4 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {RAIL.map((tile) => (
              <Link
                key={tile.label}
                href={tile.href}
                className="group flex w-[92px] shrink-0 flex-col items-center gap-2.5"
              >
                <span
                  className={`flex h-[68px] w-[68px] items-center justify-center rounded-3xl bg-gradient-to-br ${tile.plate} shadow-lg transition group-hover:scale-105`}
                >
                  <tile.icon className="h-6 w-6 text-white" />
                </span>
                <span className="text-center text-[11px] font-semibold leading-tight text-white/75">
                  {tile.label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── The four moves ───────────────────────────────────────────── */}
        <section className="pt-14">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
            What you get
          </p>
          <h2 className="font-grotesk mt-2 text-3xl font-bold leading-tight tracking-tight">
            Four ways to start.
          </h2>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {ACTIONS.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="group overflow-hidden rounded-3xl border border-white/10 bg-[#0F1730] transition active:scale-[0.99]"
              >
                {/* Art plate — the picture that replaces a stock photo. */}
                <div
                  className={`relative h-28 w-full overflow-hidden bg-gradient-to-br ${action.plate}`}
                >
                  <div
                    aria-hidden
                    className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/25 blur-2xl"
                  />
                  <div className="absolute inset-0 p-3">
                    <TileArt art={action.art} />
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-grotesk text-base font-bold leading-snug">
                    {action.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">
                    {action.body}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                    {action.cta}
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── The loop ─────────────────────────────────────────────────── */}
        <section className="pt-14">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
            How the money moves
          </p>
          <h2 className="font-grotesk mt-2 text-3xl font-bold leading-tight tracking-tight">
            From first look to paid.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/65">
            No marketplace in between, no waiting on a payout window. The same
            loop runs in both directions — the seller is paid, the buyer is
            protected.
          </p>

          <ol className="relative mt-8">
            {/* The spine stops before the last node so it reads as a connector
                rather than a line running past the end. */}
            <div
              aria-hidden
              className="absolute bottom-8 left-[19px] top-8 w-px bg-gradient-to-b from-amber-400/60 via-cyan-400/50 to-transparent"
            />
            {LOOP.map((step, index) => (
              <li key={step.label} className="relative flex gap-4 pb-7 last:pb-0">
                <span className="font-grotesk relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#0F1730] text-sm font-bold tabular-nums text-white/80">
                  {index + 1}
                </span>
                <div className="min-w-0 pt-1.5">
                  <p className="font-grotesk flex items-center gap-2 text-base font-bold">
                    <step.icon className="h-4 w-4 text-cyan-400" />
                    {step.label}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-white/60">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <ul className="mt-7 grid gap-2.5">
            {[
              'Order status buyers can actually follow, and sellers can fulfil from',
              'Buyer and seller talk inside the app — no phone numbers, no off-platform deals',
              'Payout to any Kenyan bank or PayPal, requested from the app',
            ].map((proof) => (
              <li
                key={proof}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                <span className="text-[13px] leading-relaxed text-white/70">
                  {proof}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Full-bleed colour break ──────────────────────────────────── */}
        {/* The page has been dark for a full screen and a half. This band is
            the one place it stops being dark, so the next section reads as a
            change of room rather than more scrolling. */}
        <section className="relative mt-14 overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 p-7 shadow-2xl shadow-red-500/20">
          <div
            aria-hidden
            className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/25 blur-2xl"
          />
          <div className="relative">
            <Video className="h-7 w-7 text-white/90" />
            <p className="font-grotesk mt-4 text-3xl font-bold leading-[1.1] tracking-tight">
              Your camera is the storefront.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/85">
              No storefront design to get right, no new photoshoot to shoot. Open
              the app, go live, and the shop is open.
            </p>
          </div>
        </section>

        {/* ── Two doors ────────────────────────────────────────────────── */}
        <section className="pt-14">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
            Choose your side
          </p>
          <h2 className="font-grotesk mt-2 text-3xl font-bold leading-tight tracking-tight">
            One account. Two ways in.
          </h2>

          <div className="mt-7 space-y-3">
            <Link
              href="/app/seller"
              className="group block rounded-3xl bg-gradient-to-br from-amber-400/95 to-red-500/95 p-5 shadow-2xl shadow-red-500/20 transition hover:from-amber-300/90 hover:to-red-400/90"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-lg font-bold shadow-lg">
                  S
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-grotesk text-lg font-bold">Sell on Vidnov</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/85">
                    Your stock, orders, broadcasts, earnings and payouts — in one
                    workspace.
                  </p>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-white/70 transition group-hover:translate-x-0.5 group-hover:text-white" />
              </div>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {['Stock', 'Orders', 'Live', 'AI Studio', 'Requests', 'Earnings', 'Payouts'].map(
                  (tag) => (
                    <li
                      key={tag}
                      className="rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/85"
                    >
                      {tag}
                    </li>
                  ),
                )}
              </ul>
            </Link>

            <Link
              href="/app/buyer"
              className="group block rounded-3xl bg-gradient-to-br from-cyan-400/95 to-violet-500/95 p-5 shadow-2xl shadow-violet-500/20 transition hover:from-cyan-300/90 hover:to-violet-400/90"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-lg font-bold shadow-lg">
                  B
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-grotesk text-lg font-bold">Buy on Vidnov</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/85">
                    Watch sellers live, message them, post what you need and let
                    them come to you with an offer.
                  </p>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-white/70 transition group-hover:translate-x-0.5 group-hover:text-white" />
              </div>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {['Discover', 'Live', 'Offers', 'Cart', 'Orders', 'Wallet'].map(
                  (tag) => (
                    <li
                      key={tag}
                      className="rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/85"
                    >
                      {tag}
                    </li>
                  ),
                )}
              </ul>
            </Link>
          </div>
        </section>

        {/* ── Close ────────────────────────────────────────────────────── */}
        <footer className="pt-14 text-center">
          <div className="flex justify-center">
            <Logo className="text-xl opacity-70" />
          </div>
          <p className="font-grotesk mt-4 text-2xl font-bold leading-snug tracking-tight">
            Post. Earn. Repeat.
          </p>
          <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-white/50">
            The loop runs itself. All you do is show up with something worth
            selling.
          </p>

          <Link
            href="/signup"
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-white/10"
          >
            <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
            Start selling
          </Link>
        </footer>
      </div>
    </div>
  );
}