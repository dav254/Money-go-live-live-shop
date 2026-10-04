/**
 * APP SECTION REGISTRY — the surfaces a buyer or seller can reach.
 *
 * Admin can switch any of these off from /dashboard/admin/system/app. A
 * disabled section is refused for that role: the nav entry disappears and the
 * route itself redirects away, so the link cannot be followed directly.
 *
 * Buyers and sellers deliberately share one app for now (the role decides what
 * resolves, see `src/lib/auth/roles.ts`), but they are listed separately so
 * each role can be switched independently — and so the two layouts can diverge
 * later without re-plumbing the toggle.
 *
 * `prefixes` must stay in sync with the real routes. A section whose prefixes
 * drift from its page silently stops being enforceable, so keep this list and
 * `src/app` in step.
 */

export type ConsumerRole = 'buyer' | 'seller';

export interface AppSection {
  id: string;
  label: string;
  /** Short explanation shown in the admin toggle list. */
  description: string;
  /** Which role(s) this section belongs to. */
  roles: ConsumerRole[];
  /** Route prefixes the section owns. Longest match wins. */
  prefixes: string[];
}

export const APP_SECTIONS: AppSection[] = [
  // ---- Shared (buyer + seller) ----
  {
    id: 'marketplace',
    label: 'Marketplace & search',
    description: 'Browse products, search and view product pages.',
    roles: ['buyer', 'seller'],
    // Discovery lives under `/buyer/discovery` and the seller's equivalent under
    // `/dashboard/seller/live-feed`; both are the same shared feed, so both are
    // covered by the marketplace toggle rather than escaping it.
    //
    // `/app/buyer/product` is the buyer app's own product detail screen — the
    // destination of the feed card's SHOP button. It has to be listed here or
    // switching Marketplace off would leave the app still selling.
    prefixes: [
      '/search',
      '/products',
      '/sellers',
      '/buyer/discovery',
      '/dashboard/seller/live-feed',
      '/app/buyer/product',
    ],
  },
  {
    id: 'live',
    label: 'Live shopping',
    description: 'Watch live streams and the live-now feed.',
    roles: ['buyer', 'seller'],
    // `/app/buyer/live` is the app section's own live shopping: the discovery
    // grid and, via the same prefix, the watch screen at `/app/buyer/live/[id]`
    // (the matcher tests `=== prefix || startsWith(prefix + '/')`, so one entry
    // covers both). It is listed here so switching Live shopping off in the
    // admin console governs the app's screens too — otherwise the toggle would
    // look like it worked while the app kept serving live.
    prefixes: ['/live', '/app/buyer/live'],
  },
  {
    id: 'cart',
    label: 'Cart',
    description: 'Cart and checkout flow.',
    roles: ['buyer', 'seller'],
    prefixes: ['/cart'],
  },
  {
    id: 'messages',
    label: 'Messages',
    description: 'Buyer/seller chat inbox.',
    roles: ['buyer', 'seller'],
    // `/app/buyer/messages` is the buyer app's own chat screen — the same
    // Firestore documents in the buyer shell, reached from the feed's CHAT
    // button and every product's "Message seller". Listed here so switching
    // Messages off in the admin console governs the app too; otherwise the
    // toggle would look like it worked while the app kept serving chat.
    prefixes: ['/messages', '/app/buyer/messages'],
  },
  {
    id: 'requests',
    label: 'Request Marketplace',
    description: 'Post a request and browse or submit offers.',
    roles: ['buyer', 'seller'],
    // The seller app owns its own requests screen, so the toggle has to cover
    // both surfaces — otherwise switching the marketplace off would leave the
    // seller's app fully functional while the website's was gone.
    prefixes: ['/requests', '/app/seller/requests'],
  },
  {
    id: 'account',
    label: 'Account settings',
    description: 'Profile, security, sessions and password.',
    roles: ['buyer', 'seller'],
    prefixes: ['/dashboard/account', '/dashboard/security'],
  },

  // ---- Buyer ----
  {
    id: 'referrals',
    label: 'Referrals & rewards',
    description: 'Invite codes, escalating reward tiers and point balances.',
    roles: ['buyer', 'seller'],
    // One section for both app surfaces. The admin screen at
    // `/dashboard/admin/referrals` is deliberately NOT listed: admin is never
    // blocked by these toggles, and listing an admin path here would suggest
    // switching the section off disables the moderation console, which would be
    // the opposite of what an admin wants.
    prefixes: ['/app/buyer/rewards', '/app/seller/rewards'],
  },
  {
    id: 'buyer-orders',
    label: 'Buyer orders',
    description: 'Order history and order tracking for buyers.',
    roles: ['buyer'],
    prefixes: ['/buyer/my-orders'],
  },
  {
    id: 'buyer-wishlist',
    label: 'Wishlist',
    description: 'Saved products.',
    roles: ['buyer'],
    prefixes: ['/buyer/wishlist'],
  },
  {
    id: 'buyer-wallet',
    label: 'Buyer wallet',
    description: 'Wallet balance and transactions.',
    roles: ['buyer'],
    prefixes: ['/buyer/wallet'],
  },
  {
    id: 'buyer-requests',
    label: 'My requests',
    description: "The buyer's own posted requests.",
    roles: ['buyer'],
    prefixes: ['/buyer/requests', '/buyer/post-request'],
  },
  {
    id: 'buyer-notifications',
    label: 'Buyer notifications',
    description: 'Buyer notification feed.',
    roles: ['buyer'],
    prefixes: ['/buyer/notifications'],
  },

  // ---- Seller ----
  {
    id: 'seller-dashboard',
    label: 'Seller dashboard',
    description: 'Seller home and overview metrics.',
    roles: ['seller'],
    prefixes: ['/dashboard/seller'],
  },
  {
    id: 'seller-products',
    label: 'Product management',
    description: 'Create, edit and publish seller products.',
    roles: ['seller'],
    prefixes: ['/dashboard/products'],
  },
  {
    id: 'seller-orders',
    label: 'Seller orders',
    description: 'Incoming orders and fulfilment actions.',
    roles: ['seller'],
    prefixes: ['/dashboard/seller/orders'],
  },
  {
    id: 'seller-analytics',
    label: 'Seller analytics',
    description: 'Sales and performance analytics.',
    roles: ['seller'],
    prefixes: ['/dashboard/seller/analytics'],
  },
  {
    id: 'seller-ai-studio',
    label: 'AI Studio',
    description: 'AI image and video generation for sellers.',
    roles: ['seller'],
    prefixes: ['/dashboard/seller/ai-studio', '/dashboard/seller/ai-tools', '/ai-studio'],
  },
  {
    id: 'seller-live',
    label: 'Go live & streams',
    description: 'Broadcast setup, live control and saved streams.',
    roles: ['seller'],
    prefixes: ['/dashboard/seller/live', '/dashboard/seller/go-live', '/dashboard/seller/stream', '/dashboard/seller/live-feed'],
  },
  {
    id: 'seller-earnings',
    label: 'Earnings & payouts',
    description: 'Earnings, wallet and payout history.',
    roles: ['seller'],
    prefixes: [
      '/dashboard/seller/earnings',
      '/dashboard/seller/wallet',
      // The seller app's own money screens. Earnings and Payments are one
      // concern — a toggle that left the app's copy running would be a toggle
      // that does nothing.
      '/app/seller/earnings',
      '/app/seller/payments',
    ],
  },
  {
    id: 'seller-marketing',
    label: 'Marketing & boosts',
    description: 'Promotions, ads and assist-boost tooling.',
    roles: ['seller'],
    prefixes: ['/dashboard/seller/marketing', '/dashboard/seller/ads', '/dashboard/seller/assist-boost'],
  },
  {
    id: 'seller-settings',
    label: 'Seller settings',
    description: 'Storefront settings, reseller tools and reports.',
    roles: ['seller'],
    prefixes: ['/dashboard/seller/settings', '/dashboard/seller/reseller', '/dashboard/seller/wishlist', '/dashboard/seller/report-issue', '/dashboard/seller/notifications', '/app/seller/care'],
  },
];

/** Sections an admin can switch off, i.e. the non-admin parts of the app. */
export const CONTROLLABLE_SECTIONS = APP_SECTIONS;

/** map of sectionId -> enabled boolean; absent means enabled. */
export type SectionToggles = Record<string, boolean>;

export function isSectionEnabled(toggles: SectionToggles | null | undefined, id: string): boolean {
  // Fail open on purpose: a missing or unreadable config must not lock every
  // buyer and seller out of the app.
  return toggles?.[id] !== false;
}

/**
 * The section that owns a pathname, or null when the path is not a controllable
 * app section (landing pages, sign-in, admin, the app shell itself).
 *
 * Longest matching prefix wins so `/buyer/my-orders` is not swallowed by a
 * shorter, less specific section.
 */
export function sectionForConsumerPath(pathname: string | null | undefined): AppSection | null {
  if (!pathname) return null;
  let best: AppSection | null = null;
  let bestLength = -1;
  for (const section of APP_SECTIONS) {
    for (const prefix of section.prefixes) {
      const matches = pathname === prefix || pathname.startsWith(`${prefix}/`);
      if (matches && prefix.length > bestLength) {
        best = section;
        bestLength = prefix.length;
      }
    }
  }
  return best;
}

/**
 * True when a role may use a section.
 *
 * A section that lists the role is required; an explicit `false` toggle always
 * wins. Admins are never blocked — the admin panel is not part of this registry.
 */
export function canRoleUseSection(
  section: AppSection,
  role: 'buyer' | 'seller' | null | undefined,
  toggles: SectionToggles | null | undefined
): boolean {
  if (role !== 'buyer' && role !== 'seller') return true;
  if (!isSectionEnabled(toggles, section.id)) return false;
  return section.roles.includes(role);
}