'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import {
  Bell, ChevronLeft, Home, Boxes, Plus, Package, Search,
  Loader2, Menu, MessageSquare,
} from 'lucide-react';
import {
  useFirestore, useUser, useUserProfile, useMemoFirebase, useCollection,
} from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Order } from '@/lib/types';
import { Logo } from '@/components/logo';
import { SellerNavDrawer } from '@/components/app/seller/seller-nav-drawer';
import { resolveRole } from '@/lib/auth/roles';
import { cn } from '@/lib/utils';

/** SELLER APP SHELL. */
export function SellerAppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const role = resolveRole(userProfile);
  const allowed = role === 'seller' || role === 'reseller';
  const [navOpen, setNavOpen] = React.useState(false);
  const immersive = useImmersiveRoute();
  const router = useRouter();
  const pathname = usePathname() ?? '';

  React.useEffect(() => {
    if (!isLoading && !isProfileLoading && !user) {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isProfileLoading, user, pathname, router]);

  if (isLoading || isProfileLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
        </div>
        <div className="space-y-2">
          <h1 className="font-grotesk text-lg font-semibold text-foreground">
            This part of the app is not open for your account
          </h1>
          <p className="mx-auto max-w-xs text-sm text-muted-foreground">
            This area is only for sellers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="vn-seller-scope flex min-h-screen flex-col bg-background font-sora">
      {/* This IS the one header on discovery: hamburger, Vidnov name and the
          search button (see SellerTopBar). */}
      <SellerTopBar onOpenNav={() => setNavOpen(true)} immersive={immersive} />

      {/* No `pb-28` in immersive mode: that padding exists purely to clear the
          tab bar, and the tab bar is not rendered there. Leaving it would put
          a finger-sized dead gap under the composer. */}
      <main
        className={cn(
          'mx-auto w-full max-w-md flex-1',
          immersive ? 'pb-2 pt-0' : 'pb-28 pt-4',
        )}
      >
        {children}
      </main>

      {!immersive && <SellerTabBar />}

      <SellerNavDrawer open={navOpen} onClose={() => setNavOpen(false)} />
    </div>
  );
}

/* ── Tab bar ─────────────────────────────────────────────────────────────── */

interface SellerTab {
  key: string;
  label: string;
  icon: React.ElementType;
  href: string;
  raised?: boolean;
}

/** The seller section's own navigation — nothing here points outside it. */
/** The five slots the tab bar can hold. */
const SELLER_TABS: SellerTab[] = [
  { key: 'home', label: 'Overview', icon: Home, href: '/app/seller' },
  { key: 'products', label: 'Stock', icon: Boxes, href: '/app/seller/products' },
  { key: 'create', label: 'Create', icon: Plus, href: '/app/seller/create', raised: true },
  { key: 'orders', label: 'Orders', icon: Package, href: '/app/seller/orders' },
  { key: 'messages', label: 'Messages', icon: MessageSquare, href: '/app/seller/messages' },
];

/** Live order count for the badge. */
function useSellerLiveOrderCount(): number {
  const { user } = useUser();
  const firestore = useFirestore();

  const ordersQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'orders'),
      where('sellerId', '==', user.uid),
      where('orderStatus', 'in', ['pending', 'paid', 'processing']),
    );
  }, [firestore, user]);

  const { data: orders } = useCollection<Order>(ordersQuery);
  return orders?.length ?? 0;
}

function SellerTabBar() {
  const pathname = usePathname();
  const liveOrders = useSellerLiveOrderCount();

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (pathname === href) return true;
    if (href === '/app/seller') return false;
    return pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="vn-app-tabbar fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-end justify-around px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
        {SELLER_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-label={tab.label}
            aria-current={isActive(tab.href) ? 'page' : undefined}
            className="relative flex flex-1 flex-col items-center gap-0.5 px-1 py-1"
          >
            {tab.raised ? (
              <span className="absolute -top-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-red-500 text-white shadow-lg shadow-red-500/30">
                <tab.icon className="h-5 w-5" />
              </span>
            ) : (
              <span className="relative">
                <tab.icon
                  className={cn(
                    'h-5 w-5',
                    isActive(tab.href) ? 'text-primary' : 'text-muted-foreground',
                  )}
                />
                {tab.key === 'orders' && liveOrders > 0 && (
                  <span className="bg-primary absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white">
                    {liveOrders > 9 ? '9+' : liveOrders}
                  </span>
                )}
              </span>
            )}
            <span
              className={cn(
                'text-[9px] font-semibold uppercase tracking-wide',
                tab.raised && 'mt-6',
                isActive(tab.href) ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {tab.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

/* ── Top bar ─────────────────────────────────────────────────────────────── */

const IMMERSIVE_ROUTES = ['/app/seller/messages', '/app/seller/discovery'];

function useImmersiveRoute(): boolean {
  const pathname = usePathname();
  if (!pathname) return false;
  return IMMERSIVE_ROUTES.includes(pathname);
}

function SellerTopBar({ onOpenNav, immersive = false }: { onOpenNav: () => void; immersive?: boolean }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const onDiscovery = pathname === '/app/seller/discovery';
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const profile = (userProfile ?? null) as { fullName?: string } | null;

  const initials = (profile?.fullName ?? 'Seller')
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (immersive) {
    return (
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-md items-center gap-2 px-3">
          <button
            type="button"
            onClick={onOpenNav}
            aria-label="Open the seller menu"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Discovery's identity and search live HERE now — the section's own
              bar is gone, so this is the only header on the screen. */}
          {onDiscovery && <Logo className="ml-1 text-lg" />}
          {onDiscovery && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('vidnov:open-search'))}
              aria-label="Search & filters"
              title="Search & filters"
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary"
            >
              <Search className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-md items-center gap-3 px-4">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open the seller menu"
          className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* `ml-auto` was on the section pill; with the pill gone the logo takes
            over pushing the actions right, so the bar keeps its shape. */}
        <Logo className="ml-auto text-xl" />

        <Link
          href="/app/seller/notifications"
          aria-label="Notifications"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary"
        >
          <Bell className="h-4 w-4" />
        </Link>

        <Link
          href="/app/seller/account"
          aria-label="Account"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-red-500 text-[11px] font-bold text-white"
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}

/** Small shared pieces used by more than one seller screen. */
export function SellerSectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3 px-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
          {eyebrow}
        </p>
        <h1 className="font-grotesk mt-1.5 text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}

export function SellerCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/80 bg-card p-4 shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Status pill — the app stacks cards instead of the website's dense tables. */
export function OrderStatusPill({ status }: { status: string }) {
  const tone = React.useMemo(() => {
    switch (status) {
      case 'delivered':
      case 'shipped':
      case 'paid':
        return 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400';
      case 'pending':
        return 'bg-amber-500/12 text-amber-600 dark:text-amber-400';
      case 'processing':
      case 'packed':
        return 'bg-sky-500/12 text-sky-600 dark:text-sky-400';
      case 'cancelled':
      case 'refunded':
      case 'disputed':
        return 'bg-red-500/12 text-red-600 dark:text-red-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  }, [status]);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
        tone,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-4 flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="font-grotesk mt-4 text-base font-semibold text-foreground">{title}</p>
      <p className="mt-1.5 max-w-[16rem] text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
