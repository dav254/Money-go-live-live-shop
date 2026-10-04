'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ChevronRight, Package, Search, Sparkles, Store, Wallet, Bell, Heart,
} from 'lucide-react';
import { collection, limit, query, where } from 'firebase/firestore';
import {
  useCollection, useFirestore, useMemoFirebase, useUser, useUserProfile,
} from '@/firebase';
import type { Order, Product } from '@/lib/types';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { ProductCard } from '@/components/products/product-card';
import {
  BuyerCard, BuyerEmptyState, BuyerSectionTitle, BuyerStatusPill,
} from '@/components/app/buyer/buyer-app-shell';

/**
 * BUYER APP · HOME.
 *
 * Clone of the website's buyer dashboard (`/buyer/dashboard`) — same greeting,
 * same search entry, same request-marketplace hook, same categories, same
 * deals, same recent orders — laid out for a phone inside the buyer section's
 * own design system.
 */

const CATEGORY_LABEL: Record<string, string> = {
  'Fashion & Apparel': 'FASHION',
  'Electronics & Gadgets': 'TECH',
  'Home & Living': 'HOME',
  'Beauty & Personal Care': 'BEAUTY',
  'Food & Groceries': 'FOOD',
  'Sports & Outdoors': 'SPORT',
  'Art & Collectibles': 'ART',
  'Books & Stationery': 'BOOKS',
  Other: 'MORE',
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function BuyerSectionHome() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { userProfile } = useUserProfile(user?.uid);

  const dealsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'products'), where('wasPrice', '>', 0), limit(8));
  }, [firestore]);

  const ordersQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'orders'), where('buyerId', '==', user.uid), limit(5));
  }, [firestore, user]);

  const pendingQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'orders'),
      where('buyerId', '==', user.uid),
      where('orderStatus', '==', 'pending'),
      limit(1),
    );
  }, [firestore, user]);

  const { data: deals, isLoading: areDealsLoading } = useCollection<Product>(dealsQuery);
  const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);
  const { data: pending } = useCollection<Order>(pendingQuery);

  const firstName = (userProfile as { fullName?: string } | null)?.fullName?.split(' ')[0];
  const isLoading = areDealsLoading || areOrdersLoading;

  // All app routes. `Wallet & payments` and `Saved items` pointed at the
  // website (`/buyer/wallet`, `/buyer/wishlist`), and `Notifications` pointed
  // at Account — a bell that opens your own profile. All three now stay in the
  // buyer section, which is what a shortcut on a section home screen is for.
  const shortcuts = [
    { label: 'Refunds & payments', icon: Wallet, href: '/app/buyer/wallet' },
    { label: 'Saved items', icon: Heart, href: '/app/buyer/shop?view=saved' },
    { label: 'Notifications', icon: Bell, href: '/app/buyer/notifications' },
    { label: 'My requests', icon: Sparkles, href: '/app/buyer/requests' },
    { label: 'My sellers', icon: Store, href: '/app/buyer/sellers' },
  ];

  return (
    <div className="vn-page-enter space-y-7 pb-2">
      {/* ── Ocean band ─────────────────────────────────────────────────── */}
      <section className="vn-buyer-band -mt-4 rounded-b-[2.25rem] px-5 pb-6 pt-6 shadow-lg">
        <p className="vn-micro text-[10px] font-bold uppercase tracking-[0.3em] text-white/70">
          {greeting()}
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white">
          {firstName ? `Welcome back, ${firstName}.` : 'Welcome to Vidnov.'}
        </h1>

        <Link
          href="/app/buyer/shop"
          className="mt-4 flex h-12 items-center gap-3 rounded-full bg-white/95 px-5 text-[#0A1224] shadow-lg transition hover:bg-white"
        >
          <Search className="h-4 w-4 text-[#0A1224]/60" />
          <span className="font-sans text-sm font-medium text-[#0A1224]/60">
            Search Vidnov…
          </span>
          <span className="vn-micro ml-auto hidden text-[9px] font-bold uppercase tracking-[0.18em] text-[#0A1224]/45 sm:inline">
            Products · Businesses · Services
          </span>
        </Link>

        {pending && pending.length > 0 && (
          <Link
            href={`/app/buyer/checkout/${pending[0].id}`}
            className="mt-3 flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 ring-1 ring-white/25 transition hover:bg-white/25"
          >
            <div className="min-w-0 flex-1">
              <p className="vn-micro text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                Payment awaiting
              </p>
              <p className="mt-0.5 truncate font-sans text-xs text-white/75">
                &ldquo;{pending[0].productName}&rdquo; — complete payment to start delivery.
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-white" />
          </Link>
        )}
      </section>

      {/* ── Request marketplace ────────────────────────────────────────── */}
      <section className="px-4">
        <Link href="/app/buyer/requests" className="block">
          <BuyerCard className="bg-gradient-to-br from-cyan-500/15 to-violet-500/15 ring-1 ring-cyan-400/25">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 text-white">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-foreground">Request Marketplace</p>
                <p className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">
                  Post what you need — with photos or a short video — and let matched
                  businesses come to you with offers.
                </p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </BuyerCard>
        </Link>
      </section>

      {/* ── Categories ─────────────────────────────────────────────────── */}
      <section>
        <BuyerSectionTitle
          eyebrow="Browse"
          title="Categories"
          action={
            <Link
              href="/app/buyer/shop"
              className="vn-micro text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
            >
              See all
            </Link>
          }
        />
        <div className="grid grid-cols-3 gap-2.5 px-4">
          {PRODUCT_CATEGORIES.slice(0, 9).map((cat) => (
            <Link
              key={cat}
              href={`/app/buyer/shop?q=${encodeURIComponent(cat)}`}
              className="vn-buyer-card flex items-center justify-center px-2 py-4 text-center transition hover:scale-[1.02]"
            >
              <span className="vn-micro text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {CATEGORY_LABEL[cat] || cat.split(' ')[0].toUpperCase()}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Deals ──────────────────────────────────────────────────────── */}
      <section>
        <BuyerSectionTitle eyebrow="Savings" title="Today's deals" />
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 px-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="vn-skeleton aspect-[4/5] w-full rounded-3xl" />
            ))}
          </div>
        ) : deals && deals.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 px-4">
            {deals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <BuyerEmptyState
            icon={Search}
            title="No active deals right now"
            body="Check back soon — sellers run offers through the Request Marketplace every day."
            action={
              <Link
                href="/app/buyer/shop"
                className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-2.5 font-sans text-xs font-semibold text-white"
              >
                Start browsing
              </Link>
            }
          />
        )}
      </section>

      {/* ── Recent orders ──────────────────────────────────────────────── */}
      <section>
        <BuyerSectionTitle
          eyebrow="Delivery"
          title="Recent orders"
          action={
            <Link
              href="/app/buyer/orders"
              className="vn-micro text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
            >
              All orders
            </Link>
          }
        />
        {isLoading ? (
          <BuyerCard>
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="vn-skeleton h-12 w-full rounded-2xl" />
              ))}
            </div>
          </BuyerCard>
        ) : orders && orders.length > 0 ? (
          <div className="space-y-2.5 px-4">
            {orders.slice(0, 3).map((order) => (
              <div
                key={order.id}
                className="vn-buyer-card flex items-center gap-3 p-3.5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-500 dark:text-cyan-300">
                  <Package className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {order.productName || 'Order'}
                  </p>
                  <p className="vn-micro mt-0.5 text-xs font-bold tabular-nums text-muted-foreground">
                    ${order.totalAmount?.toFixed?.(2) ?? order.totalAmount}
                  </p>
                </div>
                <BuyerStatusPill status={order.orderStatus} />
              </div>
            ))}
          </div>
        ) : (
          <BuyerEmptyState
            icon={Package}
            title="No orders yet"
            body="Anything you buy shows up here with live delivery tracking and the seller's contact."
            action={
              <Link
                href="/app/buyer/shop"
                className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-2.5 font-sans text-xs font-semibold text-white"
              >
                Shop the marketplace
              </Link>
            }
          />
        )}
      </section>

      {/* ── Account shortcuts ──────────────────────────────────────────── */}
      <section>
        <BuyerSectionTitle eyebrow="You" title="Your account" />
        <div className="grid grid-cols-2 gap-2.5 px-4">
          {shortcuts.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="vn-buyer-card flex items-center gap-2.5 p-3.5 transition hover:scale-[1.02]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-500 dark:text-violet-300">
                <item.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate font-sans text-xs font-medium text-foreground">
                {item.label}
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
