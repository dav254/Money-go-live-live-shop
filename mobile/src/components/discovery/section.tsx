import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DiscoveryHeader } from './header';
import { DiscoveryFeed } from './feed';
import { DiscoveryShop } from './shop';
import { DiscoveryThemes } from './themes';
import { LiveRail } from './live-rail';
import { catalog } from '../../lib/api';
import { newestFirst, type DiscoveryTab, type ThemeSeed } from '../../lib/discovery';
import { useDebounced, useResource } from '../../lib/use-resource';
import { fonts, premium, radius, spacing } from '../../theme';
import type { Product } from '../../lib/types';

/**
 * DISCOVERY — one section, three panels.
 *
 * DISCOVER · THEMES · SHOP are tabs of one place, exactly like the website's
 * discovery route: the header, the search and the tab row stay put while the
 * panel changes. Both the buyer tab and the seller's Discovery screen render
 * this component, so the two provably show the same catalogue in the same
 * order.
 *
 * The catalogue page is fetched ONCE here and shared: the feed uses it for the
 * posts, Themes borrows a real cover from it per collection. That is also why
 * a collection with no listings shows no photograph.
 */
export function DiscoverySection({
  showHeader = false,
  hint,
}: {
  /** Buyer surface: this component owns the top bar (the tab header is hidden). */
  showHeader?: boolean;
  hint?: string;
}) {
  const [tab, setTab] = useState<DiscoveryTab>('discover');
  const [seed, setSeed] = useState<ThemeSeed | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [liveSellerIds, setLiveSellerIds] = useState<Set<string>>(new Set());
  const debounced = useDebounced(query, 350);

  const { data, loading, error, reload } = useResource(
    () => catalog.search({ q: debounced, limit: 50 }),
    [debounced],
  );

  const products = useMemo<Product[]>(() => {
    const raw: Product[] = Array.isArray(data?.products) ? data!.products : [];
    return [...raw].sort(newestFirst);
  }, [data]);

  /* Which sellers are genuinely on air — only used for the LIVE pill. */
  useEffect(() => {
    let alive = true;
    catalog
      .liveNow()
      .then((result) => {
        if (!alive) return;
        const rooms = Array.isArray(result?.rooms) ? result.rooms : [];
        setLiveSellerIds(new Set(rooms.map((room) => room.sellerId).filter(Boolean)));
      })
      .catch(() => {
        if (alive) setLiveSellerIds(new Set());
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <View style={styles.root}>
      {showHeader ? (
        <DiscoveryHeader
          searchOpen={searchOpen}
          onToggleSearch={() => {
            setSearchOpen((open) => !open);
            if (searchOpen) setQuery('');
          }}
        />
      ) : null}

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
              <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{entry.label}</Text>
              <View style={[styles.tabUnderline, active ? styles.tabUnderlineActive : null]} />
            </Pressable>
          );
        })}
        <View style={styles.spacer} />
        <Pressable
          onPress={() => {
            setSearchOpen((open) => !open);
            if (searchOpen) setQuery('');
          }}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={searchOpen ? 'Close search' : 'Search the catalogue'}
        >
          <Ionicons
            name={searchOpen ? 'close' : 'search'}
            size={18}
            color={searchOpen ? premium.brand : premium.text}
          />
        </Pressable>
      </View>

      {searchOpen ? (
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={premium.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search products, services and shops"
            placeholderTextColor={premium.textMuted}
            style={styles.searchInput}
            autoCorrect={false}
            autoFocus
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
              <Ionicons name="close" size={16} color={premium.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}

      {tab === 'discover' ? (
        <>
          <LiveRail />
          <DiscoveryFeed
            products={products}
            loading={loading}
            error={error}
            onRetry={reload}
            liveSellerIds={liveSellerIds}
          />
        </>
      ) : null}

      {tab === 'themes' ? (
        <DiscoveryThemes
          products={products}
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

const TABS: Array<{ id: DiscoveryTab; label: string }> = [
  { id: 'discover', label: 'DISCOVER' },
  { id: 'themes', label: 'THEMES' },
  { id: 'shop', label: 'SHOP' },
];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: premium.background },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: premium.border,
  },
  tab: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, alignItems: 'center' },
  tabLabel: {
    color: premium.textMuted,
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 1.6,
  },
  tabLabelActive: { color: premium.text, fontFamily: fonts.bodyBold },
  tabUnderline: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 0,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  tabUnderlineActive: { backgroundColor: premium.brand },
  spacer: { flex: 1 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: premium.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: premium.border,
  },
  searchInput: { flex: 1, color: premium.text, fontFamily: fonts.body, fontSize: 13, padding: 0 },
  hint: {
    color: premium.textMuted,
    fontFamily: fonts.body,
    fontSize: 11.5,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
});
