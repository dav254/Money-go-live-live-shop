import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SellerHeader } from '../../src/components/seller/seller-header';
import { ProductCard } from '../../src/components/product-card';
import { Chip, EmptyState, ErrorState, Field, Loading, Muted, Screen } from '../../src/components/ui';
import { catalog } from '../../src/lib/api';
import { useDebounced, useResource } from '../../src/lib/use-resource';
import { colors, spacing } from '../../src/theme';
import type { Product } from '../../src/lib/types';

type Kind = 'all' | 'product' | 'service';

/**
 * SELLER · DISCOVERY — the same catalogue the buyer sees, in seller chrome.
 *
 * The website's seller drawer maps Discovery at `/app/seller/discovery`, which
 * renders the shared feed rather than a second, seller-only list: a seller who
 * wants to know what they are competing against should be looking at exactly
 * what a buyer is looking at. This screen runs the same public `/api/search`
 * the buyer's Discover tab runs, over the same `products` collection.
 */
export default function SellerDiscoveryScreen() {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [kind, setKind] = useState<Kind>('all');
  const [showFilters, setShowFilters] = useState(false);
  const debouncedQuery = useDebounced(query, 350);
  const debouncedLocation = useDebounced(location, 350);

  const { data, loading, error, reload } = useResource(
    () =>
      catalog.search({
        q: debouncedQuery,
        location: debouncedLocation,
        inStockOnly,
        limit: 50,
      }),
    [debouncedQuery, debouncedLocation, inStockOnly],
  );

  const items = useMemo<Product[]>(() => {
    const raw: Product[] = Array.isArray(data?.products) ? data!.products : [];
    if (kind === 'all') return raw;
    return raw.filter((p) => (p.listingType ?? 'product') === kind);
  }, [data, kind]);

  return (
    <Screen>
      <SellerHeader title="Discovery" subtitle="What buyers see right now" showBack />

      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textFaint} />
          <Field
            placeholder="Search the marketplace"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            style={styles.input}
          />
        </View>
        <View style={styles.chips}>
          <Chip label="Everything" active={kind === 'all'} onPress={() => setKind('all')} />
          <Chip label="Products" active={kind === 'product'} onPress={() => setKind('product')} />
          <Chip label="Services" active={kind === 'service'} onPress={() => setKind('service')} />
          <Chip
            label="Area"
            active={showFilters || !!location}
            onPress={() => setShowFilters((open) => !open)}
          />
          <Chip label="In stock" active={inStockOnly} onPress={() => setInStockOnly((on) => !on)} />
        </View>
        {showFilters ? (
          <View style={styles.filterRow}>
            <Ionicons name="location-outline" size={16} color={colors.textFaint} />
            <Field
              placeholder="Town or area, e.g. Nairobi"
              value={location}
              onChangeText={setLocation}
              autoCorrect={false}
              style={styles.filterInput}
            />
            {location.length > 0 ? (
              <Muted onPress={() => setLocation('')} style={styles.clear}>
                Clear
              </Muted>
            ) : null}
          </View>
        ) : null}
      </View>

      {loading && !data ? (
        <Loading label="Reading the marketplace…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <ProductCard product={item} />}
          refreshing={loading}
          onRefresh={reload}
          ListEmptyComponent={
            <EmptyState
              icon="compass-outline"
              title={debouncedQuery ? 'No matches' : 'The catalogue is empty'}
              body={
                debouncedQuery
                  ? `Nothing matched “${debouncedQuery}”. Try a different word or clear the filters.`
                  : 'No listings are published yet. Yours will appear here the moment they go live.'
              }
            />
          }
          ListHeaderComponent={
            items.length > 0 ? (
              <Muted style={{ marginBottom: spacing.xs }}>
                {items.length} {items.length === 1 ? 'listing' : 'listings'}
                {debouncedQuery ? ` for “${debouncedQuery}”` : ''} — priced by other sellers
              </Muted>
            ) : undefined
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingLeft: spacing.lg,
  },
  input: { flex: 1, borderWidth: 0, backgroundColor: 'transparent', minHeight: 46 },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingLeft: spacing.lg,
    paddingRight: spacing.lg,
  },
  filterInput: { flex: 1, borderWidth: 0, backgroundColor: 'transparent', minHeight: 44 },
  clear: { color: colors.primary, fontWeight: '700' },
  list: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
});
