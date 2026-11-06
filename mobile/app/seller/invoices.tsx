import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { SellerHeader } from '../../src/components/seller/seller-header';
import {
  Badge,
  EmptyState,
  ErrorState,
  Loading,
  Muted,
  Notice,
  Screen,
} from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { commerce } from '../../src/lib/api';
import { money, orderStatus, shortDate } from '../../src/lib/format';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * INVOICES & RECEIPTS — receipts built from the seller's real orders.
 *
 * Vidnov has no separate invoice document in this backend: an order IS the
 * record of what was sold, to whom and for how much. This screen presents that
 * record as a receipt (order number, date, lines, total, status) instead of
 * generating an invoice number the system would not be able to reconcile.
 */
export default function SellerInvoicesScreen() {
  return (
    <RequireAuth>
      <Invoices />
    </RequireAuth>
  );
}

function Invoices() {
  const { data, loading, error, reload } = useAuthedResource((token) => commerce.sellerOrders(token), []);
  const orders = (Array.isArray(data) ? data : []) as any[];

  return (
    <Screen>
      <SellerHeader title="Invoices & receipts" subtitle={`${orders.length} order records`} showBack />
      {loading && !data ? (
        <Loading label="Loading receipts…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(order) => String(order.id)}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={reload}
          ListHeaderComponent={
            <Notice
              title="Receipts come from your orders"
              body="Each order below is the authoritative record of a sale. Vidnov does not issue a separate invoice document, so no invoice number is invented here."
            />
          }
          renderItem={({ item }) => {
            const status = orderStatus(item.orderStatus ?? item.status);
            const items = Array.isArray(item.items) ? item.items : [];
            return (
              <View style={styles.card}>
                <View style={styles.head}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.number}>
                      #{String(item.orderNumber ?? item.id).slice(0, 10).toUpperCase()}
                    </Text>
                    <Muted>{shortDate(typeof item.orderDate === 'string' ? item.orderDate : null)}</Muted>
                  </View>
                  <Badge label={status.label} tone={status.tone} />
                </View>

                {items.length ? (
                  <View style={{ gap: 4 }}>
                    {items.map((line: any, index: number) => (
                      <View key={`${line.name}-${index}`} style={styles.line}>
                        <Text numberOfLines={1} style={styles.lineName}>
                          {line.quantity ? `${line.quantity}× ` : ''}
                          {line.name || line.productName || 'Item'}
                        </Text>
                        {line.price != null ? (
                          <Text style={styles.linePrice}>{money(line.price, item.currency)}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.lineName}>{item.productName || 'Marketplace order'}</Text>
                )}

                <View style={styles.totalRow}>
                  <Muted>Total</Muted>
                  <Text style={styles.total}>{money(item.totalAmount ?? item.total, item.currency)}</Text>
                </View>

                {item.shippingAddress ? (
                  <Muted numberOfLines={2}>{String(item.shippingAddress)}</Muted>
                ) : null}
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="document-text-outline"
              title="No receipts yet"
              body="Once you receive an order, its receipt appears here with the real order number and amount."
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  number: { color: colors.text, ...type.bodyStrong, letterSpacing: 0.3 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  lineName: { color: colors.textMuted, ...type.body, flex: 1 },
  linePrice: { color: colors.textMuted, ...type.body },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  total: { color: colors.text, fontSize: 16, fontWeight: '800' },
});
