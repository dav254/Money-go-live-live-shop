import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { RemoteImage } from '../../src/components/remote-image';
import { SellerHeader } from '../../src/components/seller/seller-header';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
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
 *
 * Product images come from the order's own line items — the same media
 * references the buyer's order shows, resolved through the shared image
 * component.
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
  const [filter, setFilter] = useState<'all' | 'action'>('all');

  const orders = (Array.isArray(data) ? data : []) as any[];
  const shown =
    filter === 'action'
      ? orders.filter((order) => nextSellerAction(order.orderStatus ?? order.status) !== null)
      : orders;

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

  return (
    <Screen>
      <SellerHeader title="Orders" subtitle={`${orders.length} total`} showBack />
      {loading && !data ? (
        <Loading label="Loading orders…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          {failure ? (
            <View style={styles.failure}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.failureText}>{failure}</Text>
            </View>
          ) : null}

          <View style={styles.filters}>
            <Button
              label={`All (${orders.length})`}
              variant={filter === 'all' ? 'primary' : 'outline'}
              onPress={() => setFilter('all')}
              style={{ flex: 1 }}
            />
            <Button
              label={`Needs action (${orders.filter((order) => nextSellerAction(order.orderStatus ?? order.status)).length})`}
              variant={filter === 'action' ? 'primary' : 'outline'}
              onPress={() => setFilter('action')}
              style={{ flex: 1 }}
            />
          </View>

          <FlatList
            data={shown}
            keyExtractor={(order) => String(order.id)}
            contentContainerStyle={styles.list}
            refreshing={loading}
            onRefresh={reload}
            renderItem={({ item }) => {
              const status = orderStatus(item.orderStatus ?? item.status);
              const next = nextSellerAction(item.orderStatus ?? item.status);
              const total = item.totalAmount ?? item.total;
              const items = Array.isArray(item.items) && item.items.length ? item.items : null;
              const buyer =
                item.buyerName || item.customerName || item.shippingAddress
                  ? String(item.buyerName ?? item.customerName ?? '')
                  : '';

              return (
                <View style={styles.card}>
                  <View style={styles.header}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.id}>
                        #{String(item.orderNumber ?? item.id).slice(0, 10).toUpperCase()}
                      </Text>
                      <Muted>{shortDate(typeof item.orderDate === 'string' ? item.orderDate : null)}</Muted>
                    </View>
                    <Badge label={status.label} tone={status.tone} />
                  </View>

                  {items ? (
                    <View style={{ gap: spacing.sm }}>
                      {items.slice(0, 4).map((line: any, index: number) => (
                        <View key={`${line.name}-${index}`} style={styles.line}>
                          <RemoteImage
                            source={line.imageUrl}
                            style={styles.lineImage}
                            label={line.name ? `${line.name} photo` : 'Product photo'}
                          />
                          <View style={{ flex: 1, gap: 1 }}>
                            <Text numberOfLines={2} style={styles.lineName}>
                              {line.name || line.productName || 'Item'}
                            </Text>
                            <Muted>
                              {line.quantity ? `×${line.quantity}` : ''}
                              {line.price != null ? ` · ${money(line.price, item.currency)}` : ''}
                            </Muted>
                          </View>
                        </View>
                      ))}
                      {items.length > 4 ? <Muted>+{items.length - 4} more items</Muted> : null}
                    </View>
                  ) : (
                    <Text style={styles.lineName}>
                      {item.productName || 'Order'}
                      {item.quantity && item.quantity > 1 ? `  ×${item.quantity}` : ''}
                    </Text>
                  )}

                  <View style={styles.totalRow}>
                    <Muted>Order total</Muted>
                    <Text style={styles.total}>{money(total, item.currency)}</Text>
                  </View>

                  <View style={styles.details}>
                    {buyer ? <Detail icon="person-outline" text={buyer} /> : null}
                    {item.shippingAddress ? (
                      <Detail icon="location-outline" text={String(item.shippingAddress)} />
                    ) : null}
                    {item.paymentStatus || item.paymentMethod ? (
                      <Detail
                        icon="card-outline"
                        text={`${item.paymentStatus ?? 'Payment'}${item.paymentMethod ? ` · ${item.paymentMethod}` : ''}`}
                      />
                    ) : null}
                  </View>

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
                title={filter === 'action' ? 'Nothing needs action' : 'No orders yet'}
                body={
                  filter === 'action'
                    ? 'Every order is up to date. New ones appear here the moment a buyer checks out.'
                    : 'Orders from buyers show up here the moment they are placed.'
                }
              />
            }
          />
        </>
      )}
    </Screen>
  );
}

function Detail({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.detail}>
      <Ionicons name={icon} size={13} color={colors.textFaint} />
      <Text style={styles.detailText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  id: { color: colors.text, ...type.bodyStrong, letterSpacing: 0.3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lineImage: { width: 44, height: 44 },
  lineName: { color: colors.text, ...type.bodyStrong },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { color: colors.text, fontSize: 16, fontWeight: '800' },
  details: { gap: 3 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailText: { color: colors.textMuted, ...type.caption, flex: 1 },
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
