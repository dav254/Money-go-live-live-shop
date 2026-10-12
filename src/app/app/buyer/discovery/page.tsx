'use client';

/**
 * BUYER APP · DISCOVERY
 *
 * The same Discovery section the website ships at `/buyer/discovery`, inside
 * the buyer shell. Immersive (see `IMMERSIVE_ROUTES` in the buyer shell): the
 * shell's own tab bar is hidden so the feed can own the viewport, which is why
 * this route supplies its own bottom bar — without it a buyer three listings
 * deep has no way home.
 */

import { Compass, Home, MessageSquare, ShoppingBag, UserRound } from 'lucide-react';

import { DiscoverySection } from '@/components/discovery/discovery-section';
import type { DiscoveryNavItem } from '@/components/discovery/discovery-nav';

const NAV: DiscoveryNavItem[] = [
  { key: 'home', label: 'Home', href: '/app/buyer', icon: Home, exact: true },
  { key: 'discover', label: 'Discover', href: '/app/buyer/discovery', icon: Compass },
  { key: 'shop', label: 'Shop', href: '/app/buyer/shop', icon: ShoppingBag, raised: true },
  { key: 'messages', label: 'Messages', href: '/app/buyer/messages', icon: MessageSquare },
  { key: 'profile', label: 'Profile', href: '/app/buyer/account', icon: UserRound },
];

export default function BuyerAppDiscoveryPage() {
  return (
    <div className="vn-discovery-in-app">
      <DiscoverySection nav={NAV} />
    </div>
  );
}
