import type { Ionicons } from '@expo/vector-icons';

/**
 * SELLER CENTRE MAP — one source of truth for the drawer and the dashboard.
 *
 * Every entry here is a route that exists. A nav item with no screen would be
 * a dead button in a business tool, which is worse than not offering it: a
 * seller taps it expecting their shop and gets nothing. Adding a row here means
 * adding the screen it points at.
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
    title: 'Business',
    items: [
      { label: 'Dashboard', href: '/seller', icon: 'grid-outline', detail: 'Your shop at a glance' },
      { label: 'My shop', href: '/seller/shop', icon: 'storefront-outline', detail: 'How buyers see you' },
    ],
  },
  {
    title: 'Sell & manage',
    items: [
      { label: 'Products & services', href: '/seller/products', icon: 'cube-outline', detail: 'Add, edit, publish' },
      { label: 'Videos & posts', href: '/seller/content', icon: 'videocam-outline', detail: 'Show your work' },
      { label: 'Live selling', href: '/seller/live', icon: 'radio-outline', detail: 'Go live from your shop' },
      { label: 'Orders', href: '/seller/orders', icon: 'receipt-outline', detail: 'Ship and fulfil' },
      { label: 'Buyer inquiries', href: '/seller/inquiries', icon: 'chatbubbles-outline', detail: 'Messages from buyers' },
      { label: 'Requests & offers', href: '/seller/requests', icon: 'pricetag-outline', detail: 'Reply to briefs' },
      { label: 'Customers', href: '/seller/customers', icon: 'people-outline', detail: 'People who bought' },
    ],
  },
  {
    title: 'Grow',
    items: [
      { label: 'Analytics', href: '/seller/analytics', icon: 'stats-chart-outline', detail: 'What is working' },
      { label: 'Marketing & promotions', href: '/seller/marketing', icon: 'megaphone-outline' },
      { label: 'Reseller programme', href: '/seller/reseller', icon: 'git-network-outline' },
      { label: 'AI business tools', href: '/seller/ai', icon: 'sparkles-outline' },
    ],
  },
  {
    title: 'Money',
    items: [
      { label: 'Wallet', href: '/seller/wallet', icon: 'wallet-outline', detail: 'Sales and payouts' },
      { label: 'Transactions', href: '/seller/transactions', icon: 'swap-horizontal-outline' },
      { label: 'Invoices & receipts', href: '/seller/invoices', icon: 'document-text-outline' },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Shop settings', href: '/seller/settings', icon: 'settings-outline' },
      { label: 'Seller profile', href: '/seller/profile', icon: 'person-circle-outline' },
      { label: 'Help & support', href: '/seller/help', icon: 'help-buoy-outline' },
    ],
  },
];
