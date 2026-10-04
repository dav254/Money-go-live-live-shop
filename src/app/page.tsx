import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, Check, Sparkles, Video, Wallet, Truck,
  ShieldCheck, BarChart3, Megaphone, Store, Package, Boxes, Radio,
  Smartphone, Clock, Lock, Globe, ChevronRight, Quote, Zap, Layers,
  MessageSquare, Repeat, CreditCard, Camera, MapPin, Home,
} from 'lucide-react';
import { LandingLayout } from '@/components/layout/landing-layout';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/logo';
import { InstallAppButton } from '@/components/install-app-button';
import { TierBadge } from '@/components/trust/tier-badge';
import { TIER_THRESHOLDS, tierMeta, type AccountTier } from '@/lib/tiers';

/**
 * VIDNOV HOME.
 *
 * A server component on purpose. The page is entirely static marketing surface
 * and the only interactive pieces are native `<details>` elements plus one
 * client island (`InstallAppButton`, which needs the browser's install event),
 * so there is no reason to ship the whole page as a client bundle — which also
 * keeps it well clear of the hydration problems the app surface had.
 *
 * The narrative is deliberately seller-first. The app is currently gated to
 * sellers, so the homepage leads with the seller journey — create, list, sell,
 * get paid — and treats buyers as the counterpart that arrives later, not as the
 * headline audience.
 *
 * Money figures in the fee breakdown are taken from the real settlement
 * function in `functions/src/index.ts`, not invented for the copy.
 */

const SELL = '/signup?role=seller';
const LOGIN = '/login';

/* ── Data ──────────────────────────────────────────────────────────────── */

const STEPS = [
  {
    n: '01',
    icon: Camera,
    title: 'Make the content',
    body:
      'Shoot straight from your phone or generate it. AI Studio turns a product photo into a video, a caption set and a ready-to-post ad — no camera, no editor, no studio budget.',
    points: ['One-tap AI video', 'Auto captions & hashtags', 'Background swap'],
    // The create step is the one a seller does standing up with a phone in
    // their hand, so it is the honest place to offer the app: tap it here and
    // the phone's own install flow takes over. It is a client island inside an
    // otherwise server-rendered page, and it renders nothing at all once the
    // app is already installed.
    cta: (
      <div className="mt-6 rounded-xl border border-border bg-secondary/40 p-4">
        <p className="text-sm font-semibold text-foreground">
          Doing this on your phone? Get the app.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          The seller app opens straight into your stock, orders and AI Studio —
          no browser tabs, no website menus.
        </p>
        <InstallAppButton
          label="Download the application"
          className="mt-3 h-10 rounded-xl border-primary/40 px-4 font-semibold"
        />
      </div>
    ),
  },
  {
    n: '02',
    icon: Store,
    title: 'Open the storefront',
    body:
      'Your business page goes live with a verified badge, your catalogue, your location and your contact channels. One link you can put anywhere — Instagram, WhatsApp, a printed flyer.',
    points: ['ID-verified badge', 'Unlimited catalogue', 'One shareable link'],
  },
  {
    n: '03',
    icon: Package,
    title: 'Sell, fulfil, get paid',
    body:
      'Orders, bookings and requests land in one inbox. Payment is held in escrow and released the moment delivery is confirmed, then split automatically between you, your reseller and Vidnov.',
    points: ['Escrow-backed orders', 'Automatic splits', 'Tracked delivery'],
  },
] as const;

const BENTO = [
  {
    icon: Sparkles,
    grad: 'vn-grad-coral',
    span: 'lg:col-span-2',
    title: 'AI Studio',
    body:
      'Write the caption, generate the video, resize it for every surface. The whole creative pipeline for a product, in one screen, in about ninety seconds.',
    stat: '90s',
    statLabel: 'average time to publish',
  },
  {
    icon: Repeat,
    grad: 'vn-grad-ocean',
    span: '',
    title: 'Request Marketplace',
    body: 'Post what you need. Local sellers and resellers bid for it. Stop chasing quotes in DMs.',
  },
  {
    icon: Radio,
    grad: 'vn-grad-violet',
    span: '',
    title: 'Go live',
    body: 'Broadcast a drop, a demo or an open day and take orders while you talk.',
  },
  {
    icon: Boxes,
    grad: 'vn-grad-ember',
    span: '',
    title: 'Reseller network',
    body: 'Let other people sell your catalogue and earn a cut automatically, tracked per order.',
  },
  {
    icon: CreditCard,
    grad: 'vn-grad-forest',
    span: '',
    title: 'Escrow payments',
    body: 'Money moves only when the buyer confirms. No chargebacks out of your pocket.',
  },
] as const;

/**
 * The settlement split, straight from `processOrderAndDistributeEarnings`.
 * A 100.00 listing becomes a 116.00 charge; every peso of it is accounted for.
 */
const SPLIT = [
  { label: 'You', value: 79, color: 'hsl(var(--primary))', note: 'Net, after all fees' },
  { label: 'Vidnov', value: 10, color: 'hsl(var(--accent))', note: 'Platform fee' },
  { label: 'Reseller', value: 10, color: 'hsl(var(--vn-violet))', note: 'Optional commission' },
  { label: 'Referrer', value: 1, color: 'hsl(var(--vn-amber))', note: 'One-off bonus' },
  { label: 'VAT', value: 16, color: 'hsl(var(--muted-foreground))', note: 'Collected for the state' },
] as const;

const MARQUEE = [
  'AI STUDIO', 'ESCROW PAYOUTS', 'LIVE SELLING', 'RESELLER NETWORK',
  'VERIFIED BUSINESSES', 'REQUEST MARKETPLACE', 'TRACKED DELIVERY', 'ONE-TAP LISTING',
] as const;

const VOICES = [
  {
    quote:
      'I went from posting to a WhatsApp group to running a storefront that takes orders while I sleep. The escrow is what made me trust it — the money is not a promise, it is a process.',
    name: 'Amina N.',
    role: 'Apparel seller · Mombasa',
    grad: 'vn-grad-coral',
  },
  {
    quote:
      'The AI Studio did in an afternoon what used to cost me a photographer and a week. I list faster than my competitors can reply.',
    name: 'Brian K.',
    role: 'Electronics · Eldoret',
    grad: 'vn-grad-ocean',
  },
  {
    quote:
      'I resell for two brands and the commission shows up per order without me reconciling anything at the end of the month. That alone was worth switching.',
    name: 'Wanjiru M.',
    role: 'Reseller · Nairobi',
    grad: 'vn-grad-violet',
  },
] as const;

const FAQS = [
  {
    q: 'What does it cost to start?',
    a: 'Opening a business and listing your first product is free. You are only charged when you actually make a sale, and the fee is a flat 10% of the product price, shown to you on every order before the buyer pays.',
  },
  {
    q: 'When do I actually get my money?',
    a: 'When you list, the buyer is charged and the money is held in escrow. It is released to your wallet when the order is marked delivered and the buyer confirms. From there it goes through your payout method like any other withdrawal.',
  },
  {
    q: 'Do I need a reseller?',
    a: 'No. Resellers are entirely optional. If you want other people to sell for you, you switch it on and they earn 10% of each order they bring, deducted automatically and itemised on your statement.',
  },
  {
    q: 'What is the Request Marketplace?',
    a: 'A board where buyers post what they are looking for and sellers bid for the work. It is the difference between chasing a quote in a chat thread and having every offer arrive with a price attached.',
  },
  {
    q: 'Is the business identity verified?',
    a: 'Yes. Verification is a one-time ID check that earns a badge on your storefront. Buyers can see it, and it is the single strongest signal that a listing is not a scam.',
  },
  {
    q: 'Can I buy a better badge?',
    a: 'No. The tier badge is counted from your delivered orders and calculated by the platform — there is no price, no code and no person who can raise it. We can give you a promotional credit or a fee waiver on top of your real tier, but those are recorded separately and never change the badge itself.',
  },
  {
    q: 'What happens if I have a quiet month?',
    a: 'Your badge stays. Tiers only ever go up, because a badge that disappears teaches you the work was not real. If something genuinely has to be corrected, a person does it and it is visible — it is never a side effect of a monthly calculation.',
  },
  {
    q: 'Does it work on a phone?',
    a: 'Vidnov installs to your home screen as an app. It runs the same storefront and the same catalogue as the website, with a mobile layout built for shooting, listing and checking orders on the move.',
  },
] as const;

/* ── Section shells ────────────────────────────────────────────────────── */

/* ── Trust ────────────────────────────────────────────────────────────── */

/**
 * THE LADDER IS READ FROM THE CODE, NOT TYPED AGAIN.
 *
 * `TIER_THRESHOLDS` is the same array the badge itself is computed from, so
 * this page cannot end up promising Gold at 20 while the platform awards it at
 * 15. A marketing page that quietly disagrees with the product is worse than
 * one that says less — it is the exact failure the automatic badge exists to
 * prevent, aimed at us instead of at a seller.
 */
const TRUST_MARKS = [
  {
    icon: ShieldCheck,
    grad: 'vn-grad-ocean',
    who: 'A person',
    title: 'The verified tick',
    body:
      'Someone looked at your ID and your permit and said yes. It is a human decision, it takes an application, and it is the only mark on this page you can apply for.',
  },
  {
    icon: Zap,
    grad: 'vn-grad-ember',
    who: 'Arithmetic',
    title: 'The tier badge',
    body:
      'Counted from delivered orders and nothing else. Nobody approves it, nobody can buy it, and no moderator can hand it to you — which is exactly why a buyer can rely on it.',
  },
] as const;

const TRUST_RULES = [
  {
    t: 'Only delivered orders count',
    d: 'An order that is still pending is an intention to buy, not a sale. Counting it would put a Gold badge on people for money that never arrived.',
  },
  {
    t: 'Nobody sells a badge',
    d: 'Not staff, not support, not a promotion. There is no field to type a tier into, anywhere, on purpose.',
  },
  {
    t: 'It only ever goes up',
    d: 'A quiet month does not take your badge away. Reversals are handled by a person, visibly, not as a side effect of a query.',
  },
  {
    t: 'Buying counts too',
    d: 'You are rewarded for both sides of the platform. Twenty completed transactions earns the same badge whichever side of them were yours.',
  },
] as const;

const LOCAL_POINTS = [
  {
    icon: MapPin,
    t: 'Nearby ranks by coverage, not luck',
    d: 'A barber in Kasarani is not a result for someone in Mombasa. Matching asks whether you serve their area, and only measures distance when it can.',
  },
  {
    icon: Home,
    t: 'Home businesses count',
    d: 'A tailor working from their living room, a tutor who travels to you, a plumber with a van — they appear in results without ever publishing an address.',
  },
  {
    icon: Lock,
    t: 'Your location is never handed to a seller',
    d: 'A business is told the area you are in, never where you are. Your exact point never enters a request, so it cannot leak into a log.',
  },
] as const;

const REVIEW_RULES = [
  {
    t: 'Only people who bought can review',
    d: 'A review needs a completed order behind it, so the number is a record of transactions rather than an opinion poll.',
  },
  {
    t: 'One rating, one meaning',
    d: 'The shop page, the app and the nearby list all read the same reviews. Half a star is shown as half a star, never rounded up to sound better.',
  },
  {
    t: 'Sellers answer',
    d: 'Every review can be replied to in public. A business that answers the bad ones is doing more for its buyers than a five-star average.',
  },
] as const;

function SectionHeading({
  eyebrow,
  title,
  lede,
  align = 'center',
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: string;
  align?: 'center' | 'left';
}) {
  return (
    <div
      className={
        align === 'center'
          ? 'mx-auto max-w-3xl text-center'
          : 'max-w-2xl text-left'
      }
    >
      <span className="vn-phase text-primary">{eyebrow}</span>
      <h2 className="vn-display mt-4 text-balance text-4xl text-foreground sm:text-5xl lg:text-6xl">
        {title}
      </h2>
      {lede && (
        <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          {lede}
        </p>
      )}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function VidnovHomePage() {
  return (
    <LandingLayout>
      {/* ══════════════════════ HERO ══════════════════════ */}
      <section className="relative overflow-hidden">
        <div className="vn-aurora pointer-events-none absolute inset-0" aria-hidden />

        {/* fine grid, for texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          aria-hidden
          style={{
            backgroundImage:
              'linear-gradient(to right, hsl(var(--border) / 0.5) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.5) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(70% 60% at 50% 40%, #000 0%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(70% 60% at 50% 40%, #000 0%, transparent 100%)',
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
          <div className="grid items-center gap-14 py-16 md:py-24 lg:grid-cols-12 lg:gap-10 lg:py-28">
            {/* Copy */}
            <div className="lg:col-span-6">
              <Link
                href="/app"
                className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur vn-transition hover:border-primary/40 hover:text-foreground"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                The Vidnov app is live
                <ChevronRight className="h-3 w-3 vn-transition group-hover:translate-x-0.5" />
              </Link>

              <h1 className="vn-display mt-7 text-balance text-[2.6rem] leading-[0.95] text-foreground sm:text-6xl lg:text-7xl">
                Your business,
                <br />
                <span className="vn-text-grad">open for business.</span>
              </h1>

              <p className="mt-7 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
                Vidnov gives a real business a real storefront, a creative studio
                and a payment rail that actually settles. Make the content, list
                the product, take the order, get paid — without a website, a
                marketing agency or an accountant.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="h-12 rounded-xl px-8 text-sm font-semibold">
                  <Link href={SELL}>
                    Start selling free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-8 text-sm font-semibold">
                  <Link href={LOGIN}>Sign in</Link>
                </Button>
              </div>

              <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                {['No listing fee', '10% only when you sell', 'Cancel anytime'].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    {t}
                  </span>
                ))}
              </p>
            </div>

            {/* Composer mock — the product's defining screen */}
            <div className="lg:col-span-6">
              <div className="relative mx-auto max-w-md">
                <div
                  className="absolute -inset-8 rounded-[2.5rem] bg-gradient-to-br from-primary/20 via-accent/10 to-transparent blur-3xl"
                  aria-hidden
                />

                <div className="vn-shadow relative rounded-3xl border border-border bg-card/85 p-2 backdrop-blur-xl">
                  {/* window chrome */}
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <div className="flex gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                      <span className="h-2.5 w-2.5 rounded-full bg-ember-amber/70" />
                      <span className="h-2.5 w-2.5 rounded-full bg-ember-green/70" />
                    </div>
                    <span className="ml-2 text-[11px] font-medium text-muted-foreground">
                      AI Studio · new product
                    </span>
                    <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
                      Draft
                    </span>
                  </div>

                  {/* preview canvas */}
                  <div className="relative mx-2 overflow-hidden rounded-2xl bg-gradient-to-br from-ember-navy to-ember-navy p-5">
                    <div className="absolute inset-0 vn-aurora opacity-70" aria-hidden />
                    <div className="relative space-y-3">
                      <div className="flex aspect-video items-center justify-center rounded-xl border border-white/10 bg-black/25">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 shadow-lg shadow-primary/30">
                          <Video className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <div className="h-2.5 w-3/4 rounded-full bg-white/25" />
                      <div className="h-2.5 w-1/2 rounded-full bg-white/15" />
                      <div className="flex gap-2 pt-1">
                        {['9:16', '1:1', '16:9'].map((r, i) => (
                          <span
                            key={r}
                            className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
                              i === 0 ? 'bg-primary text-white' : 'bg-white/10 text-white/70'
                            }`}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* job rows */}
                  <div className="space-y-1.5 p-2.5">
                    {[
                      { icon: Video, label: 'Product video', state: 'Ready', tone: 'text-ember-green' },
                      { icon: MessageSquare, label: 'Caption & hashtags', state: 'Ready', tone: 'text-ember-green' },
                      { icon: Megaphone, label: 'Paid ad variant', state: 'Rendering', tone: 'text-accent' },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/60 px-3 py-2.5"
                      >
                        <row.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {row.label}
                        </span>
                        <span className={`text-[11px] font-semibold ${row.tone}`}>
                          {row.state}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="px-2.5 pb-2.5">
                    <div className="flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25">
                      Publish listing
                    </div>
                  </div>
                </div>

                {/* floating order chip */}
                <div className="vn-float absolute -bottom-6 -left-4 hidden w-52 rounded-2xl border border-border bg-card/95 p-3.5 shadow-xl backdrop-blur sm:block">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ember-green/15 text-ember-green">
                      <Wallet className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">
                        Order #4F2A paid
                      </p>
                      <p className="text-[11px] text-muted-foreground">just now</p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between border-t border-border pt-2.5">
                    <span className="text-[11px] text-muted-foreground">Your cut</span>
                    <span className="font-grotesk text-sm font-bold text-ember-green">
                      79.00
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* stat strip */}
        <div className="relative border-y border-border bg-card/40 backdrop-blur">
          <dl className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-border px-4 lg:grid-cols-4 lg:px-8">
            {[
              ['10%', 'flat platform fee'],
              ['79%', 'of a 100.00 sale is yours'],
              ['0', 'listing or monthly fees'],
              ['24/7', 'your storefront is open'],
            ].map(([big, small]) => (
              <div key={small} className="px-4 py-7 text-center lg:px-6">
                <dt className="font-grotesk text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
                  {big}
                </dt>
                <dd className="mt-1.5 text-xs leading-snug text-muted-foreground">
                  {small}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ══════════════════════ MARQUEE ══════════════════════ */}
      <section className="overflow-hidden border-b border-border bg-background py-5" aria-hidden>
        <div className="vn-marquee flex w-max gap-10 whitespace-nowrap">
          {[...MARQUEE, ...MARQUEE].map((word, i) => (
            <span
              key={`${word}-${i}`}
              className="flex items-center gap-10 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground/70"
            >
              {word}
              <span className="h-1 w-1 rounded-full bg-primary" />
            </span>
          ))}
        </div>
      </section>

      {/* ══════════════════════ THE THREE STEPS ══════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 py-20 md:py-28 lg:px-8">
        <SectionHeading
          eyebrow="How it works"
          title={
            <>
              From a photo on your phone
              <br className="hidden sm:block" /> to money in your wallet
            </>
          }
          lede="Three steps, and none of them need a website, a designer or a business degree."
        />

        <div className="relative mt-16">
          {/* connector rail */}
          <div
            className="absolute left-[27px] top-0 hidden h-full w-px bg-gradient-to-b from-primary/50 via-border to-transparent lg:left-0 lg:top-[27px] lg:h-px lg:w-full lg:bg-gradient-to-r lg:from-primary/50 lg:via-border lg:to-transparent"
            aria-hidden
          />

          <ol className="grid gap-10 lg:grid-cols-3 lg:gap-8">
            {STEPS.map((step) => (
              <li key={step.n} className="relative flex gap-5 lg:block">
                <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-card font-grotesk text-lg font-bold text-primary vn-shadow">
                  <step.icon className="h-6 w-6" />
                  <span className="absolute -right-1.5 -top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    {step.n}
                  </span>
                </div>

                <div className="min-w-0 lg:mt-6">
                  <h3 className="font-grotesk text-xl font-semibold tracking-tight text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                  <ul className="mt-5 space-y-2">
                    {step.points.map((p) => (
                      <li
                        key={p}
                        className="flex items-center gap-2 text-sm text-foreground/85"
                      >
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                        {p}
                      </li>
                    ))}
                  </ul>

                  {'cta' in step && step.cta}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ══════════════════════ THE MONEY ══════════════════════ */}
      <section className="relative overflow-hidden border-y border-border bg-card/40">
        <div className="vn-aurora pointer-events-none absolute inset-0 opacity-70" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:py-28 lg:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
            <div>
              <span className="vn-phase text-primary">The money</span>
              <h2 className="vn-display mt-4 text-balance text-4xl text-foreground sm:text-5xl">
                Every shilling,
                <br />
                accounted for.
              </h2>
              <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
                A 100.00 listing becomes a 116.00 charge including VAT. Here is
                exactly where all of it goes — computed live by the same function
                that settles your payouts, not by a marketing page.
              </p>

              <div className="mt-8 space-y-3">
                {[
                  { icon: Lock, t: 'Held until delivery is confirmed', d: 'Buyers cannot release your money early, and you cannot be charged back for goods already in transit.' },
                  { icon: Clock, t: 'Settled automatically', d: 'The split runs the moment an order closes. No spreadsheet, no monthly reconciliation, no chasing.' },
                  { icon: ShieldCheck, t: 'Itemised on every order', d: 'Each party sees their own line, so a reseller commission is never a mystery deduction.' },
                ].map((row) => (
                  <div key={row.t} className="flex gap-3.5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <row.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{row.t}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {row.d}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* waterfall */}
            <div className="vn-shadow rounded-3xl border border-border bg-background/80 p-6 backdrop-blur sm:p-8">
              <div className="flex items-baseline justify-between border-b border-border pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Order breakdown
                  </p>
                  <p className="mt-1 font-grotesk text-sm text-foreground">
                    1 × Product at 100.00
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Charged</p>
                  <p className="font-grotesk text-2xl font-bold text-foreground">116.00</p>
                </div>
              </div>

              <ul className="mt-6 space-y-4">
                {SPLIT.map((row, i) => (
                  <li key={row.label}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: row.color }}
                        />
                        <span
                          className={
                            i === 0
                              ? 'font-semibold text-foreground'
                              : 'text-muted-foreground'
                          }
                        >
                          {row.label}
                        </span>
                      </span>
                      <span
                        className={
                          i === 0
                            ? 'font-grotesk font-bold text-foreground'
                            : 'font-mono text-muted-foreground'
                        }
                      >
                        {row.value.toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(row.value / 116) * 100}%`,
                            backgroundColor: row.color,
                          }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right text-[11px] text-muted-foreground/80">
                        {row.note}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <p className="mt-6 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                Reseller and referrer rows apply only if you use those features.
                Turn both off and the full 90.00 lands with you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ BENTO ══════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 py-20 md:py-28 lg:px-8">
        <SectionHeading
          eyebrow="The toolkit"
          title="Everything a seller touches, in one place"
          lede="Not a feature list. These are the screens you will actually open every day, and they are built to replace three other apps."
        />

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENTO.map((card) => (
            <article
              key={card.title}
              className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-6 vn-transition hover:border-primary/30 hover:shadow-lg ${card.span}`}
            >
              <div
                className={`absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-0 blur-2xl vn-transition group-hover:opacity-25 ${card.grad}`}
                aria-hidden
              />
              <span
                className={`relative flex h-11 w-11 items-center justify-center rounded-xl text-white ${card.grad}`}
              >
                <card.icon className="h-5 w-5" />
              </span>

              <h3 className="relative mt-5 font-grotesk text-lg font-semibold tracking-tight text-foreground">
                {card.title}
              </h3>
              <p className="relative mt-2.5 text-sm leading-relaxed text-muted-foreground">
                {card.body}
              </p>

              {'stat' in card && card.stat && (
                <div className="relative mt-6 flex items-baseline gap-2.5 border-t border-border pt-5">
                  <span className="font-grotesk text-3xl font-bold text-primary">
                    {card.stat}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {card.statLabel}
                  </span>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* ══════════════════════ TRUST ══════════════════════ */}
      <section className="relative overflow-hidden border-y border-border bg-card/40">
        <div className="vn-aurora pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:py-28 lg:px-8">
          <SectionHeading
            eyebrow="Trust"
            title={
              <>
                Two marks. They mean
                <br className="hidden sm:block" /> different things.
              </>
            }
            lede="Most marketplaces show one badge and let you guess how it was earned. We show two, from two different sources, and we tell you which is which."
          />

          <div className="mt-14 grid gap-4 md:grid-cols-2">
            {TRUST_MARKS.map((mark) => (
              <article
                key={mark.title}
                className="group relative overflow-hidden rounded-2xl border border-border bg-background p-8 vn-transition hover:border-primary/30"
              >
                <div
                  className={`absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl vn-transition group-hover:opacity-25 ${mark.grad}`}
                  aria-hidden
                />
                <div className="relative flex items-center gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-white ${mark.grad}`}>
                    <mark.icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full border border-border px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Earned by {mark.who.toLowerCase()}
                  </span>
                </div>
                <h3 className="relative mt-6 font-grotesk text-2xl font-semibold tracking-tight text-foreground">
                  {mark.title}
                </h3>
                <p className="relative mt-3 text-pretty leading-relaxed text-muted-foreground">
                  {mark.body}
                </p>
              </article>
            ))}
          </div>

          {/* The ladder, generated from the tier module. `TierBadge` is a
              client island and renders nothing for an account with no
              history — every tier below has one, so all four appear. */}
          <div className="mt-16">
            <h3 className="text-center font-grotesk text-lg font-semibold tracking-tight text-foreground">
              The tier ladder
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
              Same ladder for sellers and buyers. It fills up as your completed
              transactions do, and there is no ceiling at the top.
            </p>

            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TIER_THRESHOLDS.map((step, i) => (
                <li
                  key={step.tier}
                  className="relative overflow-hidden rounded-2xl border border-border bg-background p-6 vn-transition hover:border-primary/30 hover:shadow-lg"
                >
                  <span className="font-grotesk text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/70">
                    Rung {i + 1}
                  </span>
                  <div className="mt-4">
                    <TierBadge tier={step.tier as AccountTier} size="md" />
                  </div>
                  <p className="mt-5 font-grotesk text-3xl font-bold tabular-nums text-foreground">
                    {step.min}
                    <span className="ml-2 text-xs font-medium text-muted-foreground">
                      completed
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {step.min === 1 ? 'transaction' : 'transactions'}
                  </p>
                  <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
                    {tierMeta(step.tier).detail}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <dl className="mt-14 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {TRUST_RULES.map((rule) => (
              <div key={rule.t} className="flex gap-3">
                <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <dt className="font-grotesk text-[15px] font-semibold text-foreground">
                    {rule.t}
                  </dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {rule.d}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ══════════════════════ FEATURE BULLETS ══════════════════════ */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-4 py-20 md:py-24 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <SectionHeading
                align="left"
                eyebrow="Under the hood"
                title="Built like infrastructure, not a prototype"
                lede="The unglamorous parts are the parts that decide whether a business can depend on you."
              />
              <Button asChild variant="outline" className="mt-8 h-12 rounded-xl">
                <Link href="/how-it-works">
                  See how it works
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="lg:col-span-7">
              <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
                {[
                  { icon: Layers, t: 'One catalogue, everywhere', d: 'The website and the app are the same storefront. Update a price once and it is correct on both.' },
                  { icon: Smartphone, t: 'Installable by default', d: 'Add Vidnov to your home screen and it behaves like a native app, offline-aware and fast.' },
                  { icon: BarChart3, t: 'Live numbers', d: 'Views, saves, orders and revenue update as they happen — not on tomorrow’s report.' },
                  { icon: Truck, t: 'Delivery you can prove', d: 'Tracked hand-offs keep the escrow honest for both sides of the order.' },
                  { icon: Globe, t: 'Local by default', d: 'Discovery is geographic, so a shop in Nakuru competes with a shop in Nakuru, not the whole internet.' },
                  { icon: Zap, t: 'Automations that run', d: 'Order receipts, status changes, payout splits and commission records are all handled for you.' },
                ].map((f) => (
                  <div key={f.t}>
                    <dt className="flex items-center gap-2.5 font-grotesk text-[15px] font-semibold text-foreground">
                      <f.icon className="h-4 w-4 shrink-0 text-accent" />
                      {f.t}
                    </dt>
                    <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {f.d}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ NEARBY & REVIEWS ══════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 py-20 md:py-28 lg:px-8">
        <div className="grid items-start gap-14 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Around you"
              title="The shop on the next street, not the internet"
              lede="Discovery here is geographic. A marketplace where everything competes with everything else is a marketplace where the smallest seller never appears."
            />

            <dl className="mt-10 space-y-7">
              {LOCAL_POINTS.map((p) => (
                <div key={p.t} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <p.icon className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <dt className="font-grotesk text-[15px] font-semibold text-foreground">
                      {p.t}
                    </dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {p.d}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>

            <Button asChild variant="outline" className="mt-9 h-12 rounded-xl">
              <Link href="/login">
                See what is near you
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 vn-shadow">
            <h3 className="font-grotesk text-xl font-semibold tracking-tight text-foreground">
              What a buyer can check before paying
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The same three things, in the same order, on the website and in
              the app — so nothing depends on which screen someone happens to be
              holding.
            </p>

            <ol className="mt-7 space-y-5">
              {[
                { n: '1', t: 'Who they are', d: 'The verified tick, from a document check.' },
                { n: '2', t: 'What they have done', d: 'The tier badge, from delivered orders.' },
                { n: '3', t: 'What buyers said', d: 'Ratings and reviews from completed orders.' },
              ].map((row) => (
                <li key={row.n} className="flex gap-4 border-b border-border pb-5 last:border-0 last:pb-0">
                  <span className="font-grotesk flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">
                    {row.n}
                  </span>
                  <div>
                    <p className="font-grotesk text-sm font-semibold text-foreground">{row.t}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{row.d}</p>
                  </div>
                </li>
              ))}
            </ol>

            <ul className="mt-8 space-y-3 border-t border-border pt-7">
              {REVIEW_RULES.map((r) => (
                <li key={r.t} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">{r.t}. </span>
                    {r.d}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ══════════════════════ VOICES ══════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 py-20 md:py-28 lg:px-8">
        <SectionHeading eyebrow="In use" title="What sellers say" />

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {VOICES.map((v) => (
            <figure
              key={v.name}
              className="flex flex-col rounded-2xl border border-border bg-card p-6 vn-transition hover:border-primary/30 hover:shadow-lg"
            >
              <Quote className="h-6 w-6 text-primary/40" aria-hidden />
              <blockquote className="mt-4 flex-1 text-pretty text-[15px] leading-relaxed text-foreground/90">
                {v.quote}
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-5">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${v.grad}`}
                >
                  {v.name.charAt(0)}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">
                    {v.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {v.role}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ══════════════════════ APP ══════════════════════ */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-4 py-20 md:py-24 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="order-2 lg:order-1">
              <div className="mx-auto flex w-fit items-end gap-3 rounded-[2rem] border border-border bg-background p-3 shadow-xl">
                {/* two phone frames */}
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="w-32 overflow-hidden rounded-[1.5rem] border border-border bg-card sm:w-40"
                  >
                    <div className="flex items-center justify-center bg-background py-1.5">
                      <span className="h-1 w-10 rounded-full bg-muted" />
                    </div>
                    <div className="space-y-2 p-2.5">
                      <div className={`aspect-square rounded-xl ${i === 0 ? 'vn-grad-coral' : 'vn-grad-ocean'}`} />
                      <div className="h-2 w-3/4 rounded-full bg-muted" />
                      <div className="h-2 w-1/2 rounded-full bg-muted/70" />
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        {[0, 1, 2].map((k) => (
                          <div key={k} className="aspect-square rounded-md bg-muted" />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <span className="vn-phase text-primary">On the move</span>
              <h2 className="vn-display mt-4 text-balance text-4xl text-foreground sm:text-5xl">
                Your shop in your pocket
              </h2>
              <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
                Install Vidnov to your home screen and you have the same
                storefront, the same catalogue and the same orders — laid out for a
                phone. Shoot a product, list it and check what sold before you
                have even put the phone down.
              </p>

              <ul className="mt-7 space-y-2.5">
                {[
                  'Shoot and list without leaving the app',
                  'Order notifications that actually arrive',
                  'Works on a patchy connection',
                  'Kept separate from the website session',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm text-foreground/85">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {t}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild className="h-12 rounded-xl">
                  <Link href="/app">
                    Open the app
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-12 rounded-xl">
                  <Link href={SELL}>Create a business</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ FAQ ══════════════════════ */}
      <section className="mx-auto max-w-3xl px-4 py-20 md:py-28 lg:px-8">
        <SectionHeading eyebrow="Questions" title="Before you sign up" />

        <div className="mt-12 divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {FAQS.map((f) => (
            <details key={f.q} className="group bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left text-[15px] font-semibold text-foreground vn-transition hover:bg-muted/50">
                {f.q}
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground vn-transition group-open:rotate-45 group-open:border-primary group-open:text-primary">
                  <span className="relative block h-px w-2.5 bg-current" />
                  <span className="absolute h-2.5 w-px bg-current" />
                </span>
              </summary>
              <div className="px-6 pb-6 text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </div>
            </details>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Still unsure?{' '}
          <Link href="/faq" className="font-medium text-primary underline-offset-4 hover:underline">
            Read the full FAQ
          </Link>
        </p>
      </section>

      {/* ══════════════════════ FINAL CTA ══════════════════════ */}
      <section className="relative overflow-hidden border-t border-border">
        <div className="vn-aurora pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center lg:px-8 md:py-32">
          <LogoMark className="mx-auto h-14 w-14" />
          <h2 className="vn-display mt-7 text-balance text-4xl text-foreground sm:text-5xl lg:text-6xl">
            Open your business
            <br />
            <span className="vn-text-grad">this week.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Free to open. Free to list. You only ever pay when someone buys
            something, and then it is a single flat number you can see before
            they pay it.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-xl px-8 text-sm font-semibold">
              <Link href={SELL}>
                Start selling free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-8 text-sm font-semibold">
              <Link href={LOGIN}>I already have an account</Link>
            </Button>
          </div>

          <p className="mt-8 text-xs text-muted-foreground">
            Signing up takes about a minute ·{' '}
            <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
              Terms
            </Link>{' '}
            ·{' '}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
              Privacy
            </Link>
          </p>
        </div>
      </section>
    </LandingLayout>
  );
}
