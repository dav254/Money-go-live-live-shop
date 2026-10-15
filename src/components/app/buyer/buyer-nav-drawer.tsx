'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  BellRing,
  ChevronRight,
  Clock,
  Compass,
  Gift,
  Heart,
  HelpCircle,
  Home,
  Inbox,
  MapPin,
  MessageCircle,
  Package,
  Radio,
  ShoppingCart,
  Store,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';

/**
 * BUYER SIDEBAR — the buyer section's full map, off the menu button.
 *
 * ## Why this exists
 *
 * The buyer section grew a route with no permanent slot: Requests. Home, Shop,
 * Cart, Orders and Account take all five positions in the floating pill tab bar,
 * so Requests — and everything that has been added since — was reachable from
 * nowhere except a deep link. The seller section
 * solved the same overflow years earlier by moving everything off the bar and
 * into a drawer (`SellerNavDrawer`), and the buyer section now does the same
 * thing in its own colours.
 *
 * ## Why this one DOES repeat the tab bar, when the seller drawer does not
 *
 * `SellerNavDrawer` is explicitly not a second copy of its tab bar — with
 * fourteen destinations, listing the bar's five again would be noise. The buyer
 * section has six screens in total, and the honest reason it lists them here is
 * functional rather than decorative:
 *
 *   1. Shop is an **immersive** route. The pill tab bar is not rendered there
 *      at all, so on that screen every destination in the bar becomes
 *      unreachable. Before this drawer existed the only exit was a back
 *      chevron, which is a dead end for anyone arriving by deep link or by a
 *      link inside a card. The menu button in that screen's own h-12 bar opens
 *      this drawer, which is what makes the immersive screen escapable.
 *   2. Five tab-bar slots and sixteen screens is the whole section. A drawer
 *      carrying only Requests would be a menu with one entry, not a sidebar.
 *
 * The section grew from seven screens to sixteen: My sellers and Recently
 * viewed were added to the Shop group, Refunds & payments to Buy, and
 * Notifications and Customer care to You. Each one replaces an escape to the
 * website — the buyer's own Account screen used to link out to `/buyer/wallet`,
 * `/buyer/wishlist`, `/buyer/notifications` and `/buyer/help`, and the
 * immersive bar's bell dead-linked to Account.
 *
 * The duplication is deliberate and limited to this section. It is still not a
 * website hand-off: see below.
 *
 * ## What it must never contain
 *
 * Every href here is a route inside `/app/buyer/*`. No entry points at the
 * website, and none at the seller section. The app surface latched when the
 * document loaded, so tapping any of these stays in the installed app, on the
 * app's own session. A screen the buyer reaches from here belongs to this
 * section.
 *
 * Deliberately, none of these entries read data. A menu should not be able to
 * crash the screen it opens from, so there are no live Firestore counts here —
 * not even the cart badge the tab bar shows. If a count is wanted in here it
 * belongs on the screen it counts, where a failed read costs that one screen.
 */

/** The query the shared feed reads its view from. See `/app/buyer/shop`. */
const SAVED_VIEW = 'saved';

interface DrawerItem {
  key: string;
  label: string;
  href: string;
  icon: React.ElementType;
  /** Match sub-routes too, but never let a prefix swallow a sibling screen. */
  exact?: boolean;
  /** Only lit when the feed is showing this view of the same route. */
  view?: 'all' | 'saved';
  /** A live destination: red badge in the rail, pulsing dot. */
  tone?: 'live';
}

interface DrawerGroup {
  label: string;
  items: DrawerItem[];
}

const GROUPS: DrawerGroup[] = [
  {
    label: 'Shop',
    items: [
      // The section root is the home screen. Exact-matched, otherwise
      // `/app/buyer/shop` would light "Home" too.
      { key: 'home', label: 'Home', href: '/app/buyer', icon: Home, exact: true },
      // The section's OWN Discovery screen — the shared feed in `components/
      // discovery`, rendered in the app's chrome. It replaced the old Shop
      // screen, which pointed at a feed component that rendered nothing.
      { key: 'discover', label: 'Discovery', href: '/app/buyer/discovery', icon: Compass, view: 'all' },
      // Location-scoped discovery. Reads the customer's own saved area, which
      // the browser may have set or they may have typed — either works, and
      // neither requires GPS to be granted.
      { key: 'nearby', label: 'Nearby', href: '/app/buyer/nearby', icon: MapPin },
      // Same route as Discover, different view — the feed reads it from the URL.
      // It is listed separately because the immersive bar has no title row to
      // switch on and the tab bar's Shop slot only ever opens the All view.
      {
        key: 'saved',
        label: 'Saved items',
        href: `/app/buyer/shop?view=${SAVED_VIEW}`,
        icon: Heart,
        view: 'saved',
      },
      // The read side of `/api/follow`. Sellers you follow, with their newest
      // listings. Data already existed (`UserProfile.following`); nothing read
      // it back until now.
      { key: 'sellers', label: 'My sellers', href: '/app/buyer/sellers', icon: Store },
      // Per-device viewing history, written by the feed itself.
      { key: 'recent', label: 'Recently viewed', href: '/app/buyer/recent', icon: Clock },
    ],
  },
  {
    label: 'Buy',
    items: [
      { key: 'cart', label: 'Cart', href: '/app/buyer/cart', icon: ShoppingCart },
      { key: 'orders', label: 'My orders', href: '/app/buyer/orders', icon: Package },
      // Talking to a seller sits with the other buying actions: it is how a
      // buyer resolves price and delivery before ordering, not a social feed.
      { key: 'messages', label: 'Messages', href: '/app/buyer/messages', icon: MessageCircle },
      // The reason this drawer exists at all: Requests has no tab bar slot.
      { key: 'requests', label: 'Request marketplace', href: '/app/buyer/requests', icon: Inbox },
      // Buyer money is refund credit, not a payout balance — see the screen.
      {
        key: 'wallet',
        label: 'Refunds & payments',
        href: '/app/buyer/wallet',
        icon: Wallet,
      },
    ],
  },
  {
    // Live shopping is its own group because it is a different KIND of thing
    // from the rest: the others are pages you read, this is a room you are in.
    label: 'Live',
    items: [
      // The section's own live discovery, NOT the website's `/live`. Pointing
      // here at a website route would drop the buyer out of the installed app
      // and into the website's desktop sidebar layout on the first tap.
      { key: 'live', label: 'Live stream', href: '/app/buyer/live', icon: Radio, tone: 'live' },
    ],
  },
  {
    label: 'You',
    items: [
      // Buyers earn points too — a buyer who vouches for the marketplace is
      // worth more to it than any seller-side recruitment programme.
      { key: 'rewards', label: 'Invite & earn', href: '/app/buyer/rewards', icon: Gift },
      { key: 'account', label: 'Account', href: '/app/buyer/account', icon: User },
      // This is also where the immersive bar's bell now points. It used to
      // dead-link to /app/buyer/account.
      { key: 'notifications', label: 'Notifications', href: '/app/buyer/notifications', icon: Bell },
      // Controls what reaches the PHONE, which the inbox above cannot do.
      {
        key: 'notification-settings',
        label: 'Alert settings',
        href: '/app/buyer/settings/notifications',
        icon: BellRing,
      },
      {
        key: 'care',
        label: 'Customer care',
        // The buyer's direct line to the platform — contact form, report status
        // and the help articles. Named to match the seller section's screen.
        href: '/app/buyer/care',
        icon: HelpCircle,
      },
    ],
  },
];

/**
 * Which view of the feed is on screen.
 *
 * Deliberately not `useSearchParams()`: that hook forces a `Suspense` boundary
 * on every page the drawer is rendered into, and the whole file is inside the
 * shell layout, not just the feed page. Reading `window.location` in an effect
 * after mount costs one render on hydration and needs no boundary. The effect
 * re-runs on `pathname` because the Next router pushes history without firing
 * `popstate`, so a client-side navigation into `?view=saved` would otherwise
 * leave the entry unlit.
 */
function useSavedViewActive(pathname: string | null): boolean {
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    const check = () => {
      const params = new URLSearchParams(window.location.search);
      setSaved(params.get('view') === SAVED_VIEW);
    };
    check();
    window.addEventListener('popstate', check);
    return () => window.removeEventListener('popstate', check);
  }, [pathname]);

  return saved;
}

/**
 * Active test that does not paint the wrong item.
 *
 * `/app/buyer` is a prefix of every other section route, so a naive
 * `startsWith` would light "Home" on Cart and Orders at once — the root is
 * therefore matched exactly. Discover and Saved share a pathname and differ only
 * by the `view` param, so they are separated by that instead: exactly one of
 * the two can be lit, and both darken when the buyer leaves the feed.
 */
function isItemActive(
  pathname: string | null,
  savedView: boolean,
  item: DrawerItem,
): boolean {
  const path = item.href.split('?')[0];
  const onPath = pathname === path || (!item.exact && !!pathname?.startsWith(`${path}/`));
  if (!onPath) return false;
  if (item.view) return item.view === 'saved' ? savedView : !savedView;
  return true;
}

export function BuyerNavDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const savedView = useSavedViewActive(pathname);

  // Escape closes it, and the page behind it must not scroll while it is open.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  // Navigating closes the drawer: leaving it hanging over the new screen is
  // the classic drawer bug.
  React.useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Scrim. `invisible` rather than unmounted so the fade can run both ways
          without remounting the panel's contents. */}
      <div
        onClick={onClose}
        aria-hidden={!open}
        className={cn(
          'fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none invisible opacity-0',
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Buyer section menu"
        className={cn(
          'fixed inset-y-0 left-0 z-[70] flex w-[82%] max-w-xs flex-col',
          // The buyer's own navy, matching the pill bar's ring colour, with a
          // cyan edge rather than the seller section's amber one.
          'border-r border-cyan-500/20 bg-[#0A1224] shadow-2xl shadow-black/70',
          'transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Cyan → violet header, the same gradient the tab bar's Cart button
            uses, so the drawer reads as part of this section and not the
            seller one. */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-cyan-400 via-sky-500 to-violet-500 px-5 pb-6 pt-7">
          <div
            aria-hidden
            className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl"
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="rounded-xl bg-black/25 px-2.5 py-1.5">
              <Logo className="text-2xl text-white" />
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-white transition hover:bg-black/40"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="vn-micro relative mt-4 text-[10px] font-bold uppercase tracking-[0.3em] text-white/85">
            Shopping
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          {GROUPS.map((group) => (
            <div key={group.label} className="mb-5 last:mb-0">
              <p className="vn-micro px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.25em] text-white/45">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isItemActive(pathname, savedView, item);
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                          active
                            ? 'bg-gradient-to-r from-cyan-400/20 to-violet-500/10 text-cyan-300 ring-1 ring-inset ring-cyan-400/30'
                            : 'text-white/75 hover:bg-white/5 hover:text-white',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                            active
                              ? 'bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-cyan-300'
                              : 'bg-white/5 text-white/60',
                            item.tone === 'live' && !active &&
                              'bg-gradient-to-br from-red-600 to-orange-500 text-white',
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.tone === 'live' && (
                          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />
                        )}
                        {active && !item.tone && (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

export default BuyerNavDrawer;