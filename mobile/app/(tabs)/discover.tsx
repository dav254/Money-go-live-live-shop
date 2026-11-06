import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ProductCard } from '../../src/components/product-card';
import { Chip, EmptyState, ErrorState, Field, Loading, Muted, Screen } from '../../src/components/ui';
import { catalog } from '../../src/lib/api';
import { useDebounced, useResource } from '../../src/lib/use-resource';
import { colors, spacing, type } from '../../src/theme';
import type { Product } from '../../src/lib/types';

type Kind = 'all' | 'product' | 'service';

/**
 * DISCOVERY.
 *
 * Runs the same public, server-side `/api/search` the website uses, over the
 * same `products` collection — real inventory, not a mock. The kind filter is
 * applied on the returned page because a listing's type is a field on the
 * document, not a separate endpoint.
 */
export default function DiscoverScreen() {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const debouncedQuery = useDebounced(query, 350);

  const { data, loading, error, reload } = useResource(
    () => catalog.search({ q: debouncedQuery, limit: 50 }),
    [debouncedQuery],
  );

  const items = useMemo<Product[]>(() => {
    const raw: Product[] = Array.isArray(data?.products) ? data!.products : [];
    if (kind === 'all') return raw;
    return raw.filter((p) => (p.listingType ?? 'product') === kind);
  }, [data, kind]);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textFaint} />
          <Field
            placeholder="What are you looking for?"
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
        </View>
      </View>

      {loading && !data ? (
        <Loading label="Searching Vidnov…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={{ gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl * 2 }}
          renderItem={({ item }) => <ProductCard product={item} />}
          refreshing={loading}
          onRefresh={reload}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title={debouncedQuery ? 'No matches' : 'Nothing here yet'}
              body={
                debouncedQuery
                  ? `Nothing matched “${debouncedQuery}”. Try a different word or clear the filters.`
                  : 'Sellers have not published listings yet. Check back shortly.'
              }
            />
          }
          ListHeaderComponent={
            items.length > 0 ? (
              <Muted style={{ marginBottom: spacing.xs }}>
                {items.length} {items.length === 1 ? 'listing' : 'listings'}
                {debouncedQuery ? ` for “${debouncedQuery}”` : ''}
              </Muted>
            ) : undefined
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: 999, paddingLeft: spacing.lg },
  input: { flex: 1, borderWidth: 0, backgroundColor: 'transparent', minHeight: 46 },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.xs },
  title: { color: colors.text, ...type.heading },
});
