'use client';

/**
 * BUYER APP · DISCOVERY
 *
 * The same Discovery section the website ships at `/buyer/discovery`, inside
 * the buyer shell. Immersive (see `IMMERSIVE_ROUTES` in the buyer shell): the
 * shell's own tab bar is hidden so the feed can own the viewport.
 *
 * `noBottomNav` mirrors the seller route exactly: the section used to render
 * its own HOME/DISCOVER/SHOP/MESSAGES/PROFILE bar on top of the app's normal
 * navigation, which put two footers on the screen — one on every other buyer
 * screen and a second, different one here. The shell header's menu and back
 * buttons are the way out of this screen, the same way they are for sellers.
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
      <DiscoverySection nav={NAV} noBottomNav />
    </div>
  );
}
