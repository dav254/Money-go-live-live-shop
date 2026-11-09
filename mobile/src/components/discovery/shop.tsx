import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { ProductCard } from '../product-card';
import { Chip, EmptyState, ErrorState, Loading, Muted } from '../ui';
import { catalog } from '../../lib/api';
import { isService, newestFirst, type ThemeSeed } from '../../lib/discovery';
import { useResource } from '../../lib/use-resource';
import { colors, spacing, type } from '../../theme';
import type { Product } from '../../lib/types';

type Kind = 'all' | 'product' | 'service';

/**
 * DISCOVERY · SHOP — the commercial half.
 *
 * A thin client over the same `/api/search` the feed reads, so a listing
 * cannot be ranked one way in the feed and another way here. The category
 * filter is applied by the server (it is an indexed equality query), the kind
 * filter on the returned page because a listing's type is a field on the
 * document rather than an endpoint.
 */
export function DiscoveryShop({ query, seed }: { query: string; seed?: ThemeSeed }) {
  const [kind, setKind] = useState<Kind>(seed?.kind ?? 'all');
  const [category, setCategory] = useState<string | undefined>(seed?.category);

  /* A tile tapped in Themes re-seeds the catalogue. */
  useEffect(() => {
    setCategory(seed?.category);
    setKind(seed?.kind ?? 'all');
  }, [seed]);

  const { data, loading, error, reload } = useResource(
    () => catalog.search({ q: query, category, limit: 50 }),
    [query, category],
  );

  const items = useMemo<Product[]>(() => {
    const raw: Product[] = Array.isArray(data?.products) ? data!.products : [];
    const filtered =
      kind === 'all'
        ? raw
        : raw.filter((product) => (kind === 'service' ? isService(product) : !isService(product)));
    return [...filtered].sort(newestFirst);
  }, [data, kind]);

  return (
    <View style={styles.root}>
      <View style={styles.filters}>
        <Chip label="Everything" active={kind === 'all'} onPress={() => setKind('all')} />
        <Chip label="Products" active={kind === 'product'} onPress={() => setKind('product')} />
        <Chip label="Services" active={kind === 'service'} onPress={() => setKind('service')} />
        {category ? <Chip label={`${category} ·`} active onPress={() => setCategory(undefined)} /> : null}
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
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <ProductCard product={item} />}
          refreshing={loading}
          onRefresh={reload}
          ListHeaderComponent={
            items.length > 0 ? (
              <Muted>
                {items.length} {items.length === 1 ? 'listing' : 'listings'}
                {query.trim() ? ` for “${query.trim()}”` : ''}
                {category ? ` in ${category}` : ''}
              </Muted>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title={query.trim() || category ? 'Nothing matches yet' : 'The catalogue is empty'}
              body={
                query.trim() || category
                  ? 'No seller has published a match for this combination. Try a broader search or clear the filter.'
                  : 'Sellers have not published listings yet. Check back shortly.'
              }
            />
          }
        />
      )}
      <Text style={styles.footer}>
        Prices shown are set by sellers, not by Vidnov.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  list: { gap: spacing.md, padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl * 2 },
  footer: { color: colors.textFaint, ...type.caption, textAlign: 'center', paddingBottom: spacing.md },
});
