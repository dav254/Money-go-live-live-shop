import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Heading,
  Loading,
  Muted,
  Screen,
} from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { commerce, messageFor } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { money, nextSellerAction, orderStatus, shortDate } from '../../src/lib/format';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * SELLER ORDERS.
 *
 * The screen a seller actually works from, so it does the one thing it must:
 * move an order to its next legitimate state, and say so honestly when the move
 * fails. The button offered is derived from the same transition table the server
 * enforces (`pending → processing → shipped → delivery → delivered`), so the app
 * cannot show a step that will 400.
 */
export default function SellerOrdersScreen() {
  return (
    <RequireAuth>
      <Orders />
    </RequireAuth>
  );
}

function Orders() {
  const { getToken } = useAuth();
  const { data, loading, error, reload } = useAuthedResource((token) => commerce.sellerOrders(token), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const orders = (Array.isArray(data) ? data : []) as any[];

  const advance = async (orderId: string, status: string) => {
    setBusyId(orderId);
    setFailure(null);
    try {
      const token = await getToken();
      await commerce.setOrderStatus(token, orderId, status);
      reload();
    } catch (thrown) {
      setFailure(messageFor(thrown));
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !data) return <Loading label="Loading orders…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <Screen>
      {failure ? (
        <View style={styles.failure}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
          <Text style={styles.failureText}>{failure}</Text>
        </View>
      ) : null}

      <FlatList
        data={orders}
        keyExtractor={(order) => String(order.id)}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) => {
          const status = orderStatus(item.orderStatus ?? item.status);
          const next = nextSellerAction(item.orderStatus ?? item.status);
          const total = item.totalAmount ?? item.total;
          const line = item.productName ?? item.items?.[0]?.name;

          return (
            <View style={styles.card}>
              <View style={styles.header}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Heading style={styles.id}>#{String(item.id).slice(0, 8).toUpperCase()}</Heading>
                  <Muted>{shortDate(typeof item.orderDate === 'string' ? item.orderDate : null)}</Muted>
                </View>
                <Badge label={status.label} tone={status.tone} />
              </View>

              {line ? (
                <Text numberOfLines={2} style={styles.line}>
                  {line}
                  {item.quantity && item.quantity > 1 ? `  ×${item.quantity}` : ''}
                </Text>
              ) : null}

              <View style={styles.totalRow}>
                <Muted>Buyer paid</Muted>
                <Text style={styles.total}>{money(total, item.currency)}</Text>
              </View>

              {item.shippingAddress ? (
                <Muted numberOfLines={2}>{String(item.shippingAddress)}</Muted>
              ) : null}

              {next ? (
                <Button
                  label={next.label}
                  onPress={() => advance(String(item.id), next.status)}
                  loading={busyId === String(item.id)}
                  disabled={busyId !== null && busyId !== String(item.id)}
                />
              ) : (
                <Muted>
                  {status.label === 'Delivered'
                    ? 'Completed. Nothing left to do.'
                    : 'No seller action is available for this order.'}
                </Muted>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title="No orders yet"
            body="Orders from buyers show up here the moment they are placed."
          />
        }
      />
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
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  id: { fontSize: 15, letterSpacing: 0.4 },
  line: { color: colors.text, ...type.bodyStrong },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { color: colors.text, fontSize: 16, fontWeight: '800' },
  failure: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    margin: spacing.lg,
    marginBottom: 0,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(240, 68, 56, 0.12)',
  },
  failureText: { color: colors.danger, ...type.caption, flex: 1 },
});
