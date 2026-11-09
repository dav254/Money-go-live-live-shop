import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { DiscoveryFeed } from './feed';
import { DiscoveryShop } from './shop';
import { DiscoveryThemes } from './themes';
import { Field } from '../ui';
import { useDebounced } from '../../lib/use-resource';
import { colors, radius, spacing } from '../../theme';
import type { DiscoveryTab, ThemeSeed } from '../../lib/discovery';

/**
 * DISCOVERY — one section, three panels.
 *
 * Discover, Themes and Shop are TABS of one place rather than three
 * destinations, exactly like `/app/buyer/discovery` on the website: the header,
 * the search and the tab row stay put while the panel underneath changes. Both
 * the buyer tab and the seller's Discovery screen render this component, so the
 * two provably show the same catalogue in the same order.
 */

const TABS: Array<{ id: DiscoveryTab; label: string }> = [
  { id: 'discover', label: 'Discover' },
  { id: 'themes', label: 'Themes' },
  { id: 'shop', label: 'Shop' },
];

export function DiscoverySection({ hint }: { hint?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<DiscoveryTab>('discover');
  const [seed, setSeed] = useState<ThemeSeed | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const debounced = useDebounced(query, 350);

  return (
    <View style={styles.root}>
      <View style={styles.tabBar}>
        {TABS.map((entry) => {
          const active = tab === entry.id;
          return (
            <Pressable
              key={entry.id}
              onPress={() => setTab(entry.id)}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={entry.label}
            >
              <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>
                {entry.label.toUpperCase()}
              </Text>
              <View style={[styles.tabUnderline, active ? styles.tabUnderlineActive : null]} />
            </Pressable>
          );
        })}

        <View style={styles.spacer} />

        <Pressable
          onPress={() => router.push('/live')}
          style={styles.icon}
          accessibilityRole="button"
          accessibilityLabel="Live streams"
        >
          <View style={styles.liveDot} />
        </Pressable>
        <Pressable
          onPress={() => {
            setSearchOpen((open) => !open);
            if (searchOpen) setQuery('');
          }}
          style={styles.icon}
          accessibilityRole="button"
          accessibilityLabel={searchOpen ? 'Close search' : 'Search the catalogue'}
        >
          <Ionicons name={searchOpen ? 'close' : 'search'} size={19} color={colors.text} />
        </Pressable>
      </View>

      {searchOpen ? (
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={colors.textFaint} />
          <Field
            placeholder="Search products, services and shops"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoFocus
            style={styles.searchInput}
          />
          {query.length > 0 ? (
            <Text onPress={() => setQuery('')} style={styles.clear}>
              Clear
            </Text>
          ) : null}
        </View>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}

      {tab === 'discover' ? <DiscoveryFeed query={debounced} /> : null}
      {tab === 'themes' ? (
        <DiscoveryThemes
          onExplore={(next) => {
            setSeed(next);
            setTab('shop');
          }}
        />
      ) : null}
      {tab === 'shop' ? <DiscoveryShop query={debounced} seed={seed} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, alignItems: 'center' },
  tabLabel: { color: colors.textFaint, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.5 },
  tabLabelActive: { color: colors.text },
  tabUnderline: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 0,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  tabUnderlineActive: { backgroundColor: colors.primary },
  spacer: { flex: 1 },
  icon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, borderWidth: 0, backgroundColor: 'transparent', minHeight: 44 },
  clear: { color: colors.primary, fontWeight: '700', fontSize: 12.5 },
  hint: {
    color: colors.textFaint,
    fontSize: 11.5,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
});
