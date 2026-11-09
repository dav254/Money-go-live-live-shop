import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DiscoveryPost } from './post';
import { catalog } from '../../lib/api';
import { newestFirst } from '../../lib/discovery';
import { useResource } from '../../lib/use-resource';
import { colors, radius, spacing, type } from '../../theme';
import type { Product, SellerCard } from '../../lib/types';

/**
 * THE FEED — one listing per screen, one gesture: up.
 *
 * A page of the real catalogue (`/api/search`, the same endpoint the website
 * reads), ordered newest-first on the device because `uploadDate` is written
 * by several generations of the upload form. Paging is disabled: the list
 * snaps a full cell at a time, so a flick lands on a listing and never between
 * two of them.
 *
 * The seller card (shop name, verified mark, avatar) is not on the search
 * projection, so it is fetched for the post on screen only and cached — one
 * request per post actually seen, never fifty up front.
 */
export function DiscoveryFeed({ query }: { query: string }) {
  const [viewport, setViewport] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sellers, setSellers] = useState<Record<string, SellerCard | null>>({});
  const resolved = useRef<Record<string, boolean>>({});

  const { data, loading, error, reload } = useResource(
    () => catalog.search({ q: query, limit: 50 }),
    [query],
  );

  const items = useMemo<Product[]>(() => {
    const raw: Product[] = Array.isArray(data?.products) ? data!.products : [];
    return [...raw].sort(newestFirst);
  }, [data]);

  useEffect(() => {
    if (items.length === 0) {
      setActiveId(null);
      return;
    }
    setActiveId((current) => (current && items.some((item) => item.id === current) ? current : items[0].id));
  }, [items]);

  useEffect(() => {
    if (!activeId || resolved.current[activeId]) return;
    resolved.current[activeId] = true;
    let alive = true;
    catalog
      .listing(activeId)
      .then((result) => {
        if (!alive) return;
        setSellers((prev) => ({ ...prev, [activeId]: (result?.seller ?? null) as SellerCard | null }));
      })
      .catch(() => {
        // The post renders without a shop card rather than failing the feed.
        if (alive) setSellers((prev) => ({ ...prev, [activeId]: null }));
      });
    return () => {
      alive = false;
    };
  }, [activeId]);

  // FlatList's own callback type is not exported by this React Native
  // version, so the shape it passes is described here instead.
  const onViewable = useRef(
    (info: { viewableItems: Array<{ isViewable?: boolean | null; item?: unknown }> }) => {
      const first = info.viewableItems.find((entry) => entry.isViewable);
      const product = first?.item as Product | undefined;
      if (product?.id) setActiveId(product.id);
    },
  ).current;

  const viewability = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const renderItem = useCallback(
    ({ item }: { item: Product }) => (
      <DiscoveryPost
        product={item}
        seller={sellers[item.id]}
        active={item.id === activeId}
        height={viewport}
      />
    ),
    [activeId, sellers, viewport],
  );

  return (
    <View
      style={styles.root}
      onLayout={(event) => setViewport(Math.round(event.nativeEvent.layout.height))}
    >
      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.centerLabel}>Loading the feed</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={26} color={colors.textFaint} />
          <Text style={styles.centerTitle}>Discovery could not load</Text>
          <Text style={styles.centerBody}>
            The listings did not come through. Nothing is wrong with your account — try again.
          </Text>
          <Pressable onPress={reload} style={styles.retry} accessibilityRole="button">
            <Ionicons name="refresh" size={14} color={colors.background} />
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="compass-outline" size={26} color={colors.textFaint} />
          <Text style={styles.centerTitle}>{query.trim() ? 'No matches' : 'Nothing here yet'}</Text>
          <Text style={styles.centerBody}>
            {query.trim()
              ? `Nothing matches “${query.trim()}”. Try a different word or clear the search.`
              : 'Once sellers publish listings, they appear here straight away.'}
          </Text>
          <Pressable onPress={reload} style={styles.retry} accessibilityRole="button">
            <Ionicons name="refresh" size={14} color={colors.background} />
            <Text style={styles.retryLabel}>Refresh</Text>
          </Pressable>
        </View>
      ) : viewport > 0 ? (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          disableIntervalMomentum
          getItemLayout={(_, index) => ({ length: viewport, offset: viewport * index, index })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={viewability}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          removeClippedSubviews
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  centerLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  centerTitle: { color: colors.text, ...type.heading, textAlign: 'center' },
  centerBody: { color: colors.textMuted, ...type.caption, textAlign: 'center', maxWidth: 300, lineHeight: 18 },
  retry: {
    marginTop: spacing.sm,
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  retryLabel: { color: colors.background, fontSize: 12, fontWeight: '800' },
});
