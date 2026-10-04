'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Boxes, Clapperboard, Clock, Eye, MessageSquare, Package, Plus,
  Sparkles, Store, Users, Wallet,
} from 'lucide-react';
import {
  useCollection, useDoc, useFirestore, useMemoFirebase, useUser, useUserProfile,
} from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import type { Order, Payout, Product, SellerShop } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  EmptyState, OrderStatusPill, SellerCard, SellerSectionTitle,
} from '@/components/app/seller/seller-app-shell';
import { ListingThumb } from '@/components/app/seller/listing-thumb';

/**
 * SELLER APP · OVERVIEW.
 *
 * The content is a clone of the website's seller dashboard (`/dashboard/seller`)
 * — same greeting, same business overview, same today row, same quick actions,
 * same products and orders — but it lives in its own route tree with its own
 * shell, type scale and colour. Nothing here is shared with the buyer section:
 * different directory, different layout, different CSS scope.
 */



function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function SellerSectionOverview() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);

  const shopRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, `sellerShops/${user.uid}`);
  }, [firestore, user]);

  const productsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const ordersQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'orders'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const payoutsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'payouts'),
      where('sellerId', '==', user.uid),
      where('status', '==', 'completed'),
    );
  }, [firestore, user]);

  const { data: shop, isLoading: isShopLoading } = useDoc<SellerShop>(shopRef);
  const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);
  const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);
  const { data: payouts } = useCollection<Payout>(payoutsQuery);

  const isLoading =
    isUserLoading || isProfileLoading || isShopLoading || areProductsLoading || areOrdersLoading;

  /*
   * Reconcile the view/like bonus when the seller opens their overview.
   *
   * The payout is a server transaction that pays only the difference between
   * what the listing has earned and what it has already been paid, so calling
   * it on every visit costs one small transaction and cannot double-pay.
   * This is the trigger, not the source of truth — a cron on the VPS should
   * also call `/api/listings/bonus` so a seller who never opens this screen
   * still gets paid.
   */
  React.useEffect(() => {
    if (!user || !products || products.length === 0) return;
    let alive = true;
    void (async () => {
      try {
        const token = await user.getIdToken();
        await Promise.all(
          products.map((p) =>
            fetch('/api/listings/bonus', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ listingId: p.id }),
            }).catch(() => undefined),
          ),
        );
        // The profile doc is live, so the balance below updates on its own
        // once the transaction commits.
        if (alive) return;
      } catch {
        /* A missed reconcile is not worth an error state — it pays next visit. */
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, products]);

  const stats = React.useMemo(() => {
    const likes = products?.reduce((sum, p) => sum + (p.likes || 0), 0) ?? 0;
    const views = products?.reduce((sum, p) => sum + (p.viewCount || 0), 0) ?? 0;
    const settled = orders?.filter(
      (o) => o.orderStatus === 'delivered' || o.orderStatus === 'shipped',
    ) ?? [];
    const revenue = settled.reduce((sum, o) => sum + o.totalAmount, 0);
    const paidOut = payouts?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
    const newOrders = orders?.filter((o) => o.orderStatus === 'pending').length ?? 0;
    const processing = orders?.filter((o) => o.orderStatus === 'processing').length ?? 0;
    const lowStock = products?.filter((p) => p.stock > 0 && p.stock <= 3).length ?? 0;
    const outOfStock = products?.filter((p) => p.stock === 0).length ?? 0;
    return {
      likes,
      views,
      balance: revenue * 0.9 - paidOut,
      newOrders,
      processing,
      lowStock,
      outOfStock,
      orderCount: orders?.length ?? 0,
    };
  }, [products, orders, payouts]);

  const recentProducts = React.useMemo(
    () => (products ?? []).slice().sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0)).slice(0, 3),
    [products],
  );

  const recentOrders = React.useMemo(
    () => (orders ?? []).slice().slice(0, 3),
    [orders],
  );

  const initials = (userProfile?.fullName ?? 'Seller')
    .split(' ')
    .map((p: string) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const statTiles = [
    { label: 'Balance', value: `$${stats.balance.toFixed(0)}`, accent: true, icon: Wallet },
    { label: 'Orders', value: String(stats.orderCount), icon: Package },
    { label: 'Followers', value: String(shop?.followers ?? '—'), icon: Users },
    { label: 'Views', value: stats.views.toLocaleString(), icon: Eye },
  ];

  const today = [
    { label: 'New orders', value: stats.newOrders, href: '/app/seller/orders' },
    { label: 'Processing', value: stats.processing, href: '/app/seller/orders' },
  ];

  const quickActions = [
    { label: 'New listing', hint: 'Photos, price, delivery', icon: Plus, href: '/app/seller/create' },
    // The section's own AI Studio screen, not the website's `/seller/studio/product`.
    // A quick action that throws the seller out of the app is worse than not
    // offering it at all.
    { label: 'AI Studio', hint: 'Ads, images, voiceover', icon: Clapperboard, href: '/app/seller/ai-studio' },
    { label: 'Stock', hint: 'Everything you sell', icon: Boxes, href: '/app/seller/products' },
    { label: 'Requests', hint: 'Briefs looking for you', icon: Sparkles, href: '/app/seller/requests' },
  ];

  return (
    <div className="vn-page-enter space-y-7 pb-2">
      {/* ── Ember band: the single clearest signal that this is the app ──── */}
      <section className="vn-seller-band -mt-4 rounded-b-[2rem] px-5 pb-6 pt-6 shadow-lg">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-sm font-bold ring-1 ring-white/25">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">
              {greeting()}
            </p>
            <h1 className="font-grotesk truncate text-2xl font-bold tracking-tight text-white">
              {shop?.shopName || userProfile?.fullName || 'Your business'}
            </h1>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ring-1 ring-white/25">
            <Store className="h-3 w-3" />
            Seller
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Link
            href="/app/seller/earnings"
            className="rounded-2xl bg-white/12 px-4 py-3 ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20"
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/70">
              Available balance
            </p>
            <p className="font-grotesk mt-1 text-xl font-bold tabular-nums text-white">
              {isLoading ? '—' : `$${stats.balance.toFixed(2)}`}
            </p>
          </Link>
          <div className="rounded-2xl bg-white/12 px-4 py-3 ring-1 ring-white/20 backdrop-blur">
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/70">
              Live orders
            </p>
            <p className="font-grotesk mt-1 text-xl font-bold tabular-nums text-white">
              {isLoading ? '—' : stats.newOrders + stats.processing}
            </p>
          </div>
        </div>
      </section>

      {/* ── Business overview ─────────────────────────────────────────────── */}
      <section>
        <SellerSectionTitle eyebrow="Business" title="Overview" />
        <div className="grid grid-cols-2 gap-3 px-4">
          {statTiles.map((tile) => (
            <SellerCard key={tile.label} className="vn-app-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {tile.label}
                </p>
                <tile.icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="font-grotesk mt-2 text-2xl font-bold tabular-nums text-foreground">
                {isLoading ? '—' : tile.value}
              </p>
              {tile.accent && <span className="mt-2 block h-1 w-8 rounded-full bg-primary" />}
            </SellerCard>
          ))}
        </div>
      </section>

      {/* ── Stock attention ───────────────────────────────────────────────── */}
      {!isLoading && (stats.lowStock > 0 || stats.outOfStock > 0) && (
        <SellerCard className="vn-app-card border-amber-500/40 bg-amber-500/8 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">
            <Sparkles className="mr-1.5 inline h-3 w-3" />
            Stock attention
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {stats.outOfStock > 0 && (
              <>
                <span className="font-semibold text-foreground">{stats.outOfStock}</span> out of
                stock
              </>
            )}
            {stats.outOfStock > 0 && stats.lowStock > 0 && ' · '}
            {stats.lowStock > 0 && (
              <>
                <span className="font-semibold text-foreground">{stats.lowStock}</span> running low
              </>
            )}
            . Restock before the next order lands.
          </p>
          <Link
            href="/app/seller/products"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400"
          >
            Manage stock →
          </Link>
        </SellerCard>
      )}

      {/* ── Today ─────────────────────────────────────────────────────────── */}
      <section>
        <SellerSectionTitle eyebrow="Today" title="Your desk" />
        <div className="grid grid-cols-3 gap-2.5 px-4">
          {today.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="vn-app-card rounded-2xl border border-border/80 bg-card px-3 py-3.5 transition hover:border-primary/50"
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {item.label}
              </p>
              <p className="font-grotesk mt-1.5 text-xl font-bold tabular-nums text-foreground">
                {isLoading ? '—' : item.value !== null ? item.value : '—'}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Quick actions ─────────────────────────────────────────────────── */}
      <section>
        <SellerSectionTitle eyebrow="Create" title="Quick actions" />
        <div className="grid grid-cols-2 gap-3 px-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="vn-app-card group flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 transition hover:border-primary/50 hover:bg-secondary"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <action.icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">{action.label}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{action.hint}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Recent orders ─────────────────────────────────────────────────── */}
      <section>
        <SellerSectionTitle
          eyebrow="Fulfilment"
          title="Recent orders"
          action={
            <Link
              href="/app/seller/orders"
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground"
            >
              All orders
            </Link>
          }
        />
        {isLoading ? (
          <SellerCard className="vn-app-card p-4">
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="vn-skeleton h-12 w-full rounded-xl" />
              ))}
            </div>
          </SellerCard>
        ) : recentOrders.length > 0 ? (
          <div className="space-y-2.5 px-4">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="vn-app-card flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3.5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Package className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {order.productName || 'Order'}
                  </p>
                  <p className="font-grotesk mt-0.5 text-xs font-bold tabular-nums text-muted-foreground">
                    ${order.totalAmount?.toFixed?.(2) ?? order.totalAmount}
                  </p>
                </div>
                <OrderStatusPill status={order.orderStatus} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Package}
            title="No orders yet"
            body="Orders land here the moment a buyer checks out. Keep your listings stocked and priced."
            action={
              <Link
                href="/app/seller/create"
                className="bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
              >
                Create a listing
              </Link>
            }
          />
        )}
      </section>

      {/* ── Recent products ───────────────────────────────────────────────── */}
      <section>
        <SellerSectionTitle
          eyebrow="Inventory"
          title="Best performing"
          action={
            <Link
              href="/app/seller/products"
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground"
            >
              See all
            </Link>
          }
        />
        {isLoading ? (
          <SellerCard className="vn-app-card p-4">
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="vn-skeleton h-14 w-full rounded-xl" />
              ))}
            </div>
          </SellerCard>
        ) : recentProducts.length > 0 ? (
          <div className="space-y-2.5 px-4">
            {recentProducts.map((product) => (
              <div
                key={product.id}
                className="vn-app-card flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3"
              >
                <ListingThumb
                  src={product.imageUrl}
                  alt={product.name || 'Product image'}
                  className="h-12 w-12 shrink-0 rounded-xl border border-border"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                  <p className="font-grotesk mt-0.5 text-xs font-bold tabular-nums text-foreground">
                    ${product.price?.toLocaleString()}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider',
                    product.stock > 0
                      ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-500/12 text-red-600 dark:text-red-400',
                  )}
                >
                  {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Boxes}
            title="Your shelf is empty"
            body="Add your first product to start selling. Video listings sell faster."
            action={
              <Link
                href="/app/seller/create"
                className="bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
              >
                Add product
              </Link>
            }
          />
        )}
      </section>

      {/* ── Stats footer strip ────────────────────────────────────────────── */}
      <section className="px-4">
        <div className="vn-app-card flex items-center justify-around rounded-2xl border border-border/80 bg-card px-2 py-3.5">
          {[
            { icon: Clock, label: 'Processing', value: stats.processing },
            { icon: MessageSquare, label: 'Likes', value: stats.likes },
            { icon: Eye, label: 'Views', value: stats.views },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1 px-2">
              <item.icon className="h-3.5 w-3.5 text-primary" />
              <span className="font-grotesk text-sm font-bold tabular-nums text-foreground">
                {isLoading ? '—' : item.value.toLocaleString()}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
