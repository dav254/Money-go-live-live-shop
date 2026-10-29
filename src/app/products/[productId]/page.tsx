'use client';

import React, { useState, useMemo, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import {
    MapPin, Plus, Store, Minus, X, Maximize2, Loader2, ShoppingCart, Truck,
    Facebook, Instagram, Twitter, MessageCircle, Mail, Phone, Clock, ShieldCheck,
    ArrowRight, Heart, Share2, Search, Menu, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Product, SellerShop, UserProfile } from '@/lib/types';
import {
    useCollection, useDoc, useFirestore, useMemoFirebase, useUser, useUserProfile,
    errorEmitter, FirestorePermissionError,
} from '@/firebase';
import {
    doc, setDoc, increment, serverTimestamp, collection, updateDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { mirrorOrder } from '@/lib/orders/mirror';
import { mirrorCartItem } from '@/lib/users/mirror';
import { captureShareRef, trackListingView } from '@/lib/growth/client';
import { Dialog, DialogContent, DialogTrigger, DialogClose, DialogTitle, DialogDescription, DialogHeader } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Logo } from '@/components/logo';
import { UserNav } from '@/components/layout/user-nav';
import { isService } from '@/components/listings/service-badge';
import { availabilityLabel } from '@/lib/discovery';

/* ──────────────────────────────────────────────────────────────────────────
 * PRODUCT PAGE — premium dark detail view.
 *
 * Structure follows the reference: compact header → gallery → identity/price
 * → seller → pickup & delivery → purchase panel → expandable details, with a
 * single fixed purchase bar on mobile.
 *
 * What is INVARIANT here: every piece of data on this page is read from the
 * real product / sellerShops / userProfiles documents, and every action
 * (cart, order, chat, wishlist, share) uses the existing routes, Firestore
 * paths and mirror helpers. No sample product, price, seller or shipping
 * value is ever hardcoded — absent data renders as absent.
 * ────────────────────────────────────────────────────────────────────────── */

const NAV_ITEMS = [
    { label: 'Discover', href: '/buyer/discovery' },
    { label: 'Create Studio', href: '/ai-studio' },
    { label: 'How It Works', href: '/how-it-works' },
] as const;

/** Formats a raw description into paragraphs; empty input renders as nothing. */
function formatDescription(text?: string): string[] {
    if (!text || !text.trim()) return [];
    const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
    return blocks.length > 0 ? blocks : [text.trim()];
}

/* ── Header ─────────────────────────────────────────────────────────────── */

function ProductHeader({ cartCount }: { cartCount: number }) {
    const router = useRouter();
    const [term, setTerm] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);

    const submitSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const q = term.trim();
        if (!q) return;
        router.push(`/search?q=${encodeURIComponent(q)}`);
    };

    return (
        /* `dark` scopes the theme tokens to this bar, so the shared account
           menu and logo read correctly on the near-black page even when the
           visitor's site theme is light. */
        <header className="dark sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur-xl">
            <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:h-16">
                <Link href="/" className="shrink-0 text-white" aria-label="Vidnov home">
                    <Logo className="text-xl" />
                </Link>

                <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
                    {NAV_ITEMS.map((item) => (
                        <Link
                            key={item.label}
                            href={item.href}
                            className="text-[13px] font-medium text-neutral-400 transition-colors hover:text-white"
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <form
                    onSubmit={submitSearch}
                    role="search"
                    className="hidden min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 transition focus-within:border-primary/60 sm:flex sm:max-w-xs"
                >
                    <Search className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden />
                    <input
                        type="search"
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        placeholder="Search products…"
                        aria-label="Search Vidnov"
                        className="w-full min-w-0 bg-transparent text-xs text-white placeholder:text-neutral-500 focus:outline-none"
                    />
                </form>

                <div className="ml-auto flex shrink-0 items-center gap-1">
                    <Link
                        href="/cart"
                        aria-label={`Shopping cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
                        title="Cart"
                        className="relative flex h-9 w-9 items-center justify-center rounded-full text-neutral-200 transition hover:bg-white/10 hover:text-white"
                    >
                        <ShoppingCart className="h-5 w-5" />
                        {cartCount > 0 && (
                            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-white">
                                {cartCount > 99 ? '99+' : cartCount}
                            </span>
                        )}
                    </Link>

                    <UserNav />

                    <button
                        type="button"
                        onClick={() => setMenuOpen((v) => !v)}
                        aria-expanded={menuOpen}
                        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-200 transition hover:bg-white/10 lg:hidden"
                    >
                        {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            {menuOpen && (
                <div className="border-t border-white/10 bg-black/95 lg:hidden">
                    <nav aria-label="Mobile" className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
                        <form
                            onSubmit={submitSearch}
                            role="search"
                            className="mb-2 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 focus-within:border-primary/60"
                        >
                            <Search className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden />
                            <input
                                type="search"
                                value={term}
                                onChange={(e) => setTerm(e.target.value)}
                                placeholder="Search products…"
                                aria-label="Search Vidnov"
                                className="w-full min-w-0 bg-transparent text-xs text-white placeholder:text-neutral-500 focus:outline-none"
                            />
                        </form>
                        {NAV_ITEMS.map((item) => (
                            <Link
                                key={item.label}
                                href={item.href}
                                onClick={() => setMenuOpen(false)}
                                className="rounded-lg px-2 py-2.5 text-sm font-medium text-neutral-300 transition hover:bg-white/5 hover:text-white"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            )}
        </header>
    );
}

/** Header + the site shell, so loading/error states keep their navigation too. */
function ProductShell({ cartCount, children }: { cartCount: number; children: React.ReactNode }) {
    return (
        <>
            <ProductHeader cartCount={cartCount} />
            <MainLayout>{children}</MainLayout>
        </>
    );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function BuyerProductPage(props: { params: Promise<{ productId: string }> }) {
    const params = use(props.params);
    const productId = params.productId;
    const firestore = useFirestore();

    // Growth spine (Phase 1): capture an arriving `?ref=` share code, then
    // record a QUALIFIED view — only after 2s of visible page time, and the
    // disposer cancels it when the visitor navigates away. Fire-and-forget:
    // measurement must never affect browsing.
    useEffect(() => {
        captureShareRef();
        return trackListingView(productId);
    }, [productId]);
    const { user, isLoading: isUserLoading } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
    const { toast } = useToast();
    const router = useRouter();
    const [quantity, setQuantity] = useState(1);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const productRef = useMemoFirebase(() => {
        return productId ? doc(firestore, 'products', productId) : null;
    }, [firestore, productId]);

    const { data: product, isLoading: isProductLoading } = useDoc<Product>(productRef);

    const sellerId = product?.sellerId;
    const sellerShopRef = useMemoFirebase(() => {
        return sellerId ? doc(firestore, 'sellerShops', sellerId) : null;
    }, [firestore, sellerId]);
    const sellerProfileRef = useMemoFirebase(() => {
        return sellerId ? doc(firestore, 'userProfiles', sellerId) : null;
    }, [firestore, sellerId]);

    const { data: sellerShop, isLoading: isSellerShopLoading } = useDoc<SellerShop>(sellerShopRef);
    const { data: sellerProfile, isLoading: isSellerProfileLoading } = useDoc<UserProfile>(sellerProfileRef);

    /* Real cart count for the header — the same subcollection the cart page,
       the buyer sidebar and checkout read, so the badge can never drift. */
    const cartQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'userProfiles', user.uid, 'cart');
    }, [firestore, user]);
    const { data: cartItems } = useCollection<{ id: string }>(cartQuery);
    const cartCount = cartItems?.length ?? 0;

    const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: 'video' | 'image' } | null>(null);
    const [saved, setSaved] = useState(false);

    // Reset local state when product ID changes
    useEffect(() => {
        setQuantity(1);
        setSelectedMedia(null);
    }, [productId]);

    useEffect(() => {
        setSaved((userProfile?.wishlist ?? []).includes(productId));
    }, [userProfile, productId]);

    type MediaFrame = { url: string; type: 'video' | 'image' };

    const allMedia = useMemo<MediaFrame[]>(() => {
        if (!product) return [];
        const media: MediaFrame[] = [];

        if (product.videoUrl && product.videoUrl.trim() !== "") media.push({ url: product.videoUrl, type: 'video' });
        if (Array.isArray(product.videoUrls)) {
            product.videoUrls.forEach(url => {
                if (url && url.trim() !== "" && !media.some(m => m.url === url)) {
                    media.push({ url, type: 'video' });
                }
            });
        }

        if (product.imageUrl && product.imageUrl.trim() !== "") media.push({ url: product.imageUrl, type: 'image' });
        if (Array.isArray(product.imageUrls)) {
            product.imageUrls.forEach(url => {
                if (url && url.trim() !== "" && !media.some(m => m.url === url)) {
                    media.push({ url, type: 'image' });
                }
            });
        }

        return media.length > 0 ? media : [{ url: getPlaceholderImage(), type: 'image' }];
    }, [product]);

    useEffect(() => {
        if (allMedia.length > 0 && !selectedMedia) {
            setSelectedMedia(allMedia[0]);
        }
    }, [allMedia, selectedMedia]);

    /* — real commerce facts, read straight from the listing — */

    const currency = (product?.localCurrency || 'USD').toUpperCase();
    // Display unit price follows the marketplace convention used by every
    // product card: a saved local price when the seller set one, else the
    // listing price the order is actually created with.
    const unitPrice = product ? Number(product.localPrice || product.price || 0) : 0;
    // A struck-through price is only shown when it is genuinely ABOVE the
    // price we display — never an invented discount.
    const wasPrice = product && typeof product.wasPrice === 'number' && product.wasPrice > unitPrice
        ? product.wasPrice
        : null;
    const discountPct = wasPrice ? Math.round(((wasPrice - unitPrice) / wasPrice) * 100) : 0;

    const stockValue = product?.stock;
    const stockKnown = typeof stockValue === 'number' && Number.isFinite(stockValue);
    // Stock data only ever RESTRICTS a purchase when it is actually present;
    // an absent field must not block a listing that has always been buyable.
    const unavailable = !!product && (
        product.availabilityState === 'out_of_stock' ||
        (stockKnown && !isService(product) && (stockValue as number) <= 0)
    );
    const maxQty = stockKnown && (stockValue as number) > 0 ? Math.floor(stockValue as number) : Number.POSITIVE_INFINITY;
    const availability = product ? availabilityLabel(product) : null;

    const mediaIndex = selectedMedia
        ? Math.max(0, allMedia.findIndex((m) => m.url === selectedMedia.url))
        : 0;
    const stepGallery = (delta: number) => {
        if (allMedia.length <= 1) return;
        const next = (mediaIndex + delta + allMedia.length) % allMedia.length;
        setSelectedMedia(allMedia[next]);
    };

    const descriptionParagraphs = formatDescription(product?.description);
    const tags = (product?.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean);
    const pickupLocation = product?.location || product?.vendorLocation || sellerShop?.location || '';

    /* — actions (unchanged paths & payloads) — */

    const handleAddToCart = () => {
        if (!user) { router.push('/login'); return; }
        if (!product || !firestore) return;
        if (unavailable) {
            toast({ variant: 'destructive', title: 'Out of stock', description: 'This listing cannot be added to a cart right now.' });
            return;
        }

        const cartItemRef = doc(firestore, 'userProfiles', user.uid, 'cart', product.id);
        const cartData = {
            productId: product.id || '',
            sellerId: product.sellerId || '',
            buyerId: user.uid,
            quantity: increment(quantity),
            price: product.price || 0,
            name: product.name || 'Unnamed Product',
            imageUrl: product.imageUrl || getPlaceholderImage(),
            addedAt: serverTimestamp(),
        };

        setDoc(cartItemRef, cartData, { merge: true })
            .then(() => mirrorCartItem(user, product.id))
            .catch(async () => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: cartItemRef.path,
                    operation: 'write',
                    requestResourceData: cartData,
                }));
            });

        toast({ title: 'Added to Cart' });
    };

    const handleBuyNow = () => {
        if (!user) { router.push('/login'); return; }
        if (!product || !firestore) return;
        if (unavailable) {
            toast({ variant: 'destructive', title: 'Out of stock', description: 'This listing cannot be ordered right now.' });
            return;
        }

        const ordersCollectionRef = collection(firestore, 'orders');
        const newOrderRef = doc(ordersCollectionRef);
        const shippingCost = product.shippingCost || 0;
        const subtotal = (product.price || 0) * quantity;

        const newOrderData = {
            id: newOrderRef.id,
            buyerId: user.uid,
            sellerId: product.sellerId || '',
            items: [{
                productId: product.id || '',
                name: product.name || 'Unnamed Product',
                price: product.price || 0,
                quantity,
                imageUrl: product.imageUrl || getPlaceholderImage()
            }],
            productName: product.name || 'Unnamed Product',
            productImage: product.imageUrl || getPlaceholderImage(),
            productPrice: product.price || 0,
            shippingCost: shippingCost,
            totalAmount: subtotal + shippingCost,
            subtotal: subtotal,
            orderDate: serverTimestamp(),
            orderStatus: 'pending',
            paymentMethod: 'pending',
            quantity: quantity,
            shippingAddress: userProfile?.location || 'Awaiting Input',
        };

        setDoc(newOrderRef, newOrderData)
            .then(() => {
                mirrorOrder(user, newOrderRef.id);
                toast({ title: 'Order Created!', description: 'Redirecting to checkout...' });
                router.push(`/checkout/${newOrderRef.id}`);
            })
            .catch(async () => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: newOrderRef.path,
                    operation: 'create',
                    requestResourceData: newOrderData,
                }));
            });
    };

    const toggleSave = async () => {
        if (!user) { router.push('/login'); return; }
        if (!firestore) return;
        const next = !saved;
        setSaved(next);
        try {
            await updateDoc(doc(firestore, 'userProfiles', user.uid), {
                wishlist: next ? arrayUnion(productId) : arrayRemove(productId),
            });
            toast({ title: next ? 'Saved' : 'Removed from saved' });
        } catch {
            setSaved(!next);
            toast({ variant: 'destructive', title: 'Could not update saved items' });
        }
    };

    const shareListing = async () => {
        const url = `${window.location.origin}/products/${productId}`;
        try {
            if (typeof navigator !== 'undefined' && navigator.share) {
                await navigator.share({ title: product?.name || 'Vidnov listing', url });
                return;
            }
            await navigator.clipboard.writeText(url);
            toast({ title: 'Link copied', description: 'The listing link is on your clipboard.' });
        } catch {
            /* A dismissed share sheet is not an error. */
        }
    };

    const isLoading = !isMounted || isProductLoading || isSellerShopLoading || isSellerProfileLoading || isUserLoading || isProfileLoading;
    if (isLoading) return (
        <ProductShell cartCount={cartCount}>
            <div className="flex h-[calc(100dvh-4rem)] items-center justify-center bg-black sm:h-[calc(100dvh-4rem)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        </ProductShell>
    );
    if (!product) return (
        <ProductShell cartCount={cartCount}>
            <div className="flex h-96 items-center justify-center text-white font-bold">Product not found</div>
        </ProductShell>
    );
    // Admin "Unpublish" — the listing still exists (the seller can still see
    // and edit it in their dashboard) but buyers arriving here get a clear
    // unavailable state instead of a buyable page.
    if (product.unpublished) return (
        <ProductShell cartCount={cartCount}>
            <div className="flex h-96 flex-col items-center justify-center gap-2 text-white text-center px-6">
                <span className="font-bold">This listing is no longer available</span>
                <span className="text-sm text-neutral-400">The seller or the marketplace has unpublished it.</span>
            </div>
        </ProductShell>
    );

    const inStockText = unavailable
        ? 'Out of stock'
        : availability
            ? availability.replace(/\b\w/g, (c) => c.toUpperCase())
            : null;

    return (
        <ProductShell cartCount={cartCount}>
            <div className="min-h-screen bg-black text-white pb-36 md:pb-16">
                <div className="mx-auto w-full max-w-4xl px-4 pt-5 sm:pt-8">

                    {/* ── B. Gallery ─────────────────────────────────────── */}
                    <div className="relative aspect-square max-h-[70vh] w-full overflow-hidden rounded-3xl border border-white/10 bg-[#050505] group md:aspect-[16/10]">
                        {selectedMedia?.type === 'image' ? (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <div className="cursor-zoom-in relative h-full w-full">
                                        <Image src={selectedMedia.url} alt={product?.name || 'Product media'} fill sizes="(max-width: 896px) 100vw, 896px" className="object-contain" priority />
                                        <div className="absolute bottom-4 right-4 bg-black/50 p-2 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Maximize2 className="h-5 w-5 text-white" />
                                        </div>
                                    </div>
                                </DialogTrigger>
                                <DialogContent className="max-w-none w-screen h-screen p-0 border-none bg-black/95 flex items-center justify-center z-[100]">
                                    <DialogHeader className="sr-only">
                                        <DialogTitle>{product.name} - Immersive View</DialogTitle>
                                        <DialogDescription>A high-fidelity full-screen view of the product image.</DialogDescription>
                                    </DialogHeader>
                                    <div className="relative w-full h-full flex items-center justify-center p-4">
                                        <DialogClose className="absolute top-6 right-6 z-[110] bg-white/10 hover:bg-white/20 p-3 rounded-full text-white">
                                            <X className="h-8 w-8" />
                                        </DialogClose>
                                        <div className="relative w-full h-full">
                                            <Image src={selectedMedia.url} alt={product?.name || 'Product media'} fill className="object-contain" />
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        ) : (
                            <video
                                src={selectedMedia?.url}
                                className="h-full w-full object-contain"
                                autoPlay
                                muted
                                loop
                                playsInline
                                controlsList="nodownload"
                                onContextMenu={(e) => e.preventDefault()}
                            />
                        )}

                        {/* Gallery position — only when the real media count is known. */}
                        {allMedia.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => stepGallery(-1)}
                                    aria-label="Previous photo"
                                    className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => stepGallery(1)}
                                    aria-label="Next photo"
                                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                                <span className="absolute bottom-3 left-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold tabular-nums text-white backdrop-blur">
                                    {mediaIndex + 1} / {allMedia.length}
                                </span>
                            </>
                        )}

                        {/* Favourite + share — wired to the existing wishlist
                            document and the native share sheet. */}
                        <div className="absolute right-3 top-3 flex gap-2">
                            <button
                                type="button"
                                onClick={toggleSave}
                                aria-pressed={saved}
                                aria-label={saved ? 'Remove from saved items' : 'Save this listing'}
                                className={cn(
                                    'flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                    saved ? 'bg-primary text-white' : 'bg-black/55 text-white hover:bg-black/75',
                                )}
                            >
                                <Heart className={cn('h-4 w-4', saved && 'fill-current')} />
                            </button>
                            <button
                                type="button"
                                onClick={shareListing}
                                aria-label="Share this listing"
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                <Share2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Thumbnail strip — real media only, hidden when there is a single item. */}
                    {allMedia.length > 1 && (
                        <div className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto border-y border-white/5 bg-neutral-900/50 px-3 py-3">
                            {allMedia.map((media, i) => (
                                <button
                                    key={i}
                                    onClick={() => setSelectedMedia(media)}
                                    aria-label={`Show media ${i + 1} of ${allMedia.length}`}
                                    aria-current={selectedMedia?.url === media.url}
                                    className={cn(
                                        'relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border-2 transition-all',
                                        selectedMedia?.url === media.url
                                            ? 'border-primary scale-105'
                                            : 'border-transparent opacity-60 hover:opacity-100',
                                    )}
                                >
                                    <Image src={media.url} alt="" fill sizes="64px" className="object-cover" />
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="space-y-6 py-8">
                        {/* ── C. Identity & pricing ──────────────────────── */}
                        <section className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                {product.category && (
                                    <Badge variant="secondary" className="bg-primary/10 text-primary font-black uppercase text-[10px] tracking-widest">
                                        {product.category}
                                    </Badge>
                                )}
                                {inStockText && (
                                    <span className={cn(
                                        'rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest',
                                        unavailable
                                            ? 'border-red-500/40 bg-red-500/10 text-red-400'
                                            : 'border-green-500/30 bg-green-500/10 text-green-400',
                                    )}>
                                        {inStockText}
                                    </span>
                                )}
                                {product.condition && (
                                    <span className="rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-neutral-300">
                                        {product.condition === 'new' ? 'New' : 'Used'}
                                    </span>
                                )}
                            </div>

                            <h1 className="font-grotesk text-2xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
                                {product.name}
                            </h1>

                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                <p className="text-3xl font-black tracking-tight text-primary sm:text-4xl">
                                    {currency} {unitPrice.toLocaleString()}
                                </p>
                                {wasPrice && (
                                    <p className="text-base font-medium text-neutral-500 line-through">
                                        {currency} {wasPrice.toLocaleString()}
                                    </p>
                                )}
                                {discountPct > 0 && (
                                    <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-white">
                                        -{discountPct}%
                                    </span>
                                )}
                            </div>

                            {descriptionParagraphs.length > 0 && (
                                <p className="line-clamp-2 text-sm leading-relaxed text-neutral-400">
                                    {descriptionParagraphs[0]}
                                </p>
                            )}
                        </section>

                        {/* ── D. Seller card ─────────────────────────────── */}
                        <section className="rounded-3xl border border-white/10 bg-neutral-900/60 p-4 sm:p-5">
                            <div className="flex items-center gap-3">
                                <Link href={`/sellers/${sellerId}`} className="group flex min-w-0 flex-1 items-center gap-3">
                                    <Avatar className="h-11 w-11 shrink-0 border border-white/10 group-hover:border-primary transition-all">
                                        <AvatarImage src={sellerShop?.logoUrl} />
                                        <AvatarFallback className="bg-neutral-800 text-xs font-black uppercase">
                                            {sellerShop?.shopName?.charAt(0) || 'S'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest leading-none text-neutral-500">Seller</p>
                                        <p className="mt-1 truncate text-sm font-bold uppercase tracking-tight text-white group-hover:text-primary transition-colors">
                                            {sellerShop?.shopName || 'Marketplace Seller'}
                                        </p>
                                    </div>
                                </Link>

                                {sellerShop?.isVerified && (
                                    <span className="flex shrink-0 items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-300">
                                        <ShieldCheck className="h-3 w-3" /> Verified
                                    </span>
                                )}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                                <Link
                                    href={`/sellers/${sellerId}`}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 px-3.5 text-[11px] font-bold uppercase tracking-wider text-neutral-200 transition hover:border-primary hover:text-primary"
                                >
                                    <Store className="h-3.5 w-3.5" /> Visit shop
                                </Link>
                                {user?.uid !== product.sellerId && (
                                    <Link
                                        href={`/messages?chatWith=${encodeURIComponent(product.sellerId || '')}`}
                                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#2D9CFF]/30 bg-[#2D9CFF]/5 px-3.5 text-[11px] font-bold uppercase tracking-wider text-[#2D9CFF] transition hover:bg-[#2D9CFF] hover:text-white"
                                    >
                                        <MessageCircle className="h-3.5 w-3.5" /> Chat with seller
                                    </Link>
                                )}
                            </div>

                            {(sellerShop?.contactEmail || sellerShop?.contactPhone) && (
                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/5 pt-3">
                                    {sellerShop?.contactEmail && (
                                        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-neutral-400">
                                            <Mail className="h-3.5 w-3.5 shrink-0 text-primary" />
                                            <span className="truncate">{sellerShop.contactEmail}</span>
                                        </span>
                                    )}
                                    {sellerShop?.contactPhone && (
                                        <span className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                                            <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
                                            {sellerShop.contactPhone}
                                        </span>
                                    )}
                                </div>
                            )}

                            {(sellerShop?.facebookUrl || sellerShop?.instagramUrl || sellerShop?.twitterUrl) && (
                                <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Connect</span>
                                    {sellerShop?.facebookUrl && <a href={sellerShop.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white transition hover:bg-blue-600"><Facebook className="h-3.5 w-3.5" /></a>}
                                    {sellerShop?.instagramUrl && <a href={sellerShop.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white transition hover:bg-pink-600"><Instagram className="h-3.5 w-3.5" /></a>}
                                    {sellerShop?.twitterUrl && <a href={sellerShop.twitterUrl} target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white transition hover:bg-sky-500"><Twitter className="h-3.5 w-3.5" /></a>}
                                </div>
                            )}

                            {/* In-app chat only: the conversation stays attached
                                to the platform (orders, disputes, receipts all
                                live here) and no personal number is exposed. */}
                        </section>

                        {/* ── E. Pickup & delivery ───────────────────────── */}
                        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-neutral-900/60 p-4">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                                    <MapPin className="h-5 w-5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Pickup location</p>
                                    <p className="truncate text-sm font-bold uppercase tracking-tight text-white">
                                        {pickupLocation || 'Not specified'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-neutral-900/60 p-4">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                                    <Truck className="h-5 w-5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Shipping</p>
                                    <p className="truncate text-sm font-bold tracking-tight text-white">
                                        {product.deliveryOptions || 'Arranged with seller'}
                                        {' — '}
                                        {typeof product.shippingCost === 'number' ? (
                                            product.shippingCost === 0
                                                ? <span className="text-green-400">Free</span>
                                                : <span className="text-green-400">{currency} {product.shippingCost.toFixed(2)}</span>
                                        ) : (
                                            <span className="text-neutral-400">Calculated at checkout</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* ── F. Quantity & purchase actions ─────────────── */}
                        <section className="rounded-3xl border border-white/10 bg-neutral-900/60 p-4 sm:p-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Quantity</p>
                                    {stockKnown && !unavailable && (
                                        <p className="mt-1 text-[11px] font-medium text-neutral-400">
                                            {(stockValue as number) <= 5
                                                ? `Only ${Math.floor(stockValue as number)} left in stock`
                                                : `${Math.floor(stockValue as number)} available`}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-black/40 p-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Decrease quantity"
                                        className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10"
                                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                        disabled={quantity <= 1}
                                    >
                                        <Minus className="h-4 w-4" />
                                    </Button>
                                    <span className="w-8 text-center font-black text-lg tabular-nums">{quantity}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Increase quantity"
                                        className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10"
                                        onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
                                        disabled={quantity >= maxQty}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <Button
                                    variant="secondary"
                                    disabled={unavailable}
                                    className="h-14 rounded-2xl border border-white/15 bg-black/50 font-black uppercase tracking-widest text-xs text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                                    onClick={handleAddToCart}
                                >
                                    <ShoppingCart className="mr-2 h-4 w-4" /> Add to cart
                                </Button>
                                <Button
                                    disabled={unavailable}
                                    className="h-14 rounded-2xl bg-primary font-black uppercase tracking-widest text-xs text-white shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                                    onClick={handleBuyNow}
                                >
                                    Buy now <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>

                            {unavailable && (
                                <p className="mt-3 text-center text-[11px] font-bold uppercase tracking-widest text-red-400">
                                    This listing is out of stock
                                </p>
                            )}
                        </section>

                        {/* ── G. Details ─────────────────────────────────── */}
                        <Accordion type="single" collapsible className="w-full space-y-4" defaultValue="description">
                            <AccordionItem value="description" className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-900/40 px-5 sm:px-6">
                                <AccordionTrigger className="py-5 text-[11px] font-black uppercase tracking-[0.2em] text-white hover:no-underline">
                                    Product specifications
                                </AccordionTrigger>
                                <AccordionContent className="pb-6">
                                    {descriptionParagraphs.length > 0 ? (
                                        <div className="space-y-3 text-sm leading-relaxed font-medium text-neutral-300">
                                            {descriptionParagraphs.map((paragraph, i) => (
                                                <p key={i} className="whitespace-pre-wrap break-words">{paragraph}</p>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-neutral-500">
                                            The seller has not published a description for this listing.
                                        </p>
                                    )}

                                    <dl className="mt-4 grid grid-cols-1 gap-2 border-t border-white/5 pt-4 text-[12px] sm:grid-cols-2">
                                        {product.brand && (
                                            <div className="flex justify-between gap-3 rounded-xl bg-white/5 px-3 py-2">
                                                <dt className="text-neutral-500">Brand</dt>
                                                <dd className="truncate font-bold text-white">{product.brand}</dd>
                                            </div>
                                        )}
                                        {product.category && (
                                            <div className="flex justify-between gap-3 rounded-xl bg-white/5 px-3 py-2">
                                                <dt className="text-neutral-500">Category</dt>
                                                <dd className="truncate font-bold text-white">{product.category}</dd>
                                            </div>
                                        )}
                                        {product.condition && (
                                            <div className="flex justify-between gap-3 rounded-xl bg-white/5 px-3 py-2">
                                                <dt className="text-neutral-500">Condition</dt>
                                                <dd className="font-bold capitalize text-white">{product.condition}</dd>
                                            </div>
                                        )}
                                        {stockKnown && (
                                            <div className="flex justify-between gap-3 rounded-xl bg-white/5 px-3 py-2">
                                                <dt className="text-neutral-500">Stock</dt>
                                                <dd className="font-bold text-white">{Math.floor(stockValue as number)} units</dd>
                                            </div>
                                        )}
                                    </dl>

                                    {tags.length > 0 && (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {tags.map((tag) => (
                                                <Badge key={tag} variant="outline" className="border-white/10 bg-white/5 text-[9px] font-black uppercase py-1 px-3 text-neutral-300">
                                                    #{tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="policies" className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-900/40 px-5 sm:px-6">
                                <AccordionTrigger className="py-5 text-[11px] font-black uppercase tracking-[0.2em] text-white hover:no-underline">
                                    Shipping information & returns
                                </AccordionTrigger>
                                <AccordionContent className="pb-6 space-y-5 text-sm leading-relaxed font-medium text-neutral-300">
                                    {(!sellerShop?.deliveryPolicy && !sellerShop?.returnPolicy && !sellerShop?.storeHours) ? (
                                        <p className="text-neutral-500">
                                            The seller has not published delivery or return terms for this listing. Message them to confirm the details before ordering.
                                        </p>
                                    ) : (
                                        <>
                                            {sellerShop?.deliveryPolicy && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 text-white">
                                                        <Truck className="h-4 w-4 text-primary" />
                                                        <h4 className="text-[10px] font-black uppercase tracking-widest">Delivery policy</h4>
                                                    </div>
                                                    <p className="break-words rounded-2xl border border-white/5 bg-white/5 p-4 leading-relaxed">
                                                        {sellerShop.deliveryPolicy}
                                                    </p>
                                                </div>
                                            )}
                                            {sellerShop?.returnPolicy && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 text-white">
                                                        <ShieldCheck className="h-4 w-4 text-primary" />
                                                        <h4 className="text-[10px] font-black uppercase tracking-widest">Return policy</h4>
                                                    </div>
                                                    <p className="break-words rounded-2xl border border-white/5 bg-white/5 p-4 leading-relaxed">
                                                        {sellerShop.returnPolicy}
                                                    </p>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-white/5 pt-4 text-[12px] font-bold uppercase tracking-tight text-neutral-400">
                                        {sellerShop?.storeHours && (
                                            <span className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-primary" />
                                                Store hours: <span className="text-white normal-case">{sellerShop.storeHours}</span>
                                            </span>
                                        )}
                                        {pickupLocation && (
                                            <span className="flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-primary" />
                                                Pickup: <span className="text-white normal-case">{pickupLocation}</span>
                                            </span>
                                        )}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                </div>

                {/* ── H. Mobile purchase bar (single, safe-area aware) ── */}
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/92 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] md:hidden">
                    <div className="flex items-center gap-3 px-4 py-3">
                        <Link
                            href={`/sellers/${sellerId}`}
                            aria-label="Visit the seller's shop"
                            className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-neutral-300 transition hover:border-primary hover:text-primary"
                        >
                            <Store className="h-4 w-4" />
                            <span className="mt-0.5 text-[8px] font-black uppercase tracking-widest">Shop</span>
                        </Link>
                        <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">
                                {quantity > 1 ? `Total (${quantity})` : 'Price'}
                            </p>
                            <p className="truncate text-lg font-black leading-tight text-primary">
                                {currency} {(unitPrice * quantity).toLocaleString()}
                            </p>
                        </div>
                        <Button
                            disabled={unavailable}
                            className="h-12 shrink-0 rounded-2xl bg-primary px-6 font-black uppercase tracking-widest text-xs text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={handleBuyNow}
                        >
                            {unavailable ? 'Out of stock' : 'Buy now'}
                        </Button>
                    </div>
                </div>
            </div>
        </ProductShell>
    );
}
