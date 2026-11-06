import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ProductCard } from '../../src/components/product-card';
import { Chip, EmptyState, ErrorState, Loading, Muted, Screen } from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { seller } from '../../src/lib/api';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, spacing, type } from '../../src/theme';

type Filter = 'all' | 'low' | 'services';

/**
 * YOUR LISTINGS — the seller's own catalogue.
 *
 * `/api/products/mine` is the store-first reader the website's stock screen
 * uses, so a seller sees the same inventory here even when Firestore is the
 * outage. Creating and editing a listing lives in the web seller studio and is
 * not in this build; this screen says that rather than offering a button that
 * would do nothing.
 */
export default function SellerProductsScreen() {
  return (
    <RequireAuth>
      <Products />
    </RequireAuth>
  );
}

function Products() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const { data, loading, error, reload } = useAuthedResource((token) => seller.products(token), []);

  const all = (data?.products ?? []) as any[];

  const items = useMemo(() => {
    if (filter === 'services') return all.filter((p) => p.listingType === 'service');
    if (filter === 'low') {
      return all.filter((p) => (typeof p.stock === 'number' && p.stock <= 3) || p.availabilityState === 'out_of_stock');
    }
    return all;
  }, [all, filter]);

  if (loading && !data) return <Loading label="Loading your listings…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <Screen>
      <View style={styles.header}>
        <Muted>
          {all.length} {all.length === 1 ? 'listing' : 'listings'}
          {data?.source === 'firestore' ? ' · served from the backup store' : ''}
        </Muted>
        <View style={styles.chips}>
          <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="Low stock" active={filter === 'low'} onPress={() => setFilter('low')} />
          <Chip label="Services" active={filter === 'services'} onPress={() => setFilter('services')} />
        </View>
        <Text style={styles.hint}>
          Tap a listing to see it as buyers do. Editing happens in the seller studio on vidnov.com.
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <ProductCard product={item} />}
        refreshing={loading}
        onRefresh={reload}
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title={all.length === 0 ? 'No listings yet' : 'Nothing in this filter'}
            body={
              all.length === 0
                ? 'Publish your first product or service from the seller studio on vidnov.com.'
                : 'No listing matches this filter.'
            }
            action={
              all.length === 0 ? undefined : (
                <Chip label="Show all" active onPress={() => setFilter('all')} />
              )
            }
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm },
  hint: { color: colors.textFaint, ...type.caption, lineHeight: 16 },
  list: { gap: spacing.md, padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl * 2 },
});
