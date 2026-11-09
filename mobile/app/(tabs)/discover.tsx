import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiscoverySection } from '../../src/components/discovery/section';
import { premium } from '../../src/theme';

/**
 * DISCOVER (buyer tab).
 *
 * The website's discovery section natively: one place with DISCOVER, THEMES
 * and SHOP inside it, over the same `/api/search` and `/api/discover` the
 * website reads. The section owns its own compact header, so this screen only
 * supplies the safe area.
 */
export default function DiscoverScreen() {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: premium.background }}>
      <DiscoverySection showHeader />
    </SafeAreaView>
  );
}
