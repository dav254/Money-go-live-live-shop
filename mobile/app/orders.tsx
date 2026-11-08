import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Heading,
  Loading,
  Muted,
  Screen,
} from '../src/components/ui';
import { RemoteImage } from '../src/components/remote-image';
import { RequireAuth } from '../src/components/require-auth';
import { commerce } from '../src/lib/api';
import { money, orderStatus, shortDate } from '../src/lib/format';
import { useAuthedResource } from '../src/lib/use-authed';
import { colors, radius, spacing, type } from '../src/theme';
import type { MobileOrder } from '../src/lib/types';

/**
 * MY ORDERS — the buyer's purchases, inside the app.
 *
 * Same documents the website's order history shows (`/api/mobile/orders`), with
 * the status vocabulary translated once in `format.ts` so a buyer reads
 * "On the way" rather than the stored `shipped`. Tracking, the delivery address
 * snapshot and the line items are all shown because this is the buyer's own
 * order — nothing about the seller's internals is.
 */
export default function OrdersScreen() {
  return (
    <RequireAuth>
      <OrderList />
    </RequireAuth>
  );
}

function OrderList() {
  const router = useRouter();
  const { data, loading, error, reload } = useAuthedResource((token) => commerce.buyerOrders(token), []);
  const orders = (data?.orders ?? []) as MobileOrder[];

  if (loading && !data) {
    return (
      <Screen>
        <Loading label="Loading your orders…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={orders}
        keyExtractor={(order) => order.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onOpenSeller={(id) => router.push(`/shop/${id}`)}
            onReview={() => router.push(`/review/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title="No orders yet"
            body="When you buy something on Vidnov it appears here with its delivery status."
            action={
              <Button
                label="Start shopping"
                variant="outline"
                onPress={() => router.push('/(tabs)/discover')}
              />
            }
          />
        }
      />
    </Screen>
  );
}

function OrderCard({
  order,
  onOpenSeller,
  onReview,
}: {
  order: MobileOrder;
  onOpenSeller: (id: string) => void;
  onReview: () => void;
}) {
  const status = orderStatus(order.status);
  const firstLine = order.items[0];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <Heading style={styles.orderId}>Order {order.id.slice(0, 8).toUpperCase()}</Heading>
          <Muted>{shortDate(order.placedAt) || 'Date unavailable'}</Muted>
        </View>
        <Badge label={status.label} tone={status.tone} />
      </View>

      {firstLine ? (
        <View style={styles.line}>
          <View style={styles.thumb}>
            {/* Same resolver as every other surface: the order's line item
                stores the media reference, not an absolute URL. */}
            <RemoteImage
              source={firstLine.imageUrl}
              style={styles.thumbImage}
              radius={8}
              label={firstLine.name ? `${firstLine.name} photo` : 'Order item photo'}
            />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text numberOfLines={2} style={styles.lineName}>
              {firstLine.name}
            </Text>
            <Muted>
              {firstLine.quantity && firstLine.quantity > 1 ? `${firstLine.quantity} × ` : ''}
              {money(firstLine.price, order.currency)}
            </Muted>
            {order.items.length > 1 ? (
              <Muted>+{order.items.length - 1} more {order.items.length - 1 === 1 ? 'item' : 'items'}</Muted>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.totalRow}>
        <Muted>Total</Muted>
        <Text style={styles.total}>{money(order.total, order.currency)}</Text>
      </View>

      {order.trackingNumber ? (
        <View style={styles.metaRow}>
          <Ionicons name="navigate-outline" size={13} color={colors.textFaint} />
          <Text style={styles.metaText}>Tracking {order.trackingNumber}</Text>
        </View>
      ) : null}

      {order.shippingAddress ? (
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={colors.textFaint} />
          <Text numberOfLines={2} style={styles.metaText}>
            {order.shippingAddress}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {/* `canReview` comes from the server: it already knows whether this
            order is finished and whether this buyer has reviewed it. */}
        {order.canReview ? (
          <Pressable onPress={onReview} accessibilityRole="button" style={styles.actionLink}>
            <Ionicons name="star-outline" size={15} color={colors.primary} />
            <Text style={styles.actionText}>Rate this order</Text>
          </Pressable>
        ) : null}
        {order.sellerId ? (
          <Pressable
            onPress={() => onOpenSeller(order.sellerId as string)}
            accessibilityRole="button"
            style={styles.actionLink}
          >
            <Ionicons name="storefront-outline" size={15} color={colors.primary} />
            <Text style={styles.actionText}>Seller</Text>
          </Pressable>
        ) : null}
        {order.sellerId ? (
          <Pressable
            onPress={() => undefined}
            accessibilityRole="button"
            style={styles.actionLink}
            disabled
          >
            <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.textFaint} />
            <Text style={[styles.actionText, { color: colors.textFaint }]}>Message from Messages tab</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  orderId: { fontSize: 15, letterSpacing: 0.4 },
  line: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumbImage: { width: '100%', height: '100%', borderRadius: 8 },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineName: { color: colors.text, ...type.bodyStrong },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { color: colors.text, fontSize: 17, fontWeight: '800' },
  metaRow: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  metaText: { color: colors.textFaint, ...type.caption, flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  actionLink: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32 },
  actionText: { color: colors.primary, ...type.caption, fontWeight: '700' },
});
