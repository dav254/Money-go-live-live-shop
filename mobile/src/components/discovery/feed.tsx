import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { CommentsSheet } from './comments-sheet';
import { DiscoveryPost } from './post';
import { catalog } from '../../lib/api';
import { newestFirst } from '../../lib/discovery';
import { fonts, premium, radius, spacing } from '../../theme';
import type { Product, SellerCard } from '../../lib/types';

/**
 * THE FEED — one listing per screen, one gesture: up.
 *
 * The catalogue page is fetched by the section (so Themes can borrow a real
 * cover from it) and handed here already sorted newest-first. Paging is
 * full-cell: a flick lands on a listing, never between two.
 *
 * Seller cards and live state are not on the search projection, so the visible
 * post resolves its seller through `/api/mobile/listing/{id}` and caches the
 * answer — one request per post actually seen, never fifty up front.
 */
export function DiscoveryFeed({
  products,
  loading,
  error,
  onRetry,
  liveSellerIds,
}: {
  products: Product[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  liveSellerIds: Set<string>;
}) {
  const [viewport, setViewport] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sellers, setSellers] = useState<Record<string, SellerCard | null>>({});
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const resolved = useRef<Record<string, boolean>>({});

  const items = useMemo(() => [...products].sort(newestFirst), [products]);

  useEffect(() => {
    if (items.length === 0) {
      setActiveId(null);
      return;
    }
    setActiveId((current) =>
      current && items.some((item) => item.id === current) ? current : items[0].id,
    );
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
        // A post without a shop card still renders; the feed does not fail.
        if (alive) setSellers((prev) => ({ ...prev, [activeId]: null }));
      });
    return () => {
      alive = false;
    };
  }, [activeId]);

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
        likes={item.likes}
        isLive={!!item.sellerId && liveSellerIds.has(item.sellerId)}
        commentCount={commentCounts[item.id]}
        onOpenComments={() => setCommentsFor(item.id)}
      />
    ),
    [activeId, commentCounts, liveSellerIds, sellers, viewport],
  );

  return (
    <View
      style={styles.root}
      onLayout={(event) => setViewport(Math.round(event.nativeEvent.layout.height))}
    >
      {loading && products.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={premium.brand} />
          <Text style={styles.centerLabel}>LOADING THE FEED</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={26} color={premium.textMuted} />
          <Text style={styles.centerTitle}>Discovery could not load</Text>
          <Text style={styles.centerBody}>
            The listings did not come through. Nothing is wrong with your account — try again.
          </Text>
          <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
            <Ionicons name="refresh" size={14} color={premium.text} />
            <Text style={styles.retryLabel}>RETRY</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="compass-outline" size={26} color={premium.textMuted} />
          <Text style={styles.centerTitle}>Nothing here yet</Text>
          <Text style={styles.centerBody}>
            Once sellers publish listings, they appear here straight away. Try Shop to search the
            catalogue, or Themes to browse a collection.
          </Text>
          <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
            <Ionicons name="refresh" size={14} color={premium.text} />
            <Text style={styles.retryLabel}>REFRESH</Text>
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
          removeClippedSubviews={false}
        />
      ) : null}

      <CommentsSheet
        listingId={commentsFor}
        visible={!!commentsFor}
        onClose={() => setCommentsFor(null)}
        onCount={(count) =>
          setCommentCounts((prev) => (commentsFor ? { ...prev, [commentsFor]: count } : prev))
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: premium.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  centerLabel: {
    color: premium.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 10.5,
    letterSpacing: 2.2,
  },
  centerTitle: { color: premium.text, fontFamily: fonts.heading, fontSize: 17, textAlign: 'center' },
  centerBody: {
    color: premium.textMuted,
    fontFamily: fonts.body,
    fontSize: 12.5,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 19,
  },
  retry: {
    marginTop: spacing.sm,
    height: 40,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: premium.brand,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  retryLabel: { color: premium.text, fontFamily: fonts.bodyBold, fontSize: 11.5, letterSpacing: 1 },
});
