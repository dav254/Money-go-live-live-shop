import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { RequireAuth } from '../src/components/require-auth';
import {
  Button,
  EmptyState,
  ErrorState,
  Heading,
  ListRow,
  Loading,
  Muted,
  Notice,
  Screen,
  SectionHeader,
  StatTile,
} from '../src/components/ui';
import { commerce } from '../src/lib/api';
import { useAuthedResource } from '../src/lib/use-authed';
import { money } from '../src/lib/format';
import { colors, radius, spacing } from '../src/theme';

/**
 * MY WALLET (buyer).
 *
 * What is on this screen is arithmetic over the buyer's OWN orders, which the
 * server already returns: what has been paid for and delivered, what is still
 * in flight, and what came back in refunds. Nothing is stored, so nothing can
 * drift from the orders list.
 *
 * Crucially, there is no invented "balance". Vidnov does not hold a buyer's
 * money in this build and the backend has no buyer wallet endpoint, so the
 * screen says exactly that rather than showing a fake credit figure with a
 * "Top up" button that would fail.
 */
type BuyerOrder = {
  id: string;
  status?: string;
  total?: number;
  currency?: string;
  placedAt?: string | null;
};

const SETTLED = new Set(['delivered', 'completed']);
const REFUNDED = new Set(['refunded', 'cancelled', 'canceled']);

export default function BuyerWalletScreen() {
  return (
    <RequireAuth>
      <Wallet />
    </RequireAuth>
  );
}

function Wallet() {
  const router = useRouter();
  const { data, loading, error, reload } = useAuthedResource(
    (token) => commerce.buyerOrders(token),
    [],
  );

  const orders = useMemo(() => (data?.orders ?? []) as BuyerOrder[], [data]);

  const totals = useMemo(() => {
    let delivered = 0;
    let inFlight = 0;
    let refunded = 0;
    for (const order of orders) {
      const amount = Number(order.total ?? 0);
      if (!Number.isFinite(amount)) continue;
      const status = String(order.status ?? '').toLowerCase();
      if (SETTLED.has(status)) delivered += amount;
      else if (REFUNDED.has(status)) refunded += amount;
      else inFlight += amount;
    }
    return { delivered, inFlight, refunded };
  }, [orders]);

  if (loading && !data) return <Loading label="Adding up your orders…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const currency = orders[0]?.currency || undefined;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: spacing.xs }}>
          <Heading>Your spending on Vidnov</Heading>
          <Muted>
            Calculated from your own orders — {orders.length || 'no'} order
            {orders.length === 1 ? '' : 's'} on this account.
          </Muted>
        </View>

        <View style={styles.stats}>
          <StatTile label="Delivered" value={money(totals.delivered, currency)} hint="Paid and completed" />
          <StatTile
            label="In progress"
            value={money(totals.inFlight, currency)}
            hint="Still being fulfilled"
          />
          <StatTile label="Refunded" value={money(totals.refunded, currency)} hint="Returned to you" />
        </View>

        <Notice
          title="No stored wallet balance"
          body="Vidnov does not hold buyer credit in this build. You pay per order, and refunds return to the method you paid with — so there is no balance to top up here."
        />

        <SectionHeader title="Money actions" />
        <View style={styles.group}>
          <ListRow
            icon="receipt-outline"
            title="Order history"
            detail="Every order and its payment method"
            onPress={() => router.push('/orders')}
          />
          <ListRow
            icon="help-buoy-outline"
            title="Payment problem?"
            detail="Contact support with the order number"
            onPress={() => router.push('/help')}
          />
        </View>

        {orders.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            title="Nothing to add up yet"
            body="Once you place your first order, its amount and status appear here automatically."
            action={
              <Button
                label="Browse the marketplace"
                icon="storefront-outline"
                onPress={() => router.push('/discover')}
              />
            }
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});
