'use client';

/**
 * SELLER APP · DISCOVERY
 *
 * What sellers asked for: the same feed buyers see, from inside the seller
 * section. The old version was a separate grid ordered by a `createdAt` field
 * the upload form never writes, so it rendered as an empty screen and stayed
 * that way.
 *
 * It is now the shared Discovery feed, which means a seller looking at
 * "Discovery" and a buyer looking at Discovery are provably looking at the same
 * list in the same order. Anything else and the screen stops being a mirror.
 *
 * Immersive, so the shell's own tab bar is hidden on this route and the
 * section renders the shared Discovery bottom bar instead (one footer, never
 * two). Destinations and the rest of the shell are untouched.
 */

import { Compass, Home, MessageSquare, Plus, UserRound } from 'lucide-react';

import { DiscoverySection } from '@/components/discovery/discovery-section';
import { sellerListingCover } from '@/lib/discovery';
import type { DiscoveryNavItem } from '@/components/discovery/discovery-nav';

const NAV: DiscoveryNavItem[] = [
  { key: 'home', label: 'Home', href: '/app/seller', icon: Home, exact: true },
  { key: 'discover', label: 'Discover', href: '/app/seller/discovery', icon: Compass },
  { key: 'create', label: 'Create', href: '/app/seller/create', icon: Plus, raised: true },
  { key: 'messages', label: 'Messages', href: '/app/seller/messages', icon: MessageSquare },
  { key: 'profile', label: 'Profile', href: '/app/seller/account', icon: UserRound },
];

export default function SellerSectionDiscovery() {
  return (
    <div className="vn-discovery-in-app">
      {/* `fill`: the shell's header sits above this — a 100dvh section would
          push its bottom card below the fold. */}
      <DiscoverySection nav={NAV} fill ownCover={sellerListingCover} />
    </div>
  );
}
