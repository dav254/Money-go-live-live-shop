import type { Ionicons } from '@expo/vector-icons';

/**
 * SELLER CENTRE MAP — the Android app's version of the website's
 * `/app/seller` drawer.
 *
 * The first two groups are the website's, in the website's order:
 *
 *   Store               — Overview, Messages, Earnings, Payments
 *   Create & broadcast   — Live studio, Discovery, AI Studio, Videos & posts, Requests
 *   You                  — View my shop, Share & QR, My business, Notifications,
 *                          Customer Care, Settings, Account
 *
 * One extra group, **Manage**, holds what the phone needs and the website's
 * drawer does not carry: the catalogue, fulfilment, customers and analytics are
 * the seller's daily work here, and hiding them behind a second screen to keep
 * the group list identical would be tidier to read and worse to use.
 *
 * What is NOT copied from the website drawer, on purpose:
 *
 *   • **Classic Studio, Video Studio, Living Pictures** — full browser editors.
 *     There is no native implementation, and the app's own publishing path is
 *     Videos & posts (`/seller/content`), which already hands off to the video
 *     studio for the one job the phone cannot do.
 *
 * Every entry here is a route that exists. A nav item with no screen would be a
 * dead button in a business tool, which is worse than not offering it: a seller
 * taps it expecting their shop and gets nothing.
 */
export type SellerNavItem = {
  label: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  detail?: string;
};

export type SellerNavGroup = {
  title: string;
  items: SellerNavItem[];
};

export const SELLER_NAV: SellerNavGroup[] = [
  {
    title: 'Store',
    items: [
      { label: 'Overview', href: '/seller', icon: 'grid-outline', detail: 'Your shop at a glance' },
      { label: 'Messages', href: '/seller/messages', icon: 'chatbubbles-outline', detail: 'Threads with buyers' },
      { label: 'Earnings', href: '/seller/wallet', icon: 'stats-chart-outline', detail: 'Sales and payouts' },
      { label: 'Payments', href: '/seller/transactions', icon: 'card-outline', detail: 'Money in and out' },
    ],
  },
  {
    title: 'Create & broadcast',
    items: [
      { label: 'Create', href: '/seller/create', icon: 'add-circle-outline', detail: 'Listing, live, AI, posts' },
      { label: 'Live studio', href: '/seller/live', icon: 'radio-outline', detail: 'Go live from your shop' },
      {
        label: 'Discovery',
        href: '/seller/discovery',
        icon: 'compass-outline',
        detail: 'What buyers see right now',
      },
      {
        label: 'Growth centre',
        href: '/seller/growth',
        icon: 'trending-up-outline',
        detail: 'Free distribution and paid boosts',
      },
      { label: 'AI Studio', href: '/seller/ai', icon: 'sparkles-outline', detail: 'Generate listings and posts' },
      { label: 'Videos & posts', href: '/seller/content', icon: 'videocam-outline', detail: 'Show your work' },
      {
        label: 'Requests',
        href: '/seller/requests',
        icon: 'pricetag-outline',
        detail: 'Reply to buyer briefs',
      },
    ],
  },
  {
    title: 'Manage',
    items: [
      {
        label: 'Products & services',
        href: '/seller/products',
        icon: 'cube-outline',
        detail: 'Add, edit, publish',
      },
      { label: 'Orders', href: '/seller/orders', icon: 'receipt-outline', detail: 'Ship and fulfil' },
      { label: 'Buyer inquiries', href: '/seller/inquiries', icon: 'mail-unread-outline', detail: 'Questions about a listing' },
      { label: 'Customers', href: '/seller/customers', icon: 'people-outline', detail: 'People who bought' },
      { label: 'Analytics', href: '/seller/analytics', icon: 'bar-chart-outline', detail: 'What is working' },
      { label: 'Marketing & promotions', href: '/seller/marketing', icon: 'megaphone-outline' },
      { label: 'Invoices & receipts', href: '/seller/invoices', icon: 'document-text-outline' },
      { label: 'Reseller programme', href: '/seller/reseller', icon: 'git-network-outline' },
    ],
  },
  {
    title: 'You',
    items: [
      { label: 'View my shop', href: '/seller/shop', icon: 'storefront-outline', detail: 'How buyers see you' },
      { label: 'Share & QR', href: '/seller/share', icon: 'qr-code-outline', detail: 'Get buyers to your shop' },
      {
        label: 'My business',
        href: '/seller/business',
        icon: 'location-outline',
        detail: 'Area, hours, service areas',
      },
      { label: 'Notifications', href: '/seller/notifications', icon: 'notifications-outline' },
      { label: 'AI points', href: '/seller/points', icon: 'ribbon-outline', detail: 'Balance and what it buys' },
      { label: 'Invite & earn', href: '/seller/rewards', icon: 'gift-outline', detail: 'Referral points' },
      { label: 'Customer Care', href: '/seller/help', icon: 'headset-outline', detail: 'Talk to the team' },
      { label: 'Account', href: '/seller/account', icon: 'person-circle-outline' },
      // Shop settings is the drawer's footer row for this role, so it is not
      // repeated in the group above.
    ],
  },
];
