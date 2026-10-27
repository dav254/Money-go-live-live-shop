'use client';

import { captureShareRef, trackListingView } from '@/lib/growth/client';

/**
 * BUYER APP · PRODUCT DETAIL — `/app/buyer/product/[productId]`.
 *
 * ## Why this exists
 *
 * The immersive feed's bottom product card has always ended in a coral SHOP
 * button, and that button pointed at `/sellers/{sellerId}` — the seller's
 * *storefront*. So the one control on the card that is labelled after the
 * product actually opened the seller. It also left the app entirely: from
 * `/app/buyer/shop` it was a one-tap hand-off to a website route.
 *
 * This screen is that destination, natively. It lives under `/app/buyer/*`, so
 * it inherits `BuyerAppShell` — the buyer's own top bar, tab bar, drawer and
 * `.vn-buyer-scope` design system. Nothing here links out to the website.
 *
 * ## What it shows
 *
 * The same data the website's `/products/[productId]` reads — `products/{id}`,
 * plus `sellerShops/{sellerId}` and `userProfiles/{sellerId}` for the seller
 * panel — presented as a phone-first column instead of a desktop page:
 *
 *   - a media gallery (video first, then images) with a thumbnail rail, which
 *     is what the feed card cannot show and the reason to come here at all;
 *   - the price block in the same three-part form the feed uses — seller-set
 *     local price, the struck-through market price, and the USD net;
 *   - quantity, stock, condition, category and delivery options;
 *   - the seller's shop card.
 *
 * ## Two deliberate non-links
 *
 * The seller row is NOT a link. There is no app-side single-seller storefront
 * — `/sellers/[id]` is a website route — and this screen will not become the
 * thing that throws a buyer out of the app. Same reasoning that made the My
 * sellers tiles and the Recently viewed tiles non-links. The seller's contact
 * details are shown instead, so the row is still useful without leaving.
 *
 * ## Buy actions
 *
 * "Add to cart" writes the same `userProfiles/{uid}/cart/{productId}` document
 * the website writes, so a cart built here is visible on the website and vice
 * versa. "Buy now" adds to the cart and routes to the app's own
 * `/app/buyer/cart` rather than creating an order here. The order is created by
 * the cart screen, which already owns the order-creation payload, and that
 * screen then routes to the app's checkout at `/app/buyer/checkout/[orderId]`.
 * The whole path stays inside the app.
 *
 * Opening this screen also records the product in Recently viewed, which is
 * what makes that rail reflect real visits rather than feed scrolls.
 */

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  doc, increment, serverTimestamp, setDoc,
} from 'firebase/firestore';
import {
  ChevronRight, Loader2, Minus, Package, Plus, ShieldCheck, ShoppingCart,
  Store, Tag, Truck, MessageCircle,
} from 'lucide-react';

import {
  errorEmitter, FirestorePermissionError, useDoc, useFirestore, useUser,
} from '@/firebase';
import type { Product, SellerShop, UserProfile } from '@/lib/types';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { mirrorCartItem } from '@/lib/users/mirror';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  BuyerCard, BuyerEmptyState, BuyerStatusPill,
} from '@/components/app/buyer/buyer-app-shell';
import { recordRecentlyViewed } from '@/lib/buyer/recently-viewed';

interface MediaItem {
  url: string;
  type: 'video' | 'image';
}

export default function BuyerProductDetailPage() {
  const params = useParams<{ productId: string }>();
  const productId = typeof params?.productId === 'string' ? params.productId : '';
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // Growth spine (Phase 1): arriving `?ref=` capture + a qualified view
  // (2s visible-page threshold; cancelled if the visitor navigates away).
  React.useEffect(() => {
    captureShareRef();
    return trackListingView(productId);
  }, [productId]);

  const [quantity, setQuantity] = React.useState(1);
  const [selected, setSelected] = React.useState<MediaItem | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);

  const productRef = React.useMemo(() => {
    if (!firestore || !productId) return null;
    return doc(firestore, 'products', productId);
  }, [firestore, productId]);

  const { data: product, isLoading: isProductLoading } = useDoc<Product>(productRef);

  const sellerId = product?.sellerId;
  const sellerShopRef = React.useMemo(() => {
    if (!firestore || !sellerId) return null;
    return doc(firestore, 'sellerShops', sellerId);
  }, [firestore, sellerId]);
  const sellerProfileRef = React.useMemo(() => {
    if (!firestore || !sellerId) return null;
    return doc(firestore, 'userProfiles', sellerId);
  }, [firestore, sellerId]);

  const { data: sellerShop } = useDoc<SellerShop>(sellerShopRef);
  const { data: sellerProfile } = useDoc<UserProfile>(sellerProfileRef);

  // The gallery: video first (that is what the feed was playing), then images,
  // de-duplicated. Same ordering the website page uses.
  const allMedia = React.useMemo<MediaItem[]>(() => {
    if (!product) return [];
    const media: MediaItem[] = [];
    const push = (url: unknown, type: MediaItem['type']) => {
      if (typeof url !== 'string') return;
      const trimmed = url.trim();
      if (!trimmed) return;
      if (!media.some((m) => m.url === trimmed)) media.push({ url: trimmed, type });
    };

    push(product.videoUrl, 'video');
    if (Array.isArray(product.videoUrls)) product.videoUrls.forEach((u) => push(u, 'video'));
    push(product.imageUrl, 'image');
    if (Array.isArray(product.imageUrls)) product.imageUrls.forEach((u) => push(u, 'image'));

    if (media.length === 0) return [{ url: getPlaceholderImage(), type: 'image' }];
    return media;
  }, [product]);

  // Reset per-product state and seed the gallery when the product (or the route)
  // changes, so a second product never inherits the first one's selection.
  React.useEffect(() => {
    setQuantity(1);
  }, [productId]);

  React.useEffect(() => {
    setSelected(allMedia[0] ?? null);
  }, [allMedia]);

  // A real visit, not a feed scroll: this is the screen the Recently viewed
  // rail is meant to describe. Keyed on the resolved id so it fires once the
  // document has actually landed.
  React.useEffect(() => {
    if (!product?.id) return;
    recordRecentlyViewed({
      id: product.id,
      name: product.name || 'Unnamed Product',
      price: Number(product.price) || 0,
      imageUrl: product.imageUrl || getPlaceholderImage(),
    });
  }, [product]);

  const addToCart = React.useCallback(
    async (qty: number): Promise<boolean> => {
      if (!user || !firestore || !product) return false;
      const cartItemRef = doc(firestore, 'userProfiles', user.uid, 'cart', productId);
      const cartData = {
        productId: product.id || productId,
        sellerId: product.sellerId || '',
        buyerId: user.uid,
        quantity: increment(qty),
        price: product.price || 0,
        name: product.name || 'Unnamed Product',
        imageUrl: product.imageUrl || getPlaceholderImage(),
        addedAt: serverTimestamp(),
      };

      try {
        await setDoc(cartItemRef, cartData, { merge: true });
        mirrorCartItem(user, productId);
        return true;
      } catch {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: cartItemRef.path,
            operation: 'write',
            requestResourceData: cartData,
          }),
        );
        return false;
      }
    },
    [user, firestore, product, productId],
  );

  const handleAddToCart = async () => {
    setIsAdding(true);
    const ok = await addToCart(quantity);
    setIsAdding(false);
    toast(
      ok
        ? { title: 'Added to cart', description: product?.name || undefined }
        : { variant: 'destructive', title: 'Could not add that to your cart.' },
    );
  };

  // Buy now deliberately stops at the app's cart. Creating the order here and
  // pushing `/checkout/{id}` would be a website escape, and the cart screen
  // already owns that payload.
  const handleBuyNow = async () => {
    setIsAdding(true);
    const ok = await addToCart(quantity);
    setIsAdding(false);
    if (!ok) {
      toast({ variant: 'destructive', title: 'Could not start checkout.' });
      return;
    }
    router.push('/app/buyer/cart');
  };

  if (isProductLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!product) {
    return (
      <BuyerEmptyState
        icon={Package}
        title="This product is no longer available"
        body="It may have sold out or been removed by the seller. Head back to the shop to find something else."
        action={
          <Button
            onClick={() => router.push('/app/buyer/shop')}
            className="mt-4 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-5 text-white"
          >
            Back to shop
          </Button>
        }
      />
    );
  }

  const mainPrice = product.localPrice || product.price || 0;
  const isOutOfStock = (product.stock ?? 0) <= 0;
  const sellerName = sellerShop?.shopName || sellerProfile?.fullName || 'Marketplace Seller';

  return (
    <div className="vn-page-enter pb-4">
      {/* Gallery */}
      <div className="relative aspect-square w-full overflow-hidden bg-black">
        {selected?.type === 'video' ? (
          <video
            key={selected.url}
            src={selected.url}
            className="h-full w-full object-contain"
            autoPlay
            muted
            loop
            playsInline
            controls
            preload="metadata"
          />
        ) : (
          <Image
            key={selected?.url}
            src={selected?.url || getPlaceholderImage()}
            alt={product.name || 'Product image'}
            fill
            sizes="100vw"
            priority
            className="object-contain"
          />
        )}
      </div>

      {allMedia.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-3">
          {allMedia.map((media, i) => (
            <button
              key={`${media.type}-${media.url}-${i}`}
              type="button"
              onClick={() => setSelected(media)}
              aria-label={`Show media ${i + 1}`}
              aria-current={selected?.url === media.url}
              className={cn(
                'relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border transition',
                selected?.url === media.url
                  ? 'border-cyan-400 ring-2 ring-cyan-400/30'
                  : 'border-white/10 opacity-60 hover:opacity-100',
              )}
            >
              <Image src={media.url} alt="" fill sizes="56px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Price block — same three-part form as the feed card */}
      <div className="px-4 pt-3">
        {product.category && (
          <p className="vn-micro text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-500 dark:text-cyan-400">
            {product.category}
          </p>
        )}
        <h1 className="mt-1.5 text-2xl font-semibold leading-tight tracking-tight text-foreground">
          {product.name || 'Unnamed Product'}
        </h1>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-2xl font-black tracking-tight text-cyan-600 dark:text-cyan-400">
            <Tag className="h-4 w-4" />
            {product.localCurrency || 'USD'} {mainPrice.toLocaleString()}
          </span>
          {product.wasPrice ? (
            <span className="text-sm font-semibold text-muted-foreground line-through">
              ${product.wasPrice.toLocaleString()}
            </span>
          ) : null}
        </div>
        <p className="vn-micro mt-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-500">
          Net ${Number(product.price || 0).toFixed(2)}
        </p>
      </div>

      {/* Stock / condition */}
      <div className="mt-4 flex flex-wrap items-center gap-2 px-4">
        <BuyerStatusPill status={product.condition === 'used' ? 'used' : 'new'} />
        {isOutOfStock ? (
          <BuyerStatusPill status="out of stock" />
        ) : (
          <span className="vn-micro inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-300">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {product.stock} in stock
          </span>
        )}
      </div>

      {/* Quantity + actions */}
      <div className="px-4 pt-5">
        <div className="flex items-center gap-3">
          <span className="vn-micro text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Qty
          </span>
          <div className="flex items-center gap-1 rounded-full border border-border p-1">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-sm font-semibold tabular-nums text-foreground">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQuantity((q) => Math.min(Math.max(product.stock ?? 1, 1), q + 1))}
              disabled={quantity >= Math.max(product.stock ?? 1, 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            onClick={handleAddToCart}
            disabled={isAdding || isOutOfStock}
            className="h-12 rounded-2xl border-white/10 bg-white/5 font-semibold text-foreground hover:bg-white/10"
          >
            {isAdding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="mr-2 h-4 w-4" />
            )}
            Add
          </Button>
          <Button
            onClick={handleBuyNow}
            disabled={isAdding || isOutOfStock}
            className="h-12 rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-500 font-semibold text-white"
          >
            Buy now
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        {isOutOfStock && (
          <p className="vn-micro mt-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            This item is sold out
          </p>
        )}
      </div>

      {/* Details */}
      <div className="mt-6 space-y-3 px-4">
        <BuyerCard>
          <p className="vn-micro text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-500 dark:text-cyan-400">
            Delivery
          </p>
          <div className="mt-3 space-y-3">
            <div className="flex items-start gap-3">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500 dark:text-cyan-400" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {product.deliveryOptions || 'Contact the seller for delivery options'}
                </p>
                {typeof product.shippingCost === 'number' && (
                  <p className="text-xs text-muted-foreground">
                    Shipping {product.shippingCost > 0 ? `$${product.shippingCost.toFixed(2)}` : 'is free'}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Store className="mt-0.5 h-4 w-4 shrink-0 text-violet-500 dark:text-violet-400" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {product.location || sellerShop?.location || 'Ships from the seller’s location'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {sellerShop?.returnPolicy || 'Returns accepted — see the seller for the terms'}
                </p>
              </div>
            </div>
          </div>
        </BuyerCard>

        {product.description && (
          <BuyerCard>
            <p className="vn-micro text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-500 dark:text-cyan-400">
              Description
            </p>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
            {product.tags && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {product.tags
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .slice(0, 8)
                  .map((tag) => (
                    <span
                      key={tag}
                      className="vn-micro rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
              </div>
            )}
          </BuyerCard>
        )}

        {/*
          Seller card — deliberately NOT a link. There is no app-side single
          seller storefront, and this screen must not be the one that throws a
          buyer out to `/sellers/{id}`. The contact details below are what make
          the row useful without navigating.
        */}
        <BuyerCard>
          <p className="vn-micro text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-500 dark:text-cyan-400">
            Seller
          </p>
          {/*
            Message seller — the in-app conversation.
            `?chatWith=<sellerId>` is what the messages screen reads to open this
            specific chat, so the buyer arrives already in the right thread.
            Deliberately above the WhatsApp link: this one keeps them in the app.
          */}
          {product.sellerId && (
            <Button
              asChild
              className="mt-3 h-11 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-500 font-semibold text-white"
            >
              <Link href={`/app/buyer/messages?chatWith=${encodeURIComponent(product.sellerId)}`}>
                <MessageCircle className="mr-2 h-4 w-4" />
                Message seller
              </Link>
            </Button>
          )}
          <div className="mt-3 flex items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-border">
              <Image
                src={sellerShop?.logoUrl || sellerProfile?.profilePictureUrl || getPlaceholderImage()}
                alt={sellerName}
                fill
                sizes="44px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{sellerName}</p>
              <p className="text-xs text-muted-foreground">
                {sellerShop?.location || product.location || 'Location not listed'}
              </p>
            </div>
          </div>

          {(sellerShop?.contactPhone || sellerShop?.contactEmail || sellerShop?.contactWhatsapp) && (
            <div className="mt-4 space-y-2 border-t border-border pt-3">
              {sellerShop?.contactWhatsapp && (
                <a
                  href={`https://wa.me/${sellerShop.contactWhatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-emerald-500 transition hover:underline"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp the seller
                </a>
              )}
              {sellerShop?.contactPhone && (
                <a
                  href={`tel:${sellerShop.contactPhone}`}
                  className="block text-sm text-muted-foreground transition hover:text-foreground"
                >
                  {sellerShop.contactPhone}
                </a>
              )}
              {sellerShop?.contactEmail && (
                <a
                  href={`mailto:${sellerShop.contactEmail}`}
                  className="block truncate text-sm text-muted-foreground transition hover:text-foreground"
                >
                  {sellerShop.contactEmail}
                </a>
              )}
            </div>
          )}
        </BuyerCard>
      </div>
    </div>
  );
}
