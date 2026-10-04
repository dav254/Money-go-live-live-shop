
'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRecordOnScreen } from '@/lib/buyer/recently-viewed';
import Image from 'next/image';
import type { VideoFeedItem, Comment } from '@/lib/types';
import { VideoInfo } from './video-info';
import { VideoActions } from './video-actions';
import { ProductDrawer } from './product-drawer';
import { Button } from '../ui/button';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { ProductInfo } from '../live/product-info';
import { collection, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { CommentPeek } from './comment-peek';
import { resolveCommenterName } from '@/lib/comments';
import { X, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getPlaceholderImage } from '@/lib/placeholder-images';

interface VideoCardProps {
  item: VideoFeedItem;
  onScroll?: (direction: 'up' | 'down') => void;
  isIntersecting: boolean;
  /**
   * Destination for the card's SHOP button. The card is shared by the app feed
   * and the website feed, and the two have different product detail routes, so
   * the caller resolves it rather than the card guessing.
   */
  productHref: string;
  /** Label for the drawer's seller link, so the wording matches the destination. */
  shopLinkLabel: string;
  /** Where the drawer's "Buy now" goes once the order exists. */
  checkoutHrefFor: (orderId: string) => string;
  /** Where the rail's CHAT button goes — the conversation with this seller. */
  messageHref: string;
}

/** One entry in a product's media stack, with the poster to show until it plays. */
interface FeedMedia {
  url: string;
  type: 'video' | 'image';
  /** Poster frame, so the card is never a black rectangle while loading. */
  poster?: string;
}

/**
 * Discovery Feed Hub: High-fidelity media cycling node.
 * Automatically rotates through all product media (images + videos) to maximize engagement.
 *
 * ## Why this card looks the way it does
 *
 * Three failures used to present as one symptom — a black rectangle — and all
 * three are handled here:
 *
 *  1. **A video that cannot load.** There is no `onError` and no fallback, so a
 *     dead URL (an expired storage link, a 402/404 from a legacy bucket) left
 *     the card black forever with no way to tell whether it was loading or
 *     broken. Broken entries are now retired and the stack advances; if nothing
 *     in the stack is playable the card falls back to the product image.
 *  2. **A video that is still loading.** No poster meant the first frames were
 *     pure black for as long as the network took, which is exactly how a slow
 *     load looks like a crash. Every video now carries the 400px poster frame
 *     the upload pipeline already generates (`videoThumbnailUrls`), plus a
 *     spinner while the buffer fills so the wait is legible as a wait.
 *  3. **A video that was never asked to start.** There was no `autoPlay` and no
 *     `preload`, so playback waited on an effect that ran after mount with the
 *     default `preload="metadata"`. The element now autoplays and preloads.
 */
export function VideoCard({
  item,
  onScroll,
  isIntersecting,
  productHref,
  shopLinkLabel,
  checkoutHrefFor,
  messageHref,
}: VideoCardProps) {
  // Intelligent Media Aggregator: Unifies all product assets into a single discoverable stream.
  const allMedia = useMemo<FeedMedia[]>(() => {
    const media: FeedMedia[] = [];
    // `videoThumbnailUrls` is written parallel to `videoUrls` by the upload
    // pipeline, so the poster for the nth video is the nth entry here.
    const posters = item.product?.videoThumbnailUrls ?? [];

    if (item.product) {
        // 1. Gather primary video
        if (item.product.videoUrl && item.product.videoUrl.trim() !== "") {
          media.push({
            url: item.product.videoUrl,
            type: 'video',
            poster: posters[0],
          });
        }
        // 2. Gather video array
        if (item.product.videoUrls && Array.isArray(item.product.videoUrls)) {
          item.product.videoUrls.forEach((url, i) => {
            if (url && url.trim() !== "" && !media.some(m => m.url === url)) {
              media.push({ url, type: 'video', poster: posters[i] });
            }
          });
        }
        // 3. Gather primary image
        if (item.product.imageUrl && item.product.imageUrl.trim() !== "") {
          if (!media.some(m => m.url === item.product.imageUrl)) {
            media.push({ url: item.product.imageUrl, type: 'image' });
          }
        }
        // 4. Gather image gallery
        if (item.product.imageUrls && Array.isArray(item.product.imageUrls)) {
          item.product.imageUrls.forEach(url => {
            if (url && url.trim() !== "" && !media.some(m => m.url === url)) {
              media.push({ url, type: 'image' });
            }
          });
        }
    }
    // Fallback if no media exists
    if (media.length === 0) media.push({ url: getPlaceholderImage(), type: 'image' });
    return media;
  }, [item.product]);

  /**
   * Media that failed to load, retired for the life of this card.
   *
   * A `Set` of URLs rather than a boolean so a product with four videos can
   * lose one broken file and keep the other three, and so re-mounting the same
   * product in another card does not carry the failure over.
   */
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());

  const playableMedia = useMemo(
    () => allMedia.filter((m) => !failedUrls.has(m.url)),
    [allMedia, failedUrls],
  );

  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  // True while a video has a source but no frame yet. Drives the spinner, and
  // is the difference between "loading" and "crashed" for the person watching.
  const [isBuffering, setIsBuffering] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCommentPeekOpen, setIsCommentPeekOpen] = useState(false);
  /*
   * Sound on by default at half volume.
   *
   * The feed is watched on phones, where the hardware volume keys are the
   * natural control and an on-screen toggle just gets in the way, so the rail
   * no longer shows a mute button. Starting muted meant every video opened
   * silent and the buyer had to find a control to turn sound on; starting at
   * full volume meant a scrolling feed could blast a video at someone.
   */
  const [isMuted] = useState(false);
  const FEED_VOLUME = 0.5;
  const videoRef = useRef<HTMLVideoElement>(null);

  // Recently viewed: recorded only once the card has actually been on screen,
  // never on mount — otherwise opening the feed would file every product at
  // once and the list would be meaningless.
  const cardRef = useRef<HTMLDivElement>(null);
  // Memoised, because `useRecordOnScreen` depends on this object: an inline
  // literal would be a new reference on every render, tearing down and
  // rebuilding an IntersectionObserver on every card in the feed, every frame
  // the video plays.
  const recentProduct = useMemo(() => {
    const product = item?.product;
    if (!product) return null;
    return {
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      imageUrl:
        product.thumbnailUrls?.[0] || product.videoThumbnailUrls?.[0] || product.imageUrl,
    };
  }, [item?.product]);
  useRecordOnScreen(recentProduct, cardRef);
  const { user } = useUser();
  const firestore = useFirestore();
  
  const currentMedia = playableMedia[currentMediaIndex];
  // Guard the index: retiring a broken entry shortens the stack, and an index
  // left pointing past the end would render `undefined` and blank the card.
  const safeIndex = Math.min(currentMediaIndex, Math.max(playableMedia.length - 1, 0));
  const activeMedia = playableMedia[safeIndex];
  const nextMedia = playableMedia[safeIndex + 1];

  /*
   * 50% volume.
   *
   * Set through the DOM property, not a `volume` JSX attribute: React renders
   * unknown lowercase attributes as plain HTML and browsers ignore a `volume`
   * attribute on <video>, so the attribute would silently do nothing. The
   * property is the only thing that moves playback volume. Re-applied on every
   * clip change because the element is remounted per activeMedia.
   *
   * Declared after `activeMedia` so the dependency is not a temporal-dead-zone
   * read during render.
   */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.volume = FEED_VOLUME;
  }, [activeMedia?.url]);

  // Automated Cycling Engine: Rotates through media stack every 6 seconds when visible.
  useEffect(() => {
    if (!isIntersecting || playableMedia.length <= 1) return;
    const interval = setInterval(() => {
        setCurrentMediaIndex((prev) => (prev + 1) % playableMedia.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isIntersecting, playableMedia.length]);

  // Real-time Video Playback Sync
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || activeMedia?.type !== 'video') return;
    if (isIntersecting) {
        // `preload="auto"` plus `autoPlay` mean the browser is usually already
        // buffering by the time this runs; play() then resolves immediately.
        // The catch stays because autoplay can still be refused (e.g. Low Data
        // mode) and an unhandled rejection there would blank the card.
        videoElement.play().catch(() => {});
    } else {
        videoElement.pause();
        videoElement.currentTime = 0;
    }
  }, [isIntersecting, activeMedia]);

  /**
   * Retire a media entry that failed, and move to the next one.
   *
   * Only videos are retired. An image that 404s is left in place, because the
   * placeholder path below already covers it and dropping images would hide a
   * real data problem behind a silently shorter stack.
   */
  const handleMediaError = useCallback(() => {
    const failed = activeMedia;
    if (!failed || failed.type !== 'video') return;
    setFailedUrls((prev) => {
      if (prev.has(failed.url)) return prev;
      const next = new Set(prev);
      next.add(failed.url);
      return next;
    });
    // Land somewhere real rather than waiting for the re-render to clamp.
    setCurrentMediaIndex(0);
  }, [activeMedia]);

  // Reset the position whenever the product itself changes.
  useEffect(() => {
    setCurrentMediaIndex(0);
    setFailedUrls(new Set());
    setIsBuffering(false);
  }, [item.product?.id]);

  const commentsQuery = useMemoFirebase(() => {
    if (!firestore || !item.product.id) return null;
    return query(collection(firestore, 'products', item.product.id, 'comments'), orderBy('timestamp', 'asc'));
  }, [firestore, item.product.id]);

  const { data: comments, isLoading: areCommentsLoading } = useCollection<Comment>(commentsQuery);

  const handleAddComment = async (text: string) => {
    if (!user || !firestore || !item.product.id) return; 
    try {
      await addDoc(collection(firestore, 'products', item.product.id, 'comments'), {
        text,
        userId: user.uid,
        // Never "Anonymous": an email/password or Google account often has no
        // displayName, and a thread where every row is anonymous tells a buyer
        // nothing. See lib/comments.ts.
        userName: resolveCommenterName(user),
        userEmail: user.email || '',
        userAvatar: user.photoURL || `https://picsum.photos/seed/${user.uid}/40`,
        timestamp: serverTimestamp(),
      });
    } catch (e) { console.error(e); }
  };

  return (
    <div ref={cardRef} className="relative h-full w-full bg-black overflow-hidden group">
      {/* Poster underneath, so a card is never a black rectangle while the
          video buffers. It sits below the video element and is revealed by
          the video simply not having painted yet. */}
      {activeMedia?.type === 'video' && activeMedia.poster && (
        <Image
          src={activeMedia.poster}
          alt=""
          fill
          className="object-contain"
          // The poster is the card's first meaningful paint, so it must not
          // wait its turn behind the feed's other lazy images.
          priority
          sizes="100vw"
        />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeMedia?.url}
          className="absolute inset-0 z-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {activeMedia?.type === 'video' ? (
            <video
              ref={videoRef}
              src={activeMedia.url}
              poster={activeMedia.poster}
              className="relative h-full w-full object-contain"
              muted={isMuted}
              loop
              playsInline
              autoPlay
              // The single biggest lever on perceived load time: without it the
              // browser fetches metadata only and waits to be asked before it
              // pulls any actual video bytes.
              preload="auto"
              onError={handleMediaError}
              onLoadedData={() => setIsBuffering(false)}
              onCanPlay={() => setIsBuffering(false)}
              onPlaying={() => setIsBuffering(false)}
              onWaiting={() => setIsBuffering(true)}
              onLoadStart={() => setIsBuffering(true)}
            />
          ) : (
            <div className="relative h-full w-full">
                <Image src={activeMedia?.url} alt="Product" fill className="object-contain" priority />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Visible buffering state. Without this the card is a still poster for
          as long as the network takes and reads as frozen; a short spinner
          over the poster reads as loading and stops people tapping it. */}
      {isBuffering && activeMedia?.type === 'video' && (
        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm">
            <Loader2 className="h-5 w-5 animate-spin text-white/90" />
          </div>
        </div>
      )}

      {/* Prefetch the next entry in the stack so the next swipe plays from a
          warm buffer instead of starting from zero. Only ever one item ahead:
          the feed is snap-scrolling, so anything further away is bandwidth
          spent on a card the buyer may never reach. */}
      {nextMedia?.type === 'video' && (
        <video
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          src={nextMedia.url}
          preload="auto"
          muted
          playsInline
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 pointer-events-none" />

      {/* Progress Bars for Media Stack */}
      {playableMedia.length > 1 && (
        <div className="absolute bottom-[114px] left-4 right-16 z-20 flex gap-1 px-1">
          {playableMedia.map((_, i) => (
            <div key={i} className={cn("h-0.5 flex-1 rounded-full transition-all duration-500", i === safeIndex ? "bg-primary glow-primary" : "bg-white/20")} />
          ))}
        </div>
      )}

       <div className="absolute bottom-6 left-4 right-16 z-10">
            <ProductInfo product={item.product} appHref={productHref} />
       </div>

      <VideoActions 
        product={item.product}
        commentCount={comments?.length || 0}
        onProductClick={() => setIsDrawerOpen(true)}
        onCommentClick={() => setIsCommentPeekOpen((open) => !open)}
        messageHref={messageHref}
      />

      <ProductDrawer
        product={item.product}
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        shopHref={productHref}
        shopLabel={shopLinkLabel}
        checkoutHrefFor={checkoutHrefFor}
        messageHref={messageHref}
      />
      {/* Opens in place over this card rather than a sheet that covers the
          product, and takes itself back down. */}
      <CommentPeek
        comments={comments || []}
        isLoading={areCommentsLoading}
        isOpen={isCommentPeekOpen}
        onOpenChange={setIsCommentPeekOpen}
        onAddComment={handleAddComment}
      />
    </div>
  );
}
