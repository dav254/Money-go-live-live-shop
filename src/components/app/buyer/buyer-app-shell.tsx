'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode, SVGProps } from 'react';

import {
  Home, Search, ShoppingCart, Package, User,
  Loader2, Menu,
} from 'lucide-react';
import {
  useCollection, useFirestore, useUser, useUserProfile,
} from '@/firebase';
import { collection } from 'firebase/firestore';
import type { CartItem } from '@/lib/types';
import { Logo } from '@/components/logo';
import { NotificationsBell } from '@/components/notifications/notifications-bell';
import { BuyerNavDrawer } from '@/components/app/buyer/buyer-nav-drawer';
import { resolveRole } from '@/lib/auth/roles';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Buyer helper components used by the buyer app pages.
// ---------------------------------------------------------------------------

interface BuyerCardProps {
  children: ReactNode;
  className?: string;
}

export function BuyerCard({ children, className }: BuyerCardProps) {
  return (
    <div className={cn(
      'rounded-2xl border border-white/10 bg-white/5 p-4',
      className,
    )}>
      {children}
    </div>
  );
}

interface BuyerSectionTitleProps {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}

export function BuyerSectionTitle({ eyebrow, title, action }: BuyerSectionTitleProps) {
  return (
    <div className="flex items-center justify-between gap-3 pb-2">
      <div className="min-w-0">
        {eyebrow && (
          <p className="vn-micro text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">
            {eyebrow}
          </p>
        )}
        <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
      </div>
      {action}
    </div>
  );
}

interface BuyerEmptyStateProps {
  icon: React.ElementType<SVGProps<SVGSVGElement>>;
  title: string;
  body?: string;
  action?: ReactNode;
}

export function BuyerEmptyState({ icon: Icon, title, body, action }: BuyerEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/60">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-white">{title}</p>
      {body && (
        <p className="text-xs text-white/60">{body}</p>
      )}
      {action}
    </div>
  );
}

type BuyerStatus = 'pending' | 'processing' | 'shipped' | 'packed' | 'delivery' | 'delivered' | 'cancelled' | 'refunded' | 'disputed';

interface BuyerStatusPillProps {
  status: BuyerStatus | string;
}

export function BuyerStatusPill({ status }: BuyerStatusPillProps) {
  const normalized = typeof status === 'string' ? status.toLowerCase() : 'unknown';

  const config: Record<string, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'bg-yellow-500/20 text-yellow-200' },
    processing: { label: 'Processing', className: 'bg-blue-500/20 text-blue-200' },
    shipped: { label: 'Shipped', className: 'bg-indigo-500/20 text-indigo-200' },
    packed: { label: 'Packed', className: 'bg-purple-500/20 text-purple-200' },
    delivery: { label: 'Out for delivery', className: 'bg-teal-500/20 text-teal-200' },
    delivered: { label: 'Delivered', className: 'bg-emerald-500/20 text-emerald-200' },
    cancelled: { label: 'Cancelled', className: 'bg-red-500/20 text-red-200' },
    refunded: { label: 'Refunded', className: 'bg-gray-500/20 text-gray-200' },
    disputed: { label: 'Disputed', className: 'bg-orange-500/20 text-orange-200' },
  };

  const entry = config[normalized] ?? { label: normalized || 'Unknown', className: 'bg-white/10 text-white/60' };

  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
      entry.className,
    )}>
      {entry.label}
    </span>
  );
}

/** BUYER APP SHELL. */
export function BuyerAppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const role = resolveRole(userProfile);
  const allowed = role === 'buyer';
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
      <div className="flex min-h-screen items-center justify-center bg-[#0A1224]">
        <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#0A1224] px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-400/10">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-white">This part of the app is not open for your account</h1>
          <p className="mx-auto max-w-xs text-sm text-white/60">
            This area is only for buyers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="vn-buyer-scope flex min-h-screen flex-col bg-background">
      {/* Navigation kept minimal but complete on this shell. This IS the one
          header on discovery: it carries the hamburger, the Vidnov name and
          the search button (see BuyerTopBarInner). */}
      <BuyerTopBarInner onOpenNav={() => setNavOpen(true)} immersive={immersive} />
      <main className="mx-auto w-full max-w-md flex-1 pb-28 pt-4">
        {children}
      </main>
      {!immersive && <BuyerTabBar />}
      <BuyerNavDrawer open={navOpen} onClose={() => setNavOpen(false)} />
    </div>
  );
}

function BuyerTopBarInner({
  onOpenNav,
  immersive = false,
}: {
  onOpenNav: () => void;
  immersive?: boolean;
}) {
  const pathname = usePathname() ?? '';
  const onDiscovery = pathname === '/app/buyer/discovery';
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const profile = (userProfile ?? null) as { fullName?: string } | null;

  const initials = (profile?.fullName ?? 'You')
    .split(' ')
    .map((p: string) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (immersive) {
    return (
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0A1224]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-md items-center gap-2 px-3">
          <button
            type="button"
            onClick={onOpenNav}
            aria-label="Open the buyer menu"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* No back arrow here by design: `router.back()` is how buyers were
              bounced out of the app — a back stack that starts on a website
              route leaves the section entirely. Navigation inside the app is
              the tab bar and the drawer, both of which stay in-section. */}

          {/* Discovery's identity and search live HERE now — the section's own
              bar is gone, so this is the only header on the screen. */}
          {onDiscovery && <Logo className="ml-1 text-lg" />}
          {/* The bell rides in the right-hand action cluster so it survives
              both discovery (next to search) and immersive non-discovery
              screens (where it is the only action on the right). */}
          <div className="ml-auto flex items-center gap-1">
            <NotificationsBell
              href="/app/buyer/notifications"
              className="text-white/70 hover:bg-white/10"
              iconClassName="h-5 w-5"
            />
            {onDiscovery && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('vidnov:open-search'))}
                aria-label="Search & filters"
                title="Search & filters"
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10"
              >
                <Search className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0A1224]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-md items-center gap-2 px-4">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open the buyer menu"
          className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* `ml-auto` was on the section pill; with the pill gone the logo takes
            over pushing the actions right, so the bar keeps its shape. */}
        <Logo className="ml-auto text-xl" />

        <NotificationsBell
          href="/app/buyer/notifications"
          className="text-white/60 hover:bg-white/10"
          iconClassName="h-4 w-4"
        />
      </div>
    </header>
  );
}

function useImmersiveRoute(): boolean {
  const pathname = usePathname();
  if (!pathname) return false;
  const IMMERSIVE_ROUTES = ['/app/buyer/shop', '/app/buyer/messages', '/app/buyer/discovery'];
  const IMMERSIVE_ROUTE_PREFIXES = ['/app/buyer/live/'];
  if (IMMERSIVE_ROUTES.includes(pathname)) return true;
  return IMMERSIVE_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function BuyerTabBar() {
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();
  const cartQuery = React.useMemo(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'userProfiles', user.uid, 'cart');
  }, [firestore, user]);
  const { data: items } = useCollection<CartItem>(cartQuery);
  const cartCount = items?.length ?? 0;
  const isActive = (href: string) => {
    if (!pathname) return false;
    if (pathname === href) return true;
    if (href === '/app/buyer') return false;
    return pathname.startsWith(`${href}/`);
  };
  const BUYER_TABS = [
    { key: 'home', label: 'Home', icon: Home, href: '/app/buyer' },
    { key: 'shop', label: 'Shop', icon: Search, href: '/app/buyer/shop' },
    { key: 'cart', label: 'Cart', icon: ShoppingCart, href: '/app/buyer/cart', raised: true },
    { key: 'orders', label: 'Orders', icon: Package, href: '/app/buyer/orders' },
    { key: 'more', label: 'Account', icon: User, href: '/app/buyer/account' },
  ];
  return (
    <nav className="vn-buyer-tabbar z-50">
      <div className="mx-auto flex max-w-md items-end justify-around px-2 pb-2 pt-2.5">
        {BUYER_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-label={tab.label}
            aria-current={isActive(tab.href) ? 'page' : undefined}
            className="relative flex flex-1 flex-col items-center gap-1 px-1 py-1"
          >
            {tab.raised ? (
              <span className="absolute -top-5 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 text-white shadow-lg shadow-violet-500/40 ring-4 ring-[hsl(224_48%_10%)]">
                <tab.icon className="h-5 w-5" />
              </span>
            ) : (
              <span className="relative">
                <tab.icon
                  className={cn(
                    'h-5 w-5',
                    isActive(tab.href) ? 'text-cyan-400' : 'text-white/55',
                  )}
                />
                {tab.key === 'cart' && cartCount > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-400 px-1 font-sans text-[9px] font-bold text-[#0A1224]">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </span>
            )}
            <span
              className={cn(
                'vn-micro text-[9px] font-semibold uppercase tracking-[0.14em]',
                tab.raised && 'mt-6',
                isActive(tab.href) ? 'text-cyan-400' : 'text-white/55',
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
