'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, Check, Search, Sparkles, Video, Store, MapPin, Wrench,
  ShoppingBag, Clapperboard, Wand2, Images, Film, Layers, Tag, Radio,
  ShieldCheck, Lock, BadgePercent, Flag, HandHeart, Megaphone, Package,
  Truck, BarChart3, MessageSquare, Palette, Camera, GraduationCap,
  Loader2, Heart, Eye, Inbox,
} from 'lucide-react';

import { LandingLayout } from '@/components/layout/landing-layout';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/logo';
import { useUser, useUserProfile, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ROLE_HOME, resolveRole } from '@/lib/auth/roles';
import { listingPriceTag, createdMs } from '@/lib/discovery';
import { isService } from '@/components/listings/service-badge';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import type { Product, SellerShop } from '@/lib/types';

/**
 * VIDNOV HOME — Create. Discover. Sell. Grow.
 *
 * The page answers three questions in order: what can I discover here
 * (the live marketplace below), what can I create or sell (AI Studio and
 * the launchpad), and how does that become real (escrow, verification, one
 * honest fee line).
 *
 * Everything below the hero is REAL data read from the platform itself —
 * products, shops and help articles from Firestore, filtered client-side.
 * No invented products, sellers, quotes, ratings or viewer counts anywhere.
 * The only money claim on the page is the platform's actual pricing: free
 * to start, 3% only when you sell. Nothing else — a visitor who has to
 * parse a fee waterfall before understanding the product never gets to
 * the product.
 */

/* ── Static, truthful content ─────────────────────────────────────────── */

const QUICK_ACTIONS = [
  { label: 'Create a video', href: '/ai-studio', icon: Video },
  { label: 'Design a poster', href: '/app/seller/studio', icon: Palette },
  { label: 'Launch a shop', href: '/signup?role=seller', icon: Store },
  { label: 'Find a service', href: '/buyer/discovery', icon: Wrench },
  { label: 'Start selling', href: '/signup?role=seller', icon: Tag },
] as const;

const AI_TOOLS = [
  { name: 'Text → Video', body: 'Describe a scene, get a cinematic clip for your listing or ad.', icon: Clapperboard, grad: 'vn-grad-coral' },
  { name: 'Image → Video', body: 'Animate a product photo into a slow commercial camera move.', icon: Film, grad: 'vn-grad-ocean' },
  { name: 'Text → Image', body: 'Studio-grade images for ads, listings and social posts.', icon: Wand2, grad: 'vn-grad-violet' },
  { name: 'Image → Image', body: 'New backgrounds, variations and ad layouts from one photo.', icon: Images, grad: 'vn-grad-ember' },
] as const;

const LAUNCH_STEPS = [
  { n: '01', title: 'Create a shop', body: 'Your public storefront with a verified badge, catalogue and contacts.', href: '/signup?role=seller', icon: Store },
  { n: '02', title: 'Add products or services', body: 'Photos, video, price and stock — from phone or desktop.', href: '/dashboard/products', icon: Package },
  { n: '03', title: 'Generate promo material', body: 'AI Studio turns a product photo into video, captions and ad variants.', href: '/ai-studio', icon: Sparkles },
  { n: '04', title: 'Share your listings', body: 'One link per product for WhatsApp, Instagram or your status.', href: '/dashboard/seller/share', icon: Megaphone },
  { n: '05', title: 'Answer enquiries', body: 'Buyer questions and requests land in one inbox.', href: '/messages', icon: MessageSquare },
  { n: '06', title: 'Track orders', body: 'Escrow-held payments release the moment delivery is confirmed.', href: '/dashboard/seller/orders', icon: BarChart3 },
] as const;

const TRUST_POINTS = [
  { icon: ShieldCheck, title: 'Verified sellers', body: 'A human reviews every ID and permit behind the tick.' },
  { icon: Lock, title: 'Escrow payments', body: 'Money is held until delivery is confirmed — both sides protected.' },
  { icon: BadgePercent, title: 'One fee, one line', body: 'Free to start. 3% only when you sell. No listing or monthly fees.' },
  { icon: Flag, title: 'Everything is reportable', body: 'Every listing, seller and order has a reporting path.' },
] as const;

const DISCOVERY_TABS = [
  { id: 'for-you', label: 'For You' },
  { id: 'nearby', label: 'Nearby' },
  { id: 'products', label: 'Products' },
  { id: 'services', label: 'Services' },
  { id: 'learn', label: 'Learn' },
] as const;

type DiscoveryTabId = (typeof DISCOVERY_TABS)[number]['id'];

/* ── Shared bits ──────────────────────────────────────────────────────── */

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
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl text-left'}>
      <span className="vn-phase text-primary">{eyebrow}</span>
      <h2 className="vn-display mt-4 text-balance text-3xl text-foreground sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {lede && (
        <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
          {lede}
        </p>
      )}
    </div>
  );
}

/* ── Product card (real listings only) ────────────────────────────────── */

function HomeProductCard({
  product,
  shop,
  saved,
  onSave,
}: {
  product: Product;
  shop?: SellerShop;
  saved: boolean;
  onSave: (product: Product, next: boolean) => void;
}) {
  const tag = listingPriceTag(product);
  const cover =
    product.thumbnailUrls?.[0] ||
    product.imageUrl ||
    getPlaceholderImage();

  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-card vn-transition hover:border-primary/40 hover:shadow-lg">
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <img
          src={cover}
          alt={product.name || 'Product'}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            const el = e.currentTarget;
            if (el.dataset.fallbackApplied === 'true') return;
            el.dataset.fallbackApplied = 'true';
            el.src = getPlaceholderImage();
          }}
        />
        {isService(product) && (
          <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            Service
          </span>
        )}
        <button
          type="button"
          onClick={() => onSave(product, !saved)}
          aria-label={saved ? 'Remove from saved' : 'Save listing'}
          aria-pressed={saved}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur vn-transition hover:bg-black/80"
        >
          <Heart className={`h-4 w-4 ${saved ? 'fill-primary text-primary' : ''}`} />
        </button>
      </div>

      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
            {product.name || 'Untitled listing'}
          </h3>
          <p className="shrink-0 text-sm font-bold text-primary">
            {tag.quote ? tag.primary : `${tag.primary}${tag.secondary ?? ''}`}
          </p>
        </div>

        {shop && (
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <Store className="h-3 w-3 shrink-0" />
            <span className="truncate">{shop.shopName}</span>
            {shop.isVerified && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                <Check className="h-2.5 w-2.5" /> Verified
              </span>
            )}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <Link
            href={`/products/${product.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-foreground vn-transition hover:text-primary"
          >
            <Eye className="h-3.5 w-3.5" /> View product
          </Link>
          {product.location && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" /> {product.location}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/* ── Discovery band (real Firestore data) ─────────────────────────────── */

function DiscoveryBand() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const { toast } = useToast();
  const router = useRouter();

  const [tab, setTab] = React.useState<DiscoveryTabId>('for-you');
  // Client-only rendering: price strings are locale-formatted, and the server
  // locale is not the browser's. Skeletons until mount avoid the mismatch.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const productsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'products') : null),
    [firestore],
  );
  const shopsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'sellerShops') : null),
    [firestore],
  );
  const helpQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'helpArticles') : null),
    [firestore],
  );

  const { data: products, isLoading: loadingProducts, error: productsError } =
    useCollection<Product>(productsQuery);
  const { data: shops } = useCollection<SellerShop>(shopsQuery);
  const { data: helpArticles } = useCollection<{
    id: string;
    question?: string;
    title?: string;
    answer?: string;
    category?: string;
  }>(helpQuery);

  const shopBySeller = React.useMemo(() => {
    const map = new Map<string, SellerShop>();
    for (const shop of shops ?? []) map.set(shop.sellerId, shop);
    return map;
  }, [shops]);

  const newest = React.useMemo(() => {
    const rows = [...(products ?? [])];
    rows.sort((a, b) => createdMs(b) - createdMs(a));
    return rows;
  }, [products]);

  const visible = React.useMemo(() => {
    switch (tab) {
      case 'nearby':
        return newest.filter((p) => (p.location || p.vendorLocation || p.serviceArea || '').trim() !== '').slice(0, 8);
      case 'products':
        return newest.filter((p) => !isService(p)).slice(0, 8);
      case 'services':
        return newest.filter((p) => isService(p)).slice(0, 8);
      case 'for-you':
      default:
        return newest.slice(0, 8);
    }
  }, [newest, tab]);

  const savedIds = React.useMemo(
    () => new Set((userProfile as { wishlist?: string[] })?.wishlist ?? []),
    [userProfile],
  );

  const handleSave = React.useCallback(
    async (product: Product, next: boolean) => {
      if (!user || !firestore) {
        toast({
          title: 'Sign in to save',
          description: 'Saving keeps listings ready for you in your wishlist.',
        });
        router.push('/login?returnTo=/');
        return;
      }
      try {
        await updateDoc(doc(firestore, 'userProfiles', user.uid), {
          wishlist: next ? arrayUnion(product.id) : arrayRemove(product.id),
        });
        toast({ title: next ? 'Saved' : 'Removed from saved' });
      } catch {
        toast({ variant: 'destructive', title: 'Could not update saved items' });
      }
    },
    [user, firestore, toast, router],
  );

  const emptyCopy: Record<DiscoveryTabId, { title: string; body: string }> = {
    'for-you': { title: 'The marketplace is just opening', body: 'Be the first to list something real.' },
    nearby: { title: 'Nothing nearby yet', body: 'Listings with a location appear here. Set yours when you open a shop.' },
    products: { title: 'No products listed yet', body: ' Sellers publish products from their dashboard — yours could be first.' },
    services: { title: 'No services listed yet', body: 'Photographers, tailors, designers and repairers can list their trade here.' },
    learn: { title: 'No help articles yet', body: 'The full help centre is always available.' },
  };

  return (
    <section id="discover" className="mx-auto max-w-7xl px-4 py-20 md:py-24 lg:px-8">
      <SectionHeading
        eyebrow="Discover"
        title="Real listings, right now"
        lede="Products, services and shops straight from the marketplace. No staged photos of a business that does not exist."
      />

      <div
        role="tablist"
        aria-label="Discovery filters"
        className="mt-10 flex flex-wrap justify-center gap-2"
      >
        {DISCOVERY_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold vn-transition ${
              tab === t.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-8" role="tabpanel" aria-label={DISCOVERY_TABS.find((t) => t.id === tab)?.label}>
        {tab === 'learn' ? (
          <div className="grid gap-4 md:grid-cols-3">
            {(helpArticles ?? []).slice(0, 6).map((article) => (
              <Link
                key={article.id}
                href="/faq"
                className="rounded-2xl border border-border bg-card p-5 vn-transition hover:border-primary/40"
              >
                <GraduationCap className="h-5 w-5 text-primary" aria-hidden />
                <h3 className="mt-3 text-sm font-semibold text-foreground">
                  {article.question || article.title || 'Help article'}
                </h3>
                {article.answer && (
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {article.answer}
                  </p>
                )}
                {article.category && (
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {article.category}
                  </p>
                )}
              </Link>
            ))}
            {!mounted || loadingProducts ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="vn-skeleton h-40 rounded-2xl" aria-hidden />
              ))
            ) : null}
            {mounted && (helpArticles ?? []).length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center">
                <p className="text-sm font-semibold text-foreground">{emptyCopy.learn.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{emptyCopy.learn.body}</p>
                <Button asChild variant="outline" className="mt-5">
                  <Link href="/faq">Open the help centre</Link>
                </Button>
              </div>
            )}
          </div>
        ) : !mounted || (loadingProducts && !products) ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="vn-skeleton aspect-[4/5] rounded-2xl" />
            ))}
          </div>
        ) : productsError ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-foreground">The marketplace could not be loaded</p>
            <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
            <Button asChild variant="outline" className="mt-5" onClick={() => router.refresh()}>
              Retry
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-foreground">{emptyCopy[tab].title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{emptyCopy[tab].body}</p>
            <Button asChild variant="outline" className="mt-5">
              <Link href={tab === 'services' ? '/signup?role=seller' : '/buyer/discovery'}>
                {tab === 'services' ? 'Offer a service' : 'Open full discovery'}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {visible.map((product) => (
              <HomeProductCard
                key={product.id}
                product={product}
                shop={shopBySeller.get(product.sellerId)}
                saved={savedIds.has(product.id)}
                onSave={handleSave}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-10 text-center">
        <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-8 text-sm font-semibold">
          <Link href="/buyer/discovery">
            Open the full discovery feed
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

/* ── Personalised shortcuts ───────────────────────────────────────────── */

function PersonalisedRow() {
  const { user } = useUser();
  const { userProfile, isLoading } = useUserProfile(user?.uid);

  if (isLoading || !user) return null;
  const role = resolveRole(userProfile);

  const links: { label: string; href: string; icon: React.ElementType }[] | null =
    role === 'seller' || role === 'reseller'
      ? [
          { label: 'My shop', href: '/dashboard/seller', icon: Store },
          { label: 'Products', href: '/dashboard/products', icon: Package },
          { label: 'Orders', href: '/dashboard/seller/orders', icon: Truck },
          { label: 'Messages', href: '/messages', icon: MessageSquare },
          { label: 'Analytics', href: '/dashboard/seller/analytics', icon: BarChart3 },
        ]
      : role === 'buyer'
        ? [
            { label: 'Discover', href: '/buyer/discovery', icon: Search },
            { label: 'Saved', href: '/buyer/wishlist', icon: Heart },
            { label: 'My orders', href: '/buyer/my-orders', icon: Package },
            { label: 'Wallet', href: '/buyer/wallet', icon: Lock },
            { label: 'Messages', href: '/messages', icon: MessageSquare },
          ]
        : null;

  if (!links) return null;

  return (
    <div className="mx-auto mt-10 max-w-7xl px-4 lg:px-8">
      <ul className="flex flex-wrap justify-center gap-2.5">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground vn-transition hover:border-primary/50 hover:text-primary"
            >
              <link.icon className="h-3.5 w-3.5" aria-hidden />
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function VidnovHomePage() {
  const router = useRouter();
  const [idea, setIdea] = React.useState('');

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = idea.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <LandingLayout>
      {/* ══════════════════════ HERO ══════════════════════ */}
      <section className="relative overflow-hidden bg-ember-navy text-white">
        <div className="vn-aurora pointer-events-none absolute inset-0" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          aria-hidden
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
            maskImage: 'radial-gradient(65% 55% at 50% 35%, #000 0%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(65% 55% at 50% 35%, #000 0%, transparent 100%)',
          }}
        />

        <div className="relative mx-auto max-w-5xl px-4 py-20 text-center md:py-28 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70 backdrop-blur">
            <LogoMark className="h-3.5 w-3.5" />
            Create · Discover · Sell · Grow
          </span>

          <h1 className="vn-display mx-auto mt-8 max-w-4xl text-balance text-[2.75rem] leading-[0.95] sm:text-6xl lg:text-7xl">
            Your ideas deserve
            <br />
            <span className="vn-text-grad">to earn.</span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-pretty text-base leading-relaxed text-white/70 sm:text-lg">
            Discover products, create powerful content, launch your shop, and connect
            with customers — all in one place.
          </p>

          {/* The one box that runs the platform */}
          <form onSubmit={submitSearch} role="search" className="mx-auto mt-10 max-w-2xl">
            <label htmlFor="hero-search" className="sr-only">
              What do you want to create, sell, or find?
            </label>
            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-2 pl-5 backdrop-blur-xl vn-transition focus-within:border-primary/70">
              <Search className="h-5 w-5 shrink-0 text-white/60" aria-hidden />
              <input
                id="hero-search"
                type="search"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="What do you want to create, sell, or find?"
                className="h-12 w-full min-w-0 bg-transparent text-base text-white placeholder:text-white/50 focus:outline-none"
              />
              <Button
                type="submit"
                className="h-12 shrink-0 rounded-xl px-5 text-sm font-semibold"
              >
                Search
              </Button>
            </div>
          </form>

          {/* Quick actions — every one lands on a real feature */}
          <ul className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            {QUICK_ACTIONS.map((action) => (
              <li key={action.label}>
                <Link
                  href={action.href}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/85 backdrop-blur vn-transition hover:border-primary/60 hover:bg-primary/15 hover:text-white"
                >
                  <action.icon className="h-4 w-4 text-primary" aria-hidden />
                  {action.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* The whole pricing story, one line */}
          <p className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/60">
            {['Free to start', '3% only when you sell', 'Escrow-protected payments'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-primary" />
                {t}
              </span>
            ))}
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-xl bg-primary px-8 text-sm font-semibold text-white hover:bg-primary/90"
            >
              <Link href="/signup?role=seller">
                Start selling free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-xl border-white/20 bg-transparent px-8 text-sm font-semibold text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
        </div>

        <PersonalisedRow />
        <div className="h-12" aria-hidden />
      </section>

      {/* ══════════════════════ DISCOVERY (real data) ══════════════════════ */}
      <DiscoveryBand />

      {/* ══════════════════════ AI STUDIO ══════════════════════ */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-4 py-20 md:py-24 lg:px-8">
          <SectionHeading
            eyebrow="Create"
            title="Make the content before you make the sale"
            lede="AI Studio turns a sentence or a product photo into video, images and ad variants. The credit cost is shown before anything is generated — nothing is spent blind."
          />

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AI_TOOLS.map((tool) => (
              <Link
                key={tool.name}
                href="/ai-studio"
                className="group relative overflow-hidden rounded-2xl border border-border bg-background p-6 vn-transition hover:border-primary/40 hover:shadow-lg"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-white ${tool.grad}`}>
                  <tool.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-5 font-grotesk text-lg font-semibold tracking-tight text-foreground">
                  {tool.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tool.body}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  Open in AI Studio
                  <ArrowRight className="h-3.5 w-3.5 vn-transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-xl px-8 text-sm font-semibold">
              <Link href="/ai-studio">
                <Sparkles className="mr-2 h-4 w-4" />
                Open AI Studio
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-8 text-sm font-semibold">
              <Link href="/app/seller/studio">
                <Camera className="mr-2 h-4 w-4" />
                Classic Studio — edit photos
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ══════════════════════ MARKETPLACE ══════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 py-20 md:py-24 lg:px-8">
        <SectionHeading
          eyebrow="Sell & buy"
          title="One marketplace, every kind of listing"
          lede="Physical goods, digital products, creative services and live streams — all through the same search, the same checkout and the same escrow."
        />

        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {PRODUCT_CATEGORIES.slice(0, 8).map((category) => (
            <Link
              key={category}
              href={`/search?q=${encodeURIComponent(category)}`}
              className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground vn-transition hover:border-primary/40 hover:text-foreground"
            >
              {category}
            </Link>
          ))}
          <Link
            href="/categories"
            className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary vn-transition hover:bg-primary/20"
          >
            All categories
          </Link>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Link
            href="/requests"
            className="rounded-2xl border border-border bg-card p-6 vn-transition hover:border-primary/40"
          >
            <Inbox className="h-6 w-6 text-primary" aria-hidden />
            <h3 className="mt-4 font-grotesk text-lg font-semibold text-foreground">Request marketplace</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Buyers describe what they need; sellers answer with real offers and prices.
              No more chasing quotes in chat threads.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
              Post or answer a request <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </Link>
          <Link
            href="/live"
            className="rounded-2xl border border-border bg-card p-6 vn-transition hover:border-primary/40"
          >
            <Radio className="h-6 w-6 text-primary" aria-hidden />
            <h3 className="mt-4 font-grotesk text-lg font-semibold text-foreground">Live shopping</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Sellers broadcast a drop or a demo and take orders while they talk.
              Watch, ask, buy — from the same screen.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
              See who is live <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </Link>
          <Link
            href="/search"
            className="rounded-2xl border border-border bg-card p-6 vn-transition hover:border-primary/40"
          >
            <Search className="h-6 w-6 text-primary" aria-hidden />
            <h3 className="mt-4 font-grotesk text-lg font-semibold text-foreground">Search everything</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Products, shops and services in one search. Save what you like and
              come back to it from any device.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
              Start searching <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </Link>
        </div>
      </section>

      {/* ══════════════════════ LAUNCHPAD ══════════════════════ */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-4 py-20 md:py-24 lg:px-8">
          <SectionHeading
            eyebrow="Grow"
            title="From an idea to a working shop"
            lede="Six steps, all inside Vidnov. Each one is a real screen you will use — not a promise about a future feature."
          />

          <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LAUNCH_STEPS.map((step) => (
              <li key={step.n}>
                <Link
                  href={step.href}
                  className="group flex h-full flex-col rounded-2xl border border-border bg-background p-6 vn-transition hover:border-primary/40 hover:shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <step.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="font-grotesk text-xs font-bold tracking-widest text-muted-foreground">
                      {step.n}
                    </span>
                  </div>
                  <h3 className="mt-5 font-grotesk text-lg font-semibold tracking-tight text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    Open
                    <ArrowRight className="h-3.5 w-3.5 vn-transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ol>

          <div className="mt-12 text-center">
            <Button asChild size="lg" className="h-12 rounded-xl px-8 text-sm font-semibold">
              <Link href="/signup?role=seller">
                Start selling free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">
              Already sell elsewhere? Bring one product over and see how the escrow
              checkout feels before moving the whole catalogue.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════ CREATORS & SERVICE PROVIDERS ══════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 py-20 md:py-24 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Creators & services"
              title="Sell what you can do, not only what you hold"
              lede="Design, photography, video editing, tailoring, tutoring, repairs — if it is a skill, it is a listing here. Publish an offering, answer real requests, and get paid through the same escrow as a physical product."
            />

            <ul className="mt-8 space-y-3">
              {[
                'List a service with a price, hourly rate or “on request” quote',
                'Answer buyer requests that match your trade',
                'Deliver and get paid through the same protected checkout',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm text-foreground/85">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {t}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-xl px-7 text-sm font-semibold">
                <Link href="/signup?role=seller">
                  <HandHeart className="mr-2 h-4 w-4" />
                  Offer your skill
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-7 text-sm font-semibold">
                <Link href="/requests">See open requests</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Palette, t: 'Designers', d: 'Logos, posters, catalogues — fed straight into Classic Studio.' },
              { icon: Camera, t: 'Photographers', d: 'Product shoots that drop straight into a listing.' },
              { icon: Film, t: 'Video editors', d: 'Turn raw clips into listing videos and ads.' },
              { icon: Wrench, t: 'Trades & repairs', d: 'Plumbers, tailors, technicians with a real service area.' },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl border border-border bg-card p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <c.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-foreground">{c.t}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════ TRUST (compact) ══════════════════════ */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST_POINTS.map((point) => (
              <div key={point.title} className="flex gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <point.icon className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{point.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{point.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════ FINAL CTA ══════════════════════ */}
      <section className="relative overflow-hidden bg-ember-navy text-white">
        <div className="vn-aurora pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-4 py-24 text-center lg:px-8">
          <LogoMark className="mx-auto h-12 w-12" />
          <h2 className="vn-display mt-7 text-balance text-4xl sm:text-5xl">
            Your ideas deserve
            <br />
            <span className="vn-text-grad">to earn.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/70">
            Open a shop in minutes. List something real. The marketplace, the
            studio and the payments are already here.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-xl bg-primary px-8 text-sm font-semibold text-white hover:bg-primary/90"
            >
              <Link href="/signup?role=seller">
                Start selling free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-xl border-white/20 bg-transparent px-8 text-sm font-semibold text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <p className="mt-8 text-xs text-white/50">
            Free to start · 3% only when you sell ·{' '}
            <Link href="/terms" className="underline underline-offset-4 hover:text-white/80">
              Terms
            </Link>{' '}
            ·{' '}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-white/80">
              Privacy
            </Link>
          </p>
        </div>
      </section>
    </LandingLayout>
  );
}
