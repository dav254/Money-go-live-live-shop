import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { SellerHeader } from '../../src/components/seller/seller-header';
import { Badge, EmptyState, ErrorState, Loading, Muted, Screen } from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { commerce, seller } from '../../src/lib/api';
import { money, orderStatus, shortDate, titleCase } from '../../src/lib/format';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../src/theme';

type Entry = {
  id: string;
  kind: 'order' | 'payout';
  label: string;
  detail: string;
  amount: number;
  currency?: string;
  status: string;
  date?: string;
};

/**
 * TRANSACTIONS — one chronological ledger of what actually moved.
 *
 * Two real sources: the seller's orders (money owed for goods) and their payout
 * records (money taken out). Nothing is merged into a fabricated running
 * balance; each row keeps its own status so an order that is merely delivered
 * cannot be mistaken for cash already in the bank.
 */
export default function SellerTransactionsScreen() {
  return (
    <RequireAuth>
      <Transactions />
    </RequireAuth>
  );
}

function Transactions() {
  const orders = useAuthedResource((token) => commerce.sellerOrders(token), []);
  const wallet = useAuthedResource((token) => seller.wallet(token), []);

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];
    for (const order of (Array.isArray(orders.data) ? orders.data : []) as any[]) {
      list.push({
        id: `order-${order.id}`,
        kind: 'order',
        label: `Order #${String(order.orderNumber ?? order.id).slice(0, 8).toUpperCase()}`,
        detail: order.productName || order.items?.[0]?.name || 'Marketplace order',
        amount: Number(order.totalAmount ?? order.total ?? 0) || 0,
        currency: order.currency,
        status: order.orderStatus ?? order.status ?? 'pending',
        date: typeof order.orderDate === 'string' ? order.orderDate : undefined,
      });
    }
    for (const payout of wallet.data?.payouts ?? []) {
      list.push({
        id: `payout-${payout.id}`,
        kind: 'payout',
        label: 'Payout',
        detail: payout.method || 'Withdrawal',
        amount: payout.amount,
        currency: payout.currency,
        status: payout.status,
        date: payout.createdAt ?? undefined,
      });
    }
    return list.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  }, [orders.data, wallet.data?.payouts]);

  const loading = (orders.loading && !orders.data) || (wallet.loading && !wallet.data);
  const error = orders.error || wallet.error;

  return (
    <Screen>
      <SellerHeader title="Transactions" subtitle="Orders and payouts" showBack />
      {loading ? (
        <Loading label="Loading transactions…" />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            orders.reload();
            wallet.reload();
          }}
        />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(entry) => entry.id}
          contentContainerStyle={styles.list}
          refreshing={orders.loading || wallet.loading}
          onRefresh={() => {
            orders.reload();
            wallet.reload();
          }}
          renderItem={({ item }) => {
            const status = orderStatus(item.status);
            const isPayout = item.kind === 'payout';
            return (
              <View style={styles.row}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.title}>{item.label}</Text>
                  <Muted numberOfLines={1}>{item.detail}</Muted>
                  <Muted>{shortDate(item.date)}</Muted>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                  <Text style={[styles.amount, isPayout && { color: colors.warning }]}>
                    {isPayout ? '−' : ''}
                    {money(item.amount, item.currency)}
                  </Text>
                  <Badge
                    label={isPayout ? titleCase(item.status) : status.label}
                    tone={isPayout ? 'warning' : status.tone}
                  />
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="swap-horizontal-outline"
              title="No transactions yet"
              body="Orders and payouts appear here as they happen. Nothing is listed until the backend records it."
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl * 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  title: { color: colors.text, ...type.bodyStrong },
  amount: { color: colors.text, ...type.bodyStrong, fontWeight: '800' },
});
