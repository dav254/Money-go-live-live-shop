import React from 'react';

import { SellerHeader } from '../../src/components/seller/seller-header';
import { DiscoverySection } from '../../src/components/discovery/section';
import { Screen } from '../../src/components/ui';

/**
 * SELLER · DISCOVERY — the same section buyers see, in seller chrome.
 *
 * The website maps `/app/seller/discovery` to the shared feed rather than a
 * second seller-only list: a seller checking the competition should be looking
 * at exactly what a buyer is looking at. This renders the same
 * `DiscoverySection` component the buyer's Discover tab renders — same tabs,
 * same feed, same catalogue — behind the seller header.
 */
export default function SellerDiscoveryScreen() {
  return (
    <Screen>
      <SellerHeader title="Discovery" subtitle="What buyers see right now" showBack />
      <DiscoverySection hint="Sellers see the same feed buyers do." />
    </Screen>
  );
}
