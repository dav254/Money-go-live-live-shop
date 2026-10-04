'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Award, BadgeCheck, CalendarDays, Clock, Facebook, Globe, Instagram,
  MapPin, MessageSquare, Package, Radio, Rocket, RotateCcw, Share2,
  ShieldCheck, Star, Truck, Twitter, Users, Zap,
} from 'lucide-react';
import { doc, collection, query, where } from 'firebase/firestore';
import {
  useCollection,
  useDoc,
  useFirestore,
  useMemoFirebase,
  useUser,
} from '@/firebase';
import type { LiveSession, Product, SellerShop, UserProfile } from '@/lib/types';
import { SellerCard, SellerSectionTitle, EmptyState } from '@/components/app/seller/seller-app-shell';
import { ListingThumb } from '@/components/app/seller/listing-thumb';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * SELLER APP · MY SHOP (`/app/seller/shop`).
 *
 * ## What this screen is
 *
 * The seller's own storefront, presented in **exactly the format buyers get on
 * the website** (`/sellers/{uid}`): full-bleed hero, circular logo breaking the
 * banner edge, centred name, follower count, trust badges, an action row, and
 * the Products / Videos / Live / About tabs.
 *
 * Earlier versions of this screen invented their own arrangement. That was
 * wrong. A seller does not have two shops to reconcile — they have one, and the
 * only useful version of it is the one buyers actually see. Mirroring the
 * layout means the seller is looking at the real thing, not an app-shaped
 * paraphrase of it, so anything that looks wrong here is genuinely wrong for
 * buyers.
 *
 * ## Where the app still wins
 *
 * Every action stays inside the section. The website's Follow / Message /
 * Share row is replaced by **Live control / Messages / Share shop**, because a
 * seller cannot follow themselves — a Follow button here would be a dead
 * control — while starting a broadcast and reaching a customer are the two
 * things a seller actually opens this screen to do. Share still copies the
 * public storefront link to the clipboard, exactly as the website does.
 *
 * ## Same data, one source of truth
 *
 * The reads are identical to the website storefront — `sellerShops/{uid}`,
 * `userProfiles/{uid}`, `products where sellerId == uid`, `liveSessions/{uid}` —
 * so the two can never disagree about what this shop is.
 */

/* Badge thresholds — identical to `SellerBadges` on the website. */
const POPULAR_SHOP_FOLLOWERS = 10000;
const NEW_SELLER_DAYS = 30;

type Tab = 'products' | 'videos' | 'live' | 'about';

export default function AppSellerShopPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const sellerId = user?.uid;
  const [tab, setTab] = React.useState<Tab>('products');

  const shopRef = useMemoFirebase(() => {
    if (!firestore || !sellerId) return null;
    return doc(firestore, 'sellerShops', sellerId);
  }, [firestore, sellerId]);

  const profileRef = useMemoFirebase(() => {
    if (!firestore || !sellerId) return null;
    return doc(firestore, 'userProfiles', sellerId);
  }, [firestore, sellerId]);

  const liveRef = useMemoFirebase(() => {
    if (!firestore || !sellerId) return null;
    return doc(firestore, 'liveSessions', sellerId);
  }, [firestore, sellerId]);

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !sellerId) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', sellerId));
  }, [firestore, sellerId]);

  const { data: shop } = useDoc<SellerShop>(shopRef);
  const { data: profile } = useDoc<UserProfile>(profileRef);
  const { data: liveSession } = useDoc<LiveSession>(liveRef);
  const { data: products } = useCollection<Product>(productsQuery);

  const isLive = liveSession?.status === 'live';
  const shopName = shop?.shopName || profile?.fullName || 'Your shop';
  const location =
    shop?.area && shop?.county
      ? `${shop.area}, ${shop.county}`
      : shop?.location || profile?.location || '';

  const followers = shop?.followers ?? 0;
  const videoProducts = (products ?? []).filter(
    (p) => !!p.videoUrl || (p.videoUrls && p.videoUrls.length > 0),
  );

  const isVerified = profile?.verificationStatus === 'verified';
  const isPopular = followers >= POPULAR_SHOP_FOLLOWERS;
  const joinedDate = profile?.joinDate ? new Date(profile.joinDate) : null;
  const isNew =
    !!joinedDate &&
    (new Date().getTime() - joinedDate.getTime()) / (1000 * 3600 * 24) < NEW_SELLER_DAYS;

  // The website hardcodes `deliversFast: true`, so every storefront shows this
  // badge. Mirroring it keeps the two screens honest; a seller reading it here
  // sees exactly what a buyer sees, and the delivery policy below is what they
  // must actually honour.
  const badges = [
    { show: isVerified, label: 'Verified', icon: ShieldCheck, color: 'bg-blue-500' },
    { show: isPopular, label: 'Popular', icon: Star, color: 'bg-purple-500' },
    { show: isNew, label: 'New Seller', icon: Rocket, color: 'bg-green-500' },
    { show: true, label: 'Fast Delivery', icon: Zap, color: 'bg-teal-500' },
  ].filter((b) => b.show);

  const socials = [
    { href: shop?.facebookUrl, icon: Facebook, hover: 'hover:bg-blue-600' },
    { href: shop?.instagramUrl, icon: Instagram, hover: 'hover:bg-pink-600' },
    { href: shop?.twitterUrl, icon: Twitter, hover: 'hover:bg-sky-500' },
    {
      href: shop?.contactWhatsapp
        ? `https://wa.me/${shop.contactWhatsapp.replace(/\D/g, '')}`
        : undefined,
      icon: MessageSquare,
      hover: 'hover:bg-green-600',
    },
  ].filter((s) => !!s.href);

  const share = async () => {
    const url = `${window.location.origin}/sellers/${sellerId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied', description: 'Your public shop link is on your clipboard.' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not copy the link' });
    }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'products', label: 'Products' },
    { key: 'videos', label: 'Videos' },
    { key: 'live', label: 'Live' },
    { key: 'about', label: 'About' },
  ];

  return (
    <div className="vn-page-enter space-y-6 pb-2">
      <SellerSectionTitle eyebrow="What buyers see" title="My shop" />

      {/* ══ Hero — full-bleed banner, circular logo breaking the edge ══════ */}
      <section className="relative">
        <div className="relative h-44 w-full overflow-hidden bg-neutral-950">
          {shop?.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shop.bannerUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-amber-500 via-orange-500 to-red-500" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

          {isLive && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg">
              <Radio className="h-3 w-3" /> Live now
            </span>
          )}
        </div>

        <div className="px-4">
          <div className="-mt-14 flex flex-col items-center text-center">
            {/* Logo — overlaps the banner exactly as the website's avatar does. */}
            <span className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-secondary shadow-2xl">
              {shop?.logoUrl || profile?.profilePictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={(shop?.logoUrl || profile?.profilePictureUrl) as string}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <span className="font-grotesk text-3xl font-black text-muted-foreground">
                  {(shopName || 'S').charAt(0).toUpperCase()}
                </span>
              )}
            </span>

            <h2 className="font-grotesk mt-4 flex items-center justify-center gap-2 text-2xl font-bold uppercase tracking-tight text-foreground">
              <span className="truncate">{shopName}</span>
              {isVerified && (
                <BadgeCheck className="h-5 w-5 shrink-0 fill-sky-500 text-sky-400" aria-label="Verified" />
              )}
            </h2>

            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {followers.toLocaleString()} Followers
            </p>

            {/* Trust badges — same set, same order, same colours as the website. */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {badges.map(({ label, icon: Icon, color }) => (
                <span
                  key={label}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm',
                    color,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </span>
              ))}
            </div>

            {socials.length > 0 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                {socials.map(({ href, icon: Icon, hover }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Social link"
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white transition-all',
                      hover,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Actions — same shape as the website, adapted to owning the shop. */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/app/seller/live"
              className={cn(
                'inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-[10px] font-bold uppercase tracking-widest transition sm:flex-none',
                isLive
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                  : 'bg-primary text-primary-foreground shadow-lg shadow-primary/20',
              )}
            >
              {isLive ? <Radio className="h-3.5 w-3.5" /> : <Award className="h-3.5 w-3.5" />}
              {isLive ? 'Live control' : 'Start broadcast'}
            </Link>

            <Link
              href="/app/seller/messages"
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-white/10 sm:flex-none"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Messages
            </Link>

            <button
              type="button"
              onClick={share}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-white/10 sm:flex-none"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share shop
            </button>
          </div>
        </div>
      </section>

      {/* ══ Tabs — Products · Videos · Live · About ═══════════════════════ */}
      <section className="px-4">
        <div className="scrollbar-hide flex gap-1 overflow-x-auto border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={cn(
                'relative shrink-0 px-4 py-3 text-sm font-semibold transition',
                tab === t.key
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              {t.key === 'live' && isLive && (
                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
              )}
              {tab === t.key && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ── Products ────────────────────────────────────────────────────── */}
      {tab === 'products' && (
        <section>
          {(products?.length ?? 0) > 0 ? (
            <div className="grid grid-cols-2 gap-2.5">
              {(products ?? []).map((product) => (
                <div
                  key={product.id}
                  className="vn-app-card overflow-hidden rounded-2xl border border-border/70 bg-card"
                >
                  <ListingThumb
                    src={product.imageUrl}
                    alt={product.name || 'Product image'}
                    className="aspect-square w-full"
                    icon={Package}
                  />
                  <div className="p-2.5">
                    <p className="truncate text-xs font-semibold text-foreground">{product.name}</p>
                    <p className="font-grotesk mt-0.5 text-sm font-bold tabular-nums text-primary">
                      {product.price.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Package}
              title="No listings yet"
              body="A shop with nothing in it is the first thing buyers notice."
              action={
                <Link
                  href="/app/seller/create"
                  className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground"
                >
                  Create your first listing
                </Link>
              }
            />
          )}
        </section>
      )}

      {/* ── Videos ──────────────────────────────────────────────────────── */}
      {tab === 'videos' && (
        <section>
          {videoProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5">
              {videoProducts.map((product) => (
                <div
                  key={product.id}
                  className="vn-app-card overflow-hidden rounded-2xl border border-border/70 bg-card"
                >
                  <ListingThumb
                    src={product.imageUrl}
                    alt={product.name || 'Product image'}
                    className="aspect-square w-full"
                    icon={Package}
                  />
                  <div className="p-2.5">
                    <p className="truncate text-xs font-semibold text-foreground">{product.name}</p>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                      Video
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Package}
              title="No videos yet"
              body="Video listings sell faster — add one and it appears here for every buyer who lands on you."
              action={
                <Link
                  href="/app/seller/create"
                  className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground"
                >
                  Add a video listing
                </Link>
              }
            />
          )}
        </section>
      )}

      {/* ── Live ────────────────────────────────────────────────────────── */}
      {tab === 'live' && (
        <section className="space-y-2.5">
          {isLive ? (
            <>
              <div className="vn-app-card overflow-hidden rounded-2xl border border-red-500/40 bg-card">
                <div className="flex items-center gap-2 bg-red-600 px-4 py-2.5">
                  <Radio className="h-4 w-4 text-white" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                    You are live
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-white/90">
                    <Users className="h-3 w-3" />
                    {(liveSession?.viewerCount ?? 0).toLocaleString()} watching
                  </span>
                </div>
                <div className="p-4">
                  <p className="font-grotesk text-lg font-bold text-foreground">
                    {liveSession?.title || 'Live now'}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    Your studio has the controls — pinned product, offers and ending the stream.
                  </p>
                  <Link
                    href="/app/seller/live"
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-red-700"
                  >
                    <Radio className="h-3.5 w-3.5" />
                    Open live control
                  </Link>
                </div>
              </div>
            </>
          ) : liveSession?.status === 'ended' ? (
            <SellerCard className="vn-app-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Last broadcast
              </p>
              <p className="font-grotesk mt-1.5 truncate text-base font-bold text-foreground">
                {liveSession?.title || 'Your previous stream'}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {liveSession?.endTime?.toDate
                  ? `Ended ${liveSession.endTime.toDate().toLocaleDateString()}`
                  : 'Recently'}
              </p>
              {(liveSession?.sales ?? 0) > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="font-grotesk font-bold tabular-nums text-foreground">
                    {liveSession?.sales}
                  </span>{' '}
                  sale{liveSession?.sales === 1 ? '' : 's'} from that stream
                </p>
              )}
              <Link
                href="/app/seller/live"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground"
              >
                <Award className="h-3.5 w-3.5" /> Go live again
              </Link>
            </SellerCard>
          ) : (
            <EmptyState
              icon={Radio}
              title="You have not gone live yet"
              body="Shoppers find you through live sessions. Start one and your followers can see you instantly."
              action={
                <Link
                  href="/app/seller/live"
                  className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground"
                >
                  Start a broadcast
                </Link>
              }
            />
          )}
        </section>
      )}

      {/* ── About ───────────────────────────────────────────────────────── */}
      {tab === 'about' && (
        <section className="space-y-2.5">
          <SellerCard className="vn-app-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              About
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {shop?.description || profile?.bio || 'No description yet — this is the first thing buyers read.'}
            </p>
          </SellerCard>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: 'Listings', value: products?.length ?? 0, icon: Package },
              { label: 'Followers', value: followers, icon: Users },
              { label: 'Reviews', value: shop?.reviewsCount ?? 0, icon: Star },
            ].map((stat) => (
              <div
                key={stat.label}
                className="vn-app-card rounded-2xl border border-border/70 bg-card px-2 py-3 text-center"
              >
                <p className="font-grotesk text-lg font-bold tabular-nums text-foreground">
                  {stat.value.toLocaleString()}
                </p>
                <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {location && (
            <SellerCard className="vn-app-card flex items-start gap-3 p-3.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Location</p>
                <p className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground">
                  {location}
                </p>
              </div>
            </SellerCard>
          )}

          {/* Contact — a buyer reaches these before they buy from anyone new. */}
          {(shop?.contactWhatsapp || shop?.contactPhone || shop?.contactEmail) && (
            <SellerCard className="vn-app-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Contact
              </p>
              <div className="mt-2 space-y-1.5">
                {shop?.contactWhatsapp && (
                  <p className="break-words text-sm text-foreground">
                    <span className="text-muted-foreground">WhatsApp · </span>
                    {shop.contactWhatsapp}
                  </p>
                )}
                {shop?.contactPhone && (
                  <p className="break-words text-sm text-foreground">
                    <span className="text-muted-foreground">Phone · </span>
                    {shop.contactPhone}
                  </p>
                )}
                {shop?.contactEmail && (
                  <p className="break-words text-sm text-foreground">
                    <span className="text-muted-foreground">Email · </span>
                    {shop.contactEmail}
                  </p>
                )}
              </div>
            </SellerCard>
          )}

          <SellerCard className="vn-app-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Terms & policies
            </p>
            <div className="mt-3 space-y-3">
              {[
                { icon: Truck, label: 'Delivery', value: shop?.deliveryPolicy || 'Not set yet' },
                { icon: RotateCcw, label: 'Returns', value: shop?.returnPolicy || 'Not set yet' },
                { icon: Clock, label: 'Hours', value: shop?.storeHours || 'Not set yet' },
              ].map((policy) => (
                <div key={policy.label} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <policy.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{policy.label}</p>
                    <p className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground">
                      {policy.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </SellerCard>

          {profile?.joinDate && (
            <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              On Vidnov since {new Date(profile.joinDate).toLocaleDateString()}
            </p>
          )}

          <SellerCard className="vn-app-card flex items-center gap-3 border-amber-500/30 bg-amber-500/5 p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Globe className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                Edit your storefront
              </span>
              <span className="block text-[11px] text-muted-foreground">
                Name, banner, policies and location live in Settings
              </span>
            </span>
            <Link
              href="/app/seller/account"
              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground transition hover:bg-secondary"
            >
              Open
            </Link>
          </SellerCard>
        </section>
      )}
    </div>
  );
}