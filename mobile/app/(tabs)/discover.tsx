import React from 'react';

import { DiscoverySection } from '../../src/components/discovery/section';
import { Screen } from '../../src/components/ui';

/**
 * DISCOVER (buyer tab).
 *
 * The website's `/app/buyer/discovery` rendered natively: one section with
 * three panels — the full-screen listing feed, the themed collections and the
 * catalogue — over the same `/api/search` the website reads.
 */
export default function DiscoverScreen() {
  return (
    <Screen>
      <DiscoverySection />
    </Screen>
  );
}
