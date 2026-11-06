import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { RemoteImage } from '../../src/components/remote-image';
import { SellerHeader } from '../../src/components/seller/seller-header';
import {
  ErrorState,
  Loading,
  Muted,
  Notice,
  Screen,
  SectionHeader,
  StatTile,
} from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { seller } from '../../src/lib/api';
import { money } from '../../src/lib/format';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * ANALYTICS — only measurements the backend actually records.
 *
 * Views, likes and sales counters live on each product document and are written
 * by the buyer surfaces. Where those counters have never been incremented the
 * screen says zero rather than estimating; there is no traffic model here to
 * quietly fill the gap.
 */
export default function SellerAnalyticsScreen() {
  return (
    <RequireAuth>
      <Analytics />
    </RequireAuth>
  );
}

function Analytics() {
  const overview = useAuthedResource((token) => seller.overview(token), []);
  const products = useAuthedResource((token) => seller.products(token), []);

  const list = (products.data?.products ?? []) as any[];

  const totals = useMemo(() => {
    let views = 0;
    let likes = 0;
    let sales = 0;
    for (const product of list) {
      views += Number(product.viewCount ?? 0) || 0;
      likes += Number(product.likes ?? 0) || 0;
      sales += Number(product.salesCount ?? 0) || 0;
    }
    const top = [...list]
      .sort((a, b) => (Number(b.viewCount ?? 0) || 0) - (Number(a.viewCount ?? 0) || 0))
      .slice(0, 5);
    return { views, likes, sales, top };
  }, [list]);

  if ((overview.loading && !overview.data) || (products.loading && !products.data)) {
    return (
      <Screen>
        <SellerHeader title="Analytics" showBack />
        <Loading label="Reading your numbers…" />
      </Screen>
    );
  }

  if (overview.error || products.error) {
    return (
      <Screen>
        <SellerHeader title="Analytics" showBack />
        <ErrorState
          message={overview.error || products.error || 'Could not load analytics.'}
          onRetry={() => {
            overview.reload();
            products.reload();
          }}
        />
      </Screen>
    );
  }

  const stats = overview.data!;

  return (
    <Screen>
      <SellerHeader title="Analytics" subtitle="What your shop has actually done" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.grid}>
          <StatTile
            label="Delivered sales"
            value={money(stats.deliveredRevenue)}
            hint="Orders marked delivered"
            tone="primary"
          />
          <StatTile label="Orders" value={String(stats.orders.total)} hint={`${stats.orders.delivered} delivered`} />
          <StatTile label="Listing views" value={String(totals.views)} hint="Recorded on your listings" />
          <StatTile label="Likes" value={String(totals.likes)} hint="Saves and likes on listings" />
          <StatTile label="Units sold" value={String(totals.sales)} hint="Counted at checkout" />
          <StatTile
            label="Out of stock"
            value={String(stats.listings.outOfStock)}
            hint="Restock to keep selling"
            tone={stats.listings.outOfStock > 0 ? 'warning' : 'default'}
          />
        </View>

        <SectionHeader title="Most viewed listings" />
        {totals.top.length === 0 ? (
          <Muted>Publish a listing to start collecting views.</Muted>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {totals.top.map((product) => (
              <View key={product.id} style={styles.row}>
                <RemoteImage source={product.imageUrl} style={styles.image} label={product.name} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={styles.name}>
                    {product.name || 'Untitled'}
                  </Text>
                  <Muted>{product.category || 'No category'}</Muted>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.number}>{Number(product.viewCount ?? 0)}</Text>
                  <Muted>views</Muted>
                </View>
              </View>
            ))}
          </View>
        )}

        <Notice
          title="Counters, not estimates"
          body="These figures are the values stored on your listings and orders. Vidnov does not estimate traffic, conversions or projected revenue."
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  image: { width: 44, height: 44 },
  name: { color: colors.text, ...type.bodyStrong },
  number: { color: colors.text, ...type.bodyStrong, fontWeight: '800' },
});
