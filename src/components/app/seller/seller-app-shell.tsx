'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import {
  Bell, ChevronLeft, Home, Boxes, Plus, Package, LogOut,
  Loader2, Menu, MessageSquare, Store,
} from 'lucide-react';
import {
  useAuth, useFirestore, useUser, useUserProfile, useMemoFirebase, useCollection,
} from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Order } from '@/lib/types';
import { Logo } from '@/components/logo';
import { AppSignIn } from '@/components/app/app-sign-in';
import { SellerNavDrawer } from '@/components/app/seller/seller-nav-drawer';
import { openWebSurface } from '@/lib/auth/surface';
import { resolveRole } from '@/lib/auth/roles';
import { useSignOutToHome } from '@/lib/auth/sign-out-to-home';
import { cn } from '@/lib/utils';

/**
 * SELLER APP SHELL.
 *
 * ## Why this exists instead of the website chrome
 *
 * The first attempt at the app wrapped the *website* pages in a generic
 * top-bar/tab-bar (`AppSurfaceFrame`) and pointed both sellers and buyers at the
 * same routes. That made the app a skin: seller and buyer shared one homepage,
 * one layout and one visual language, and nothing distinguished a section.
 *
 * The shell inverts it. Each role owns its own section under its own route tree
 * and its own shell:
 *
 *     /app/seller/*   → this file        ember band, Inter body, raised Create
 *     /app/buyer/*    → BuyerAppShell    (never built yet — deliberately separate)
 *     /admin/*        → AdminAppTabBar   admin console chrome
 *
 * They can never collide because they are different directories with different
 * layouts, not different branches in one component. Adding the buyer section
 * cannot change how the seller section looks, because no code is shared.
 *
 * ## The design language (vs. the website's seller pages)
 *
 *   website seller          app seller section
 *   ─────────────────       ────────────────────────────────────────
 *   flat coral `primary`    ember gradient band (amber → coral)
 *   Space Grotesk body      Inter body, Space Grotesk only for figures
 *   sidebar + gap-px grids  elevated rounded cards, tab bar navigation
 *   dense table rows        stacked cards with a status pill
 *
 * The differences are deliberate and visible, so a seller who switches between
 * the website and the app never mistakes one for the other.
 */

/* ── Tab bar ─────────────────────────────────────────────────────────────── */

interface SellerTab {
  key: string;
  label: string;
  icon: React.ElementType;
  href: string;
  raised?: boolean;
}

/** The seller section's own navigation — nothing here points outside it. */
/**
 * The five slots the tab bar can hold.
 *
 * Messages took the slot More used to have. That swap only became possible once
 * Messages was a screen this section owned (`/app/seller/messages`): while it
 * was a link to the website's `/messages`, putting it in the bar would have
 * thrown sellers out of the app every time they tapped it. Account moved to the
 * sidebar in exchange, where the rest of the overflow lives.
 */
const SELLER_TABS: SellerTab[] = [
  { key: 'home', label: 'Overview', icon: Home, href: '/app/seller' },
  { key: 'products', label: 'Stock', icon: Boxes, href: '/app/seller/products' },
  { key: 'create', label: 'Create', icon: Plus, href: '/app/seller/create', raised: true },
  { key: 'orders', label: 'Orders', icon: Package, href: '/app/seller/orders' },
  { key: 'messages', label: 'Messages', icon: MessageSquare, href: '/app/seller/messages' },
];

/**
 * Live order count for the badge. The rules only permit listing orders that are
 * filtered by the caller, so the query is always scoped to this seller — a bare
 * collection read is rejected by `firestore.rules`.
 */
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
    // The section root is the overview: it must only light up on the exact
    // path. A prefix test would keep "Overview" active on every sub-page,
    // because `/app/seller/products` starts with `/app/seller/`.
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

/**
 * The one route that runs without the section's chrome.
 *
 * A conversation is the only screen in this section where the seller's
 * attention belongs entirely on one thing. The logo, the SELLER pill, the
 * notification bell, the avatar and the sign-out button all sat in a strip
 * that is not part of the conversation, and the tab bar pushed the composer up
 * the screen — on a phone that is the difference between seeing four messages
 * and seeing eight.
 *
 * So on this route the tab bar is not rendered at all and the header drops to
 * the two controls that are genuinely navigation: the menu (which opens the
 * sidebar — the section's full navigation) and back. Nothing is lost, because
 * everything the bar carried is in the sidebar behind the menu button.
 */
/**
 * Routes that drop the full chrome and keep navigation only.
 *
 * A screen earns a place here when its content is the screen. Messages is a
 * conversation: a h-14 header carrying a logo, a role pill, a bell and an
 * avatar is furniture in front of the thing the seller came to look at, and
 * the tab bar costs a message's worth of height. What stays is a h-12 bar
 * with the menu and back buttons — the drawer is the only way out of the
 * screen once the tab bar is gone, so it must stay.
 */
const IMMERSIVE_ROUTES = ['/app/seller/messages'];

function useImmersiveRoute(): boolean {
  const pathname = usePathname();
  if (!pathname) return false;
  return IMMERSIVE_ROUTES.includes(pathname);
}

function SellerTopBar({ onOpenNav, immersive = false }: { onOpenNav: () => void; immersive?: boolean }) {
  const router = useRouter();
  const auth = useAuth();
  const signOutAndGoHome = useSignOutToHome(auth);
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const profile = (userProfile ?? null) as { fullName?: string } | null;

  const initials = (profile?.fullName ?? 'Seller')
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Immersive: navigation only. The header shrinks from h-14 to h-12 so the
  // conversation gains another 8px of height as well as the width.
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

        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <Logo className="text-xl" />

        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
          <Store className="h-3 w-3" />
          Seller
        </span>

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

        <button
          type="button"
          onClick={signOutAndGoHome}
          aria-label="Sign out of the app"
          title="Sign out of the app"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary"
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
 * `SurfaceBoundary` already keeps buyers and admins off the whole app surface;
 * this is a second, section-level check so that a future `/app/buyer` cannot be
 * reached by simply typing the URL while signed in as a seller. It refuses to
 * render rather than signing out, because the boundary above owns that decision.
 */
function useSellerSectionAccess() {
  const { user, isLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const role = resolveRole(userProfile);
  const allowed = role === 'seller' || role === 'reseller';
  return {
    known: !isLoading && !isProfileLoading,
    signedIn: !!user,
    allowed: allowed && !!user,
  };
}

export function SellerAppShell({ children }: { children: React.ReactNode }) {
  const { known, signedIn, allowed } = useSellerSectionAccess();
  // The tab bar is five slots wide and every one is taken, so the rest of the
  // section lives in this drawer instead of being squeezed into it.
  const [navOpen, setNavOpen] = React.useState(false);
  const immersive = useImmersiveRoute();

  // Still resolving the profile: match the page's first paint exactly rather
  // than flashing a shell the user may not be entitled to (hydration).
  if (!known) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Signed out: this is still the seller section, so offer the section's own
  // sign-in rather than the "wrong role" screen — nobody has been rejected yet.
  if (!signedIn) {
    return (
      <div className="vn-seller-scope">
        <AppSignIn />
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
            This is the seller section
          </h1>
          <p className="mx-auto max-w-xs text-sm text-muted-foreground">
            The app is split into one section per role with its own layout, so
            seller, buyer and admin never share a screen. Sign in with a seller
            account to enter this one.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openWebSurface('/')}
          className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary"
        >
          Back to the website
        </button>
      </div>
    );
  }

  return (
    <div className="vn-seller-scope flex min-h-screen flex-col bg-background font-sora">
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
        // No horizontal margin here: every screen positions its own cards, so
        // callers that already pad a grid don't end up with a double gutter.
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
