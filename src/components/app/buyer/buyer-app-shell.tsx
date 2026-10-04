'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import {
  Bell, ChevronLeft, Home, Search, ShoppingCart, Package, User, LogOut,
  Loader2, Menu, ShoppingBag,
} from 'lucide-react';
import {
  useAuth, useCollection, useFirestore, useUser, useUserProfile,
} from '@/firebase';
import { collection } from 'firebase/firestore';
import type { CartItem } from '@/lib/types';
import { Logo } from '@/components/logo';
import { AppSignIn } from '@/components/app/app-sign-in';
import { BuyerNavDrawer } from '@/components/app/buyer/buyer-nav-drawer';
import { openWebSurface } from '@/lib/auth/surface';
import { resolveRole } from '@/lib/auth/roles';
import { useSignOutToHome } from '@/lib/auth/sign-out-to-home';
import { cn } from '@/lib/utils';

/**
 * BUYER APP SHELL.
 *
 * ## Why it exists as its own component
 *
 * The seller section was built first as `SellerAppShell` under `/app/seller/*`.
 * This file is its sibling, not a copy of it with a prop: the buyer section
 * lives in a different directory with a different layout, so adding a screen
 * here cannot change how the seller section renders, and vice versa. There is
 * no shared "app chrome" component in the middle that both roles pass through —
 * `AppSurfaceFrame` explicitly stands aside for both section trees.
 *
 *     /app/seller/*   → SellerAppShell   ember band, Inter body, edge-to-edge bar
 *     /app/buyer/*    → this file        ocean band, Space Grotesk body, pill bar
 *     /admin/*        → AdminAppTabBar   admin console chrome
 *
 * ## The design language (vs. the seller section and vs. the website)
 *
 *   seller app section        buyer app section        buyer website pages
 *   ───────────────────       ───────────────────      ─────────────────────
 *   Inter body                Space Grotesk body       Space Grotesk editorial
 *   amber → coral band        cyan → violet band       flat coral primary
 *   bordered 2xl cards        borderless 3xl cards     gap-px grids + tables
 *   edge-to-edge tab bar      floating pill nav        desktop sidebar
 *
 * The buyer section therefore differs from the seller section on every axis the
 * user can see — type, colour, card geometry and navigation shape — while still
 * cloning the website buyer's *content* exactly.
 */

/* ── Tab bar ─────────────────────────────────────────────────────────────── */

interface BuyerTab {
  key: string;
  label: string;
  icon: React.ElementType;
  href: string;
  raised?: boolean;
}

/** The buyer section's own navigation — nothing here points outside it. */
const BUYER_TABS: BuyerTab[] = [
  { key: 'home', label: 'Home', icon: Home, href: '/app/buyer' },
  { key: 'shop', label: 'Shop', icon: Search, href: '/app/buyer/shop' },
  { key: 'cart', label: 'Cart', icon: ShoppingCart, href: '/app/buyer/cart', raised: true },
  { key: 'orders', label: 'Orders', icon: Package, href: '/app/buyer/orders' },
  { key: 'more', label: 'Account', icon: User, href: '/app/buyer/account' },
];

/**
 * Cart count for the badge. The cart is a subcollection of the buyer's own
 * profile document, which `firestore.rules` scopes to its owner.
 */
function useBuyerCartCount(): number {
  const { user } = useUser();
  const firestore = useFirestore();

  const cartQuery = React.useMemo(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'userProfiles', user.uid, 'cart');
  }, [firestore, user]);

  const { data: items } = useCollection<CartItem>(cartQuery);
  return items?.length ?? 0;
}

function BuyerTabBar() {
  const pathname = usePathname();
  const cartCount = useBuyerCartCount();

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (pathname === href) return true;
    // The section root is the home screen: exact match only, otherwise
    // `/app/buyer/shop` would keep "Home" lit because it starts with the root.
    if (href === '/app/buyer') return false;
    return pathname.startsWith(`${href}/`);
  };

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

/* ── Top bar ─────────────────────────────────────────────────────────────── */

/**
 * Routes that drop the full chrome and keep navigation only.
 *
 * The buyer Shop is a full-bleed vertical player: one product, one screen,
 * edge to edge. A h-14 header carrying a logo, a "Buyer" pill, a bell and an
 * avatar is furniture in front of the thing the buyer came to look at, and the
 * tab bar costs a card's worth of height on every product.
 *
 * NOTE: the menu button is not optional furniture here. The pill tab bar is
 * not rendered on these routes, so every destination it holds — Home, Cart,
 * Orders, Account — is unreachable from the screen itself. `BuyerNavDrawer` is
 * what makes an immersive buyer screen escapable instead of a dead end for
 * anyone arriving by deep link.
 */
/*
 * Routes that drop the chrome.
 *
 * Messages is here because a chat thread is a conversation, not a browse: the
 * full buyer header (logo, BUYER pill, bell, avatar) plus the five-slot tab bar
 * pushed the thread into the middle third of a phone screen and, worse, the
 * CHAT button in the feed — the thing that opens it — left the feed entirely,
 * so the product being discussed about was no longer on screen. Immersive keeps
 * a 48px menu/back bar and drops the tab bar, so the thread is the page.
 */
const IMMERSIVE_ROUTES = ['/app/buyer/shop', '/app/buyer/messages'];

/**
 * Immersive routes with a dynamic segment, matched by prefix.
 *
 * The watch screen is `/app/buyer/live/[id]`, so its id is not known at build
 * time and cannot sit in the exact-match list above. The prefix includes the
 * trailing slash on purpose: without it, `/app/buyer/live/anything` is fine but
 * a hypothetical `/app/buyer/lives` would also match, and the discovery screen
 * at `/app/buyer/live` (no trailing slash) would NOT — which is correct, since
 * discovery is a scrolling grid that keeps its tab bar and only the room drops
 * the chrome.
 */
const IMMERSIVE_ROUTE_PREFIXES = ['/app/buyer/live/'];

function useImmersiveRoute(): boolean {
  const pathname = usePathname();
  if (!pathname) return false;
  if (IMMERSIVE_ROUTES.includes(pathname)) return true;
  return IMMERSIVE_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function BuyerTopBarInner({
  onOpenNav,
  immersive = false,
}: {
  onOpenNav: () => void;
  immersive?: boolean;
}) {
  const router = useRouter();
  const auth = useAuth();
  const signOutAndGoHome = useSignOutToHome(auth);
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

          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0A1224]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-md items-center gap-3 px-4">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open the buyer menu"
          className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <Logo className="text-xl" />

        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-widest text-cyan-300">
          <ShoppingBag className="h-3 w-3" />
          Buyer
        </span>

        <Link
          href="/app/buyer/notifications"
          aria-label="Notifications"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10"
        >
          <Bell className="h-4 w-4" />
        </Link>

        <Link
          href="/app/buyer/account"
          aria-label="Account"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 font-sans text-[11px] font-bold text-white"
        >
          {initials}
        </Link>

        <button
          type="button"
          onClick={signOutAndGoHome}
          aria-label="Sign out of the app"
          title="Sign out of the app"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

/* ── Shell ───────────────────────────────────────────────────────────────── */

/**
 * Role gate for the section itself.
 *
 * `SurfaceBoundary` already keeps admins off the whole app surface; this is a
 * second, section-level check so that a seller who types `/app/buyer` is refused
 * inside the section rather than being signed out — signing out is the
 * boundary's decision, not this one's. Only buyers enter: admin is excluded
 * here as well as at the boundary, so the section never renders for an
 * administrator even if the outer gate were loosened later.
 */
function useBuyerSectionAccess() {
  const { user, isLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const role = resolveRole(userProfile);
  const allowed = role === 'buyer';
  return {
    known: !isLoading && !isProfileLoading,
    signedIn: !!user,
    allowed: allowed && !!user,
  };
}

export function BuyerAppShell({ children }: { children: React.ReactNode }) {
  const { known, signedIn, allowed } = useBuyerSectionAccess();
  // The pill tab bar takes five slots; the section's other screens live in this
  // drawer, and on immersive routes it is the only navigation left.
  const [navOpen, setNavOpen] = React.useState(false);
  const immersive = useImmersiveRoute();

  // Still resolving the profile: match the page's first paint exactly rather
  // than flashing a shell the user may not be entitled to (hydration).
  if (!known) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A1224]">
        <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
      </div>
    );
  }

  // Signed out: this is still the buyer section, so offer the section's own
  // sign-in — the same screen the seller section shows, because the app has one
  // account system shared with the website.
  if (!signedIn) {
    return (
      <div className="vn-buyer-scope">
        <AppSignIn />
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
          <h1 className="text-lg font-semibold text-white">This is the buyer section</h1>
          <p className="mx-auto max-w-xs text-sm text-white/60">
            The app is split into one section per role with its own layout, so seller, buyer
            and admin never share a screen. Sign in with a buyer account to enter this one.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openWebSurface('/')}
          className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Back to the website
        </button>
      </div>
    );
  }

  return (
    <div className="vn-buyer-scope flex min-h-screen flex-col bg-background">
      <BuyerTopBarInner onOpenNav={() => setNavOpen(true)} immersive={immersive} />

      {/* No `pb-28` in immersive mode: that padding exists purely to clear the
          tab bar, and the tab bar is not rendered there. Leaving it would put a
          finger-sized dead strip under the last card. */}
      <main
        className={cn(
          'mx-auto w-full max-w-md flex-1',
          immersive ? 'pb-2 pt-0' : 'pb-28 pt-4',
        )}
      >
        {children}
      </main>

      {!immersive && <BuyerTabBar />}

      <BuyerNavDrawer open={navOpen} onClose={() => setNavOpen(false)} />
    </div>
  );
}

/** Small shared pieces used by more than one buyer screen. */

export function BuyerSectionTitle({
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
        <p className="vn-micro text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-500 dark:text-cyan-400">
          {eyebrow}
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function BuyerCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('vn-buyer-card p-4', className)}>{children}</div>
  );
}

/** Status pill — cyan/violet tones instead of the seller section's amber. */
export function BuyerStatusPill({ status }: { status: string }) {
  const tone = React.useMemo(() => {
    switch (status) {
      case 'delivered':
      case 'shipped':
      case 'paid':
        return 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300';
      case 'pending':
        return 'bg-violet-500/15 text-violet-600 dark:text-violet-300';
      case 'processing':
      case 'packed':
        return 'bg-sky-500/15 text-sky-600 dark:text-sky-300';
      case 'cancelled':
      case 'refunded':
      case 'disputed':
        return 'bg-red-500/15 text-red-600 dark:text-red-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  }, [status]);

  return (
    <span
      className={cn(
        'vn-micro inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
        tone,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function BuyerEmptyState({
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
    <div className="mx-4 flex flex-col items-center rounded-3xl border border-dashed border-border px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20">
        <Icon className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
      </div>
      <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
      <p className="mt-1.5 max-w-[16rem] font-sans text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
