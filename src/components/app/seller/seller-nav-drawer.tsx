'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AreaChart,
  Bell,
  BellRing,
  ChevronRight,
  CreditCard,
  Gift,
  Headphones,
  Home,
  Inbox,
  MapPin,
  MessageSquare,
  Radio,
  Sparkles,
  Store,
  User,
  X,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';

/**
 * SELLER SIDEBAR — the section's full map, off the bottom bar.
 *
 * ## Why this exists
 *
 * The bottom tab bar has five slots and every one of them is load-bearing:
 * Overview, Stock, Create, Orders, More. The section has grown well past five
 * destinations — Live, AI Studio and the Discovery Feed are all real screens a
 * seller works in daily, not settings. Squeezing them into the tab bar would
 * mean either shrinking the tap targets or dropping something that already
 * works, so instead the overflow moved somewhere with room: a drawer.
 *
 * ## Why it is a drawer and not a permanent rail
 *
 * This is a phone. A permanent sidebar would cost a third of the width on
 * every screen and fight the tab bar for the thumb. As a drawer it costs
 * nothing until it is opened, and it is the one place that can list the whole
 * section at once — which is exactly what a tab bar cannot do.
 *
 * ## What it must never become
 *
 * It is navigation *within the app surface only*. The surface is latched when
 * the document loads, so tapping any of these stays in the installed app and on
 * the app's own session — nothing here crosses to the website.
 *
 * Two kinds of entry live in it, and the difference matters:
 *
 *   • `/app/seller/*` — the seller's own section screens, which have their own
 *     routes inside this shell.
 *   • the section's own screens, all under `/app/seller/*`.
 *
 * There is deliberately nothing else. Every entry used to be able to point at a
 * website route, and that was how the app kept spilling into the website
 * mid-session. A screen the seller reaches from here now belongs to this
 * section.
 *
 * Deliberately, none of these entries read data. A menu should not be able to
 * crash the screen it opens from, and nothing here subscribes to Firestore.
 *
 * Messages is the entry to watch. It first appeared carrying an unread badge
 * that queried `chats` on every seller screen, and that read took the whole
 * section down when it failed — one failing query in a menu taking out the
 * screens people actually work in. It is here now as a bare link, which is what
 * it should always have been. If an unread count is wanted back, it belongs on
 * the Messages screen itself, where a failure costs that one screen; it does
 * not belong here.
 *
 * It is also deliberately NOT a second copy of the tab bar. Create and Orders
 * already have a permanent slot in the bottom bar, so listing them again here
 * would just be the same two destinations in two places; and the website hand-
 * off is not navigation at all, so it does not belong in a menu whose whole job
 * is "go somewhere in this app". What is left is what the tab bar has no room
 * for.
 */

interface DrawerItem {
  key: string;
  label: string;
  href: string;
  icon: React.ElementType;
  /** Match sub-routes too, but never let a prefix swallow a sibling section. */
  exact?: boolean;
  tone?: 'live' | 'ai';
}

interface DrawerGroup {
  label: string;
  items: DrawerItem[];
}

const GROUPS: DrawerGroup[] = [
  {
    label: 'Store',
    items: [
      { key: 'overview', label: 'Overview', href: '/app/seller', icon: Home, exact: true },
      // A link to the SECTION'S OWN screen, not to the website's `/messages`.
      // Jumping out of the app mid-session is what made this feel broken; the
      // rule is that the app never links to a website route.
      { key: 'messages', label: 'Messages', href: '/app/seller/messages', icon: MessageSquare },
      { key: 'earnings', label: 'Earnings', href: '/app/seller/earnings', icon: AreaChart },
      // Where the platform pays this seller. Earnings says how much; this says
      // where it goes, and it is the only place in the section that writes a
      // payout destination — so it is the one the admin console reads.
      { key: 'payments', label: 'Payments', href: '/app/seller/payments', icon: CreditCard },
    ],
  },
  {
    label: 'Create & broadcast',
    items: [
      { key: 'live', label: 'Live studio', href: '/app/seller/live', icon: Radio, tone: 'live' },
      {
        key: 'ai-studio',
        label: 'AI Studio',
        href: '/app/seller/ai-studio',
        icon: Sparkles,
        tone: 'ai',
      },
      // Incoming briefs from buyers. A plain link, like every other entry here —
      // see the note above about this menu never reading data.
      { key: 'requests', label: 'Requests', href: '/app/seller/requests', icon: Inbox },
    ],
  },
  {
    label: 'You',
    items: [
      {
        key: 'shop',
        label: 'View my shop',
        // The section's own preview of the seller's public shop, not the website's
        // `/sellers/{uid}`. Same rule as Messages: the app never links out.
        href: '/app/seller/shop',
        icon: Store,
      },
      {
        key: 'business',
        label: 'My business',
        // Where this business works. Without it nothing is reachable nearby, so
        // it sits next to "View my shop" rather than buried in Account.
        href: '/app/seller/business',
        icon: MapPin,
      },
      {
        key: 'notifications',
        label: 'Notifications',
        href: '/app/seller/notifications',
        icon: Bell,
      },
      {
        key: 'care',
        label: 'Customer Care',
        // The seller's direct line to the platform. Labelled Customer Care and
        // never "admin": it is a support thread with the team, not a way into
        // the staff console.
        href: '/app/seller/care',
        icon: Headphones,
      },
      // The account screen (settings, shop, exits). It was the tab bar's "More"
      // slot until Messages took that slot; it belongs with the other overflow
      // here, and "More" was never a useful label for a screen that is just
      // this seller's own account.
      // Invite other sellers. A seller who recruits three sellers brings their
      // catalogues and audiences with them, which no buyer-side programme can do.
      { key: 'rewards', label: 'Invite & earn', href: '/app/seller/rewards', icon: Gift },
      // What reaches the seller's phone. Separate from the notifications inbox
      // for the same reason as the buyer's: one is a history, one is a setting.
      {
        key: 'notification-settings',
        label: 'Alert settings',
        href: '/app/seller/settings/notifications',
        icon: BellRing,
      },
      { key: 'account', label: 'Account', href: '/app/seller/account', icon: User },
    ],
  },
];

/**
 * Active test that does not paint the wrong item.
 *
 * `/app/seller` is a prefix of every other section route, so a naive
 * `startsWith` would light up "Overview" on Earnings and Live at once.
 * The root is therefore matched exactly, and everything else by prefix.
 */
function isItemActive(pathname: string | null, href: string, item: DrawerItem): boolean {
  if (!pathname) return false;
  if (item.exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SellerNavDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

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
        aria-label="Seller section menu"
        className={cn(
          'fixed inset-y-0 left-0 z-[70] flex w-[82%] max-w-xs flex-col',
          'border-r border-amber-500/20 bg-[#0B0B10] shadow-2xl shadow-black/60',
          'transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Ember header, the same gradient the tab bar's Create button uses. */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 px-5 pb-6 pt-7">
          <div
            aria-hidden
            className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl"
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="bg-black/25 rounded-xl px-2.5 py-1.5">
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
          <p className="relative mt-4 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/80">
            Seller workspace
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          {GROUPS.map((group) => (
            <div key={group.label} className="mb-5 last:mb-0">
              <p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground/70">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isItemActive(pathname, item.href, item);
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                          active
                            ? 'bg-gradient-to-r from-amber-500/20 to-red-500/10 text-amber-500 ring-1 ring-inset ring-amber-500/30'
                            : 'text-foreground/80 hover:bg-white/5 hover:text-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                            item.tone === 'live' &&
                              'bg-gradient-to-br from-red-600 to-orange-500 text-white',
                            item.tone === 'ai' &&
                              'bg-gradient-to-br from-[#FF4D2E] to-[#0EA5E9] text-white',
                            !item.tone && (active ? 'bg-amber-500/15 text-amber-500' : 'bg-white/5 text-muted-foreground'),
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.tone === 'live' && (
                          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />
                        )}
                        {active && !item.tone && (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-amber-500" />
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

export default SellerNavDrawer;