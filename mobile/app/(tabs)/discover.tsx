import React from 'react';
import { useLocalSearchParams } from 'expo-router';
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
  /*
   * A category chip on the welcome screen opens Discovery with `?q=`. The
   * section starts with its search open on that term, so the entry point
   * actually filters the catalogue instead of only switching tabs.
   */
  const { q } = useLocalSearchParams<{ q?: string }>();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: premium.background }}>
      <DiscoverySection showHeader initialQuery={typeof q === 'string' ? q : undefined} />
    </SafeAreaView>
  );
}
