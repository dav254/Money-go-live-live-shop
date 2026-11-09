import type { Ionicons } from '@expo/vector-icons';

/**
 * BUYER NAVIGATION — the Android app's version of the website's
 * `/app/buyer` drawer.
 *
 * The groups and their order are the website's, because a person who learned
 * the drawer on vidnov.com must not have to learn a second map on the phone:
 *
 *   Shop  — Home, Discovery, Nearby, Saved items, My sellers, Recently viewed
 *   Buy   — My orders, Messages, Request marketplace, Refunds & payments
 *   Live  — Live stream
 *   You   — Account, Notifications, Customer care, Settings
 *
 * Two rows now match the website and required their own screens:
 *
 *   • **Cart** (`/cart`) reads `GET /api/cart`. Editing and checkout still happen
 *     on the website — there is no cart-write route — and the screen says so
 *     rather than showing buttons that cannot work.
 *   • **Invite & earn** (`/rewards`) reads `referralPoints` off the profile and
 *     redeems through the server transaction, the same fields the website uses.
 *
 * Every `href` below is a route that exists. That rule is the reason this file
 * is exhaustive rather than aspirational: a nav row that opens nothing teaches
 * the customer the app is broken.
 *
 * `badge` names a live count from `useNavCounts`; no row invents a number.
 */
export type NavBadge = 'unread' | 'orders' | 'requests';

export type BuyerNavItem = {
  label: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  detail?: string;
  badge?: NavBadge;
};

export type BuyerNavGroup = {
  title: string;
  items: BuyerNavItem[];
};

export const BUYER_NAV: BuyerNavGroup[] = [
  {
    title: 'Shop',
    items: [
      { label: 'Home', href: '/', icon: 'home-outline', detail: 'Today on Vidnov' },
      { label: 'Discovery', href: '/discover', icon: 'compass-outline', detail: 'Search and filter' },
      { label: 'Nearby', href: '/nearby', icon: 'location-outline', detail: 'Shops near your area' },
      { label: 'Saved items', href: '/saved', icon: 'heart-outline', detail: 'Kept for later' },
      { label: 'My sellers', href: '/sellers', icon: 'storefront-outline', detail: 'Shops you follow' },
      {
        label: 'Recently viewed',
        href: '/recent',
        icon: 'time-outline',
        detail: 'On this phone',
      },
      { label: 'Videos', href: '/videos', icon: 'videocam-outline', detail: 'Listings with video' },
    ],
  },
  {
    title: 'Buy',
    items: [
      { label: 'Cart', href: '/cart', icon: 'cart-outline', detail: 'Lines from the website' },
      { label: 'My orders', href: '/orders', icon: 'receipt-outline', badge: 'orders' },
      { label: 'Messages', href: '/messages', icon: 'chatbubbles-outline' },
      {
        label: 'Request marketplace',
        href: '/requests',
        icon: 'document-text-outline',
        badge: 'requests',
      },
      {
        label: 'Refunds & payments',
        href: '/wallet',
        icon: 'wallet-outline',
        detail: 'Refund credit and receipts',
      },
    ],
  },
  {
    title: 'Live',
    items: [
      { label: 'Live stream', href: '/live', icon: 'radio-outline', detail: 'Sellers on air' },
    ],
  },
  {
    title: 'You',
    items: [
      { label: 'Invite & earn', href: '/rewards', icon: 'gift-outline', detail: 'Referral points' },
      { label: 'Account', href: '/profile', icon: 'person-outline' },
      { label: 'Notifications', href: '/alerts', icon: 'notifications-outline', badge: 'unread' },
      { label: 'Customer care', href: '/help', icon: 'help-buoy-outline', detail: 'Talk to the team' },
      // Settings and "Become a seller" live in the drawer's footer, not here:
      // the footer is the account block, and one destination should not appear
      // twice in the same menu.
    ],
  },
];

/** True when `href` is the destination currently on screen. */
export function isActiveRoute(pathname: string, href: string): boolean {
  const normalise = (value: string) => value.replace(/\/+$/, '') || '/';
  const here = normalise(pathname);
  const target = normalise(href);

  // The tab routes live under `(tabs)`, which expo-router strips from the URL.
  const tabAlias: Record<string, string> = {
    '/discover': '/(tabs)/discover',
    '/requests': '/(tabs)/requests',
    '/messages': '/(tabs)/messages',
    '/alerts': '/(tabs)/alerts',
    '/profile': '/(tabs)/profile',
  };

  if (here === target || here === tabAlias[target]) return true;
  // A detail screen belongs to its section: /shop/abc highlights Discover.
  if (target !== '/' && here.startsWith(`${target}/`)) return true;
  return false;
}
