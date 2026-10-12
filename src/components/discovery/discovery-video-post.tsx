'use client';

/**
 * DISCOVERY — the immersive post.
 *
 * Every listing in Discovery is one of these: full-bleed media, one product,
 * one screen. The layout is the vertical-video shape buyers already know —
 * action rail down the right, seller and product bottom-left, the buy button
 * full-width under them — because a marketplace feed is read with the thumb.
 *
 * ## Playback
 * Muted, always. Sound never starts on its own. A post plays only while it is
 * actually on screen (`active` comes from the feed's IntersectionObserver), so
 * scrolling away pauses and rewinds rather than leaving five videos running
 * underneath each other. The progress bar at the bottom is real, not
 * decorative: it reads `currentTime / duration` off the element.
 *
 * ## The rail
 * Seven controls, seven real outcomes: like, comments, save, share, the
 * listing, the business, and the seller's follow badge. Nothing decorative.
 * Each either does the thing or sends the buyer to sign in first.
 */

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Bookmark, Heart, Loader2, MapPin, MessageCircle,
  Pause, Play, Plus, Send, Share2, ShoppingBag, Store, Volume2, VolumeX,
} from 'lucide-react';
import {
  addDoc, arrayRemove, arrayUnion, collection, doc, increment,
  query, serverTimestamp, updateDoc,
} from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCollection, useFirestore, useMemoFirebase, useUser, useUserProfile } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { resolveCommenterName } from '@/lib/comments';
import { cn } from '@/lib/utils';
import type { Comment, Product } from '@/lib/types';
import { isService, listingPriceDisplay } from '@/components/listings/service-badge';
import { availabilityLabel, isPurchasable, listingCover, listingMedia, sellerListingCover, timeAgo } from '@/lib/discovery';
export interface DiscoverySeller {
  id: string;
  name: string;
  avatarUrl: string;
  isVerified: boolean;
  location: string;
  isLive: boolean;
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

function priceText(listing: Product): string {
  const display = listingPriceDisplay(listing);
  if (!display) return 'Price on request';
  if (display.kind === 'quote') return display.label;
  const amount = display.amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return display.kind === 'hourly' ? `${display.currency} ${amount}/hr` : `${display.currency} ${amount}`;
}

/** 12400 → "12.4K", the count format the reference uses. */
function compactCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value < 1000) return String(Math.round(value));
  if (value < 1_000_000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

/** Pull `#tags` out of the caption so they can be painted in the accent. */
function CaptionWithTags({ text }: { text: string }) {
  const parts = text.split(/(#[\p{L}\p{N}_]+)/u);
  return (
    <p className="line-clamp-3 whitespace-pre-line text-[12.5px] leading-relaxed text-white/80">
      {parts.map((part, i) =>
        part.startsWith('#') ? (
          <span key={i} className="font-semibold text-[color:var(--vn-discovery-accent)]">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

/* ── Rail ───────────────────────────────────────────────────────────────── */

function RailButton({
  label,
  active,
  onClick,
  href,
  count,
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  href?: string;
  count?: string;
  children: React.ReactNode;
}) {
  const bubble = cn(
    'flex h-10 w-10 items-center justify-center rounded-full transition',
    'group-focus-visible/rail:ring-2 group-focus-visible/rail:ring-[color:var(--vn-discovery-accent)]',
    active ? 'bg-[color:var(--vn-discovery-accent)] text-[#0A0A0A]' : 'text-white',
  );

  const inner = (
    <>
      <span className={bubble}>{children}</span>
      {count !== undefined && (
        <span className="mt-0.5 text-[11px] font-bold tabular-nums text-white drop-shadow">{count}</span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className="group/rail flex flex-col items-center">
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="group/rail flex flex-col items-center">
      {inner}
    </button>
  );
}

/* ── The post ───────────────────────────────────────────────────────────── */

export function DiscoveryVideoPost({
  listing,
  seller,
  active,
  sponsored,
  onOpenDetails,
  cover,
}: {
  listing: Product;
  seller: DiscoverySeller;
  active: boolean;
  sponsored: boolean;
  onOpenDetails: () => void;
  cover?: string;
}) {
  const { toast } = useToast();
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();

  const media = React.useMemo(() => listingMedia(listing), [listing]);
  const [failed, setFailed] = React.useState<Set<string>>(new Set());
  const playable = React.useMemo(() => media.filter((m) => !failed.has(m.url)), [media, failed]);
  const [index, setIndex] = React.useState(0);
  const safeIndex = Math.min(index, Math.max(0, playable.length - 1));
  const current = playable[safeIndex];

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [buffering, setBuffering] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [muted, setMuted] = React.useState(true);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (!active || playable.length <= 1) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % playable.length), 6000);
    return () => window.clearInterval(id);
  }, [active, playable.length]);

  React.useEffect(() => {
    setIndex(0);
    setFailed(new Set());
    setBuffering(false);
    setPaused(false);
    setProgress(0);
  }, [listing.id]);

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el || current?.type !== 'video') return;
    if (active && !paused) {
      el.play().catch(() => setPaused(true));
    } else {
      el.pause();
    }
  }, [active, paused, current?.url, current?.type]);

  const markFailed = React.useCallback((url: string) => {
    setFailed((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));
    setIndex(0);
  }, []);

  /* — auth gate — */

  const requireAuth = (what: string) => {
    toast({
      title: 'Sign in to continue',
      description: what,
      action: (
        <Button asChild size="sm" className="bg-[color:var(--vn-discovery-accent)] text-[#0A0A0A] hover:bg-[color:var(--vn-discovery-accent-hover)]">
          <Link href="/login?returnTo=%2Fbuyer%2Fdiscovery">Sign in</Link>
        </Button>
      ),
    });
  };

  /* — state — */

  const [likeCount, setLikeCount] = React.useState(listing.likes ?? 0);
  const [liked, setLiked] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [following, setFollowing] = React.useState(false);
  const [commentsOpen, setCommentsOpen] = React.useState(false);

  React.useEffect(() => {
    setLikeCount(listing.likes ?? 0);
  }, [listing.id, listing.likes]);

  React.useEffect(() => {
    setSaved((userProfile?.wishlist ?? []).includes(listing.id));
    setFollowing((userProfile?.following ?? []).includes(seller.id));
  }, [userProfile, listing.id, seller.id]);

  // Comments subscribe only while this post is the one on screen — one live
  // listener per card would be sixty of them on a phone for unopened threads.
  const commentsQuery = useMemoFirebase(() => {
    if (!firestore || !active) return null;
    return query(collection(firestore, 'products', listing.id, 'comments'));
  }, [firestore, active, listing.id]);
  const { data: commentDocs } = useCollection<Comment>(commentsQuery);
  const commentCount = commentDocs?.length ?? 0;

  /* — actions — */

  const toggleLike = async () => {
    if (!user) return requireAuth('Liking a listing needs an account so it stays yours.');
    if (!firestore) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      await updateDoc(doc(firestore, 'products', listing.id), { likes: increment(next ? 1 : -1) });
    } catch {
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
      toast({ variant: 'destructive', title: 'Like not saved', description: 'Check your connection and try again.' });
    }
  };

  const toggleSave = async () => {
    if (!user) return requireAuth('Saving an item needs an account so it is waiting for you later.');
    if (!firestore) return;
    const next = !saved;
    setSaved(next);
    try {
      await updateDoc(doc(firestore, 'userProfiles', user.uid), {
        wishlist: next ? arrayUnion(listing.id) : arrayRemove(listing.id),
      });
      toast({ title: next ? 'Saved' : 'Removed from saved' });
    } catch {
      setSaved(!next);
      toast({ variant: 'destructive', title: 'Could not update saved items' });
    }
  };

  const toggleFollow = async () => {
    if (!user) return requireAuth('Following a store needs an account.');
    if (!firestore || user.uid === seller.id) return;
    const next = !following;
    setFollowing(next);
    try {
      await updateDoc(doc(firestore, 'userProfiles', user.uid), {
        following: next ? arrayUnion(seller.id) : arrayRemove(seller.id),
      });
    } catch {
      setFollowing(!next);
      toast({ variant: 'destructive', title: 'Could not update following' });
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/products/${listing.id}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: listing.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied', description: 'The listing link is on your clipboard.' });
    } catch {
      /* A dismissed share sheet is not an error. */
    }
  };

  /* — derived — */

  const place = listing.location || listing.vendorLocation || listing.serviceArea;
  const purchasable = isPurchasable(listing);
  const coverImage = cover ?? sellerListingCover(listing);
  const tags = (listing.tags ?? '').trim();
  const caption = [
    listing.description?.trim(),
    tags ? `#${tags.split(/[,\s]+/).filter(Boolean).join(' #')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  const cta = isService(listing) ? 'View service' : 'View product';
  const actionable = purchasable || isService(listing);

  return (
    <section className="absolute inset-0 flex overflow-hidden bg-black">
      {/* Media */}
      <div className="absolute inset-0">
        {current?.type === 'video' ? (
          <>
            {current.poster && !failed.has(current.poster) && (
              <Image
                src={current.poster}
                alt=""
                fill
                sizes="100vw"
                priority={active}
                className="object-cover opacity-90"
                onError={() => markFailed(current.poster!)}
              />
            )}
            <video
              ref={videoRef}
              src={current.url}
              poster={current.poster}
              muted={muted}
              loop
              playsInline
              preload={active ? 'auto' : 'metadata'}
              onError={() => markFailed(current.url)}
              onWaiting={() => setBuffering(true)}
              onLoadStart={() => setBuffering(true)}
              onPlaying={() => setBuffering(false)}
              onCanPlay={() => setBuffering(false)}
              onLoadedData={() => setBuffering(false)}
              onTimeUpdate={(e) => {
                const el = e.currentTarget;
                if (el.duration > 0) setProgress(el.currentTime / el.duration);
              }}
              className={cn(
                'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
                buffering ? 'opacity-0' : 'opacity-100',
              )}
            />
          </>
        ) : (
          <Image
            src={current?.url ?? coverImage}
            alt={listing.name}
            fill
            sizes="100vw"
            priority={active}
            className="object-cover"
            onError={() => current && markFailed(current.url)}
          />
        )}
      </div>

      {/* Readability gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/50"
      />

      {buffering && current?.type === 'video' && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
            <Loader2 className="h-5 w-5 animate-spin text-white/90" />
          </span>
        </div>
      )}

      {/* Tap the media to pause. */}
      <button
        type="button"
        onClick={() => current?.type === 'video' && setPaused((p) => !p)}
        aria-label={paused ? 'Play' : 'Pause'}
        className="absolute inset-0 z-10 cursor-default focus-visible:outline-none"
      />

      {sponsored && (
        <span className="absolute left-4 top-4 z-20 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-md">
          Sponsored
        </span>
      )}

      {/* Media position dots — inside the text column so they can never
          collide with the rail. */}
      {playable.length > 1 && (
        <div className="absolute bottom-full left-4 right-20 mb-2 flex gap-1">
          {playable.map((m, i) => (
            <span
              key={m.url}
              className={cn('h-0.5 flex-1 rounded-full transition-colors', i === safeIndex ? 'bg-[color:var(--vn-discovery-accent)]' : 'bg-white/25')}
            />
          ))}
        </div>
      )}

      {/* Bottom block */}
      <div className="relative z-20 mt-auto w-full px-4 pb-2 pr-[76px]">
        {/* Seller */}
        <div className="flex items-center gap-2">
          <Link
            href={`/sellers/${seller.id}`}
            className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/60"
          >
            <Image src={seller.avatarUrl} alt={seller.name} fill sizes="36px" className="object-cover" />
          </Link>

          <Link
            href={`/sellers/${seller.id}`}
            className="font-grotesk flex min-w-0 items-center gap-1.5 text-[14px] font-bold text-white hover:underline"
          >
            <span className="truncate">{seller.name}</span>
            {seller.isVerified && (
              <span
                title="Verified business"
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#2D9CFF] text-[9px] font-black text-white"
              >
                ✓
              </span>
            )}
          </Link>

          {user?.uid !== seller.id && (
            <button
              type="button"
              onClick={toggleFollow}
              aria-pressed={following}
              className={cn(
                'ml-1 h-7 shrink-0 rounded-full px-3.5 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                following
                  ? 'border border-white/35 bg-white/10 text-white/85'
                  : 'bg-[color:var(--vn-discovery-accent)] text-[#0A0A0A] hover:bg-[color:var(--vn-discovery-accent-hover)]',
              )}
            >
              {following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {/* Title + price */}
        <h2 className="font-grotesk mt-2 text-[17px] font-bold leading-tight text-white">
          {listing.name}
        </h2>
        <p className="font-grotesk mt-0.5 text-[20px] font-bold leading-none text-[color:var(--vn-discovery-accent)]">
          {priceText(listing)}
        </p>

        {/* Caption */}
        {caption && (
          <div className="mt-2">
            <CaptionWithTags text={caption} />
          </div>
        )}

        {/* Location + availability */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/55">
          {place && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden />
              {place}
            </span>
          )}
          {availabilityLabel(listing) && <span>{availabilityLabel(listing)}</span>}
        </div>

        {/* Primary CTA — full width, exactly where a thumb already is. */}
        <button
          type="button"
          onClick={onOpenDetails}
          disabled={!actionable}
          className={cn(
            'mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-bold transition',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
            actionable
              ? 'bg-[color:var(--vn-discovery-accent)] text-[#0A0A0A] hover:bg-[color:var(--vn-discovery-accent-hover)]'
              : 'cursor-not-allowed bg-white/12 text-white/40',
          )}
        >
          <ShoppingBag className="h-4 w-4" aria-hidden />
          {cta}
        </button>
      </div>

      {/* Playback row — real progress, real controls. */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-3 px-4 pb-3 pt-1">
        <button
          type="button"
          onClick={() => current?.type === 'video' && setPaused((p) => !p)}
          aria-label={paused ? 'Play video' : 'Pause video'}
          disabled={current?.type !== 'video'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--vn-discovery-accent)] disabled:opacity-30"
        >
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>

        <div
          className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20"
          role="progressbar"
          aria-label="Video progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <span
            className="block h-full rounded-full bg-white transition-[width] duration-150"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>

        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Unmute video' : 'Mute video'}
          aria-pressed={!muted}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--vn-discovery-accent)]"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Right rail — the seven controls from the reference, sized to fit a
          phone viewport without pushing the top one off screen. */}
      <div className="absolute bottom-16 right-2 z-20 flex flex-col items-center gap-3">
        {/* Avatar with the follow badge, where a thumb lands. */}
        <div className="relative mb-1">
          <Link
            href={`/sellers/${seller.id}`}
            aria-label={`Visit ${seller.name}`}
            className="block h-12 w-12 overflow-hidden rounded-full border-2 border-white/80"
          >
            <Image src={seller.avatarUrl} alt={seller.name} fill sizes="48px" className="object-cover" />
          </Link>
          <button
            type="button"
            onClick={toggleFollow}
            aria-label={following ? `Unfollow ${seller.name}` : `Follow ${seller.name}`}
            aria-pressed={following}
            className={cn(
              'absolute -bottom-2 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--vn-discovery-accent)]',
              following ? 'bg-white text-[#0A0A0A]' : 'bg-[color:var(--vn-discovery-accent)] text-[#0A0A0A]',
            )}
          >
            {following ? <span className="text-[11px] font-black leading-none">✓</span> : <Plus className="h-3.5 w-3.5" />}
          </button>
        </div>

        <RailButton label={liked ? 'Unlike' : 'Like'} active={liked} onClick={toggleLike} count={compactCount(likeCount)}>
          <Heart className={cn('h-6 w-6', liked && 'fill-current')} />
        </RailButton>

        <RailButton label="Comments" onClick={() => setCommentsOpen(true)} count={compactCount(commentCount)}>
          <MessageCircle className="h-6 w-6" />
        </RailButton>

        <RailButton label={saved ? 'Remove from saved' : 'Save'} active={saved} onClick={toggleSave}>
          <Bookmark className={cn('h-6 w-6', saved && 'fill-current')} />
        </RailButton>

        <RailButton label="Share" onClick={share} count={compactCount(Number(listing.clickCount ?? 0))}>
          <Share2 className="h-6 w-6" />
        </RailButton>

        <RailButton label={cta} onClick={onOpenDetails}>
          <ShoppingBag className="h-6 w-6" />
        </RailButton>

        <RailButton label={`Visit ${seller.name}`} href={`/sellers/${seller.id}`}>
          <Store className="h-6 w-6" />
        </RailButton>
      </div>

      <DiscoveryComments
        listing={listing}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        onNeedAuth={requireAuth}
      />
    </section>
  );
}

/* ── Comments ───────────────────────────────────────────────────────────── */

function DiscoveryComments({
  listing,
  open,
  onOpenChange,
  onNeedAuth,
}: {
  listing: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNeedAuth: (message: string) => void;
}) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [draft, setDraft] = React.useState('');
  const [posting, setPosting] = React.useState(false);

  const commentsQuery = useMemoFirebase(() => {
    if (!firestore || !open) return null;
    return collection(firestore, 'products', listing.id, 'comments');
  }, [firestore, open, listing.id]);

  const { data, isLoading } = useCollection<Comment>(commentsQuery);

  const comments = React.useMemo(() => {
    const list = [...(data ?? [])];
    list.sort((a, b) => (a.timestamp?.toMillis?.() ?? 0) - (b.timestamp?.toMillis?.() ?? 0));
    return list;
  }, [data]);

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    if (!user) return onNeedAuth('Commenting needs an account.');
    if (!firestore) return;
    setPosting(true);
    try {
      await addDoc(collection(firestore, 'products', listing.id, 'comments'), {
        text,
        userId: user.uid,
        userName: resolveCommenterName(user),
        userEmail: user.email ?? '',
        userAvatar: user.photoURL ?? `https://picsum.photos/seed/${user.uid}/64`,
        timestamp: serverTimestamp(),
      });
      setDraft('');
    } catch {
      /* Keep the draft — a failed comment must not cost the buyer their typing. */
    } finally {
      setPosting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="vn-discovery-scope h-[70dvh] rounded-t-3xl border-t border-white/10 bg-[#0A0A0A] p-0 text-white"
      >
        <SheetHeader className="border-b border-white/10 px-5 pb-3 pt-6">
          <SheetTitle className="font-grotesk text-base font-bold text-white">
            Comments{typeof data?.length === 'number' ? ` · ${data.length}` : ''}
          </SheetTitle>
        </SheetHeader>

        <div className="flex h-[calc(70dvh-8.5rem)] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-white/10" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-24 rounded bg-white/10" />
                      <div className="h-3 w-2/3 rounded bg-white/10" />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <p className="py-10 text-center text-sm text-white/50">
                No comments yet. Be the first to ask about {listing.name}.
              </p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={comment.userAvatar}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full bg-white/10 object-cover"
                  />
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-white">
                      {comment.userName}
                      <span className="ml-2 text-[10px] font-normal text-white/45">
                        {timeAgo(comment.timestamp?.toMillis?.() ?? 0)}
                      </span>
                    </p>
                    <p className="mt-0.5 break-words text-[13px] leading-relaxed text-white/80">{comment.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-white/10 bg-[#0A0A0A] px-4 py-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder={user ? 'Add a comment…' : 'Sign in to comment'}
              aria-label="Add a comment"
              className="h-10 flex-1 rounded-full border border-white/12 bg-white/8 px-4 text-[13px] text-white placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--vn-discovery-accent)]"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={posting || !draft.trim()}
              aria-label="Post comment"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--vn-discovery-accent)] text-[#0A0A0A] transition disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
