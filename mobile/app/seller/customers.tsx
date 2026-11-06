import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { SellerHeader } from '../../src/components/seller/seller-header';
import {
  Avatar,
  EmptyState,
  ErrorState,
  Loading,
  Muted,
  Screen,
} from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { commerce, messaging } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { money, shortDate } from '../../src/lib/format';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * CUSTOMERS — derived from real orders, not a separate CRM table.
 *
 * Vidnov stores who bought what on the order itself, so this screen groups the
 * seller's own orders by buyer. No buyer identity is invented: an order without
 * a buyer id is grouped by its delivery details, and one with neither is listed
 * as an anonymous order rather than a made-up name.
 */
export default function SellerCustomersScreen() {
  return (
    <RequireAuth>
      <Customers />
    </RequireAuth>
  );
}

function Customers() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { data, loading, error, reload } = useAuthedResource((token) => commerce.sellerOrders(token), []);

  const customers = useMemo(() => {
    const orders = (Array.isArray(data) ? data : []) as any[];
    interface CustomerRow {
      key: string;
      buyerId?: string;
      name: string;
      orders: number;
      total: number;
      currency?: string;
      last?: string;
      address?: string;
    }

    const map = new Map<string, CustomerRow>();

    for (const order of orders) {
      const buyerId = order.buyerId ? String(order.buyerId) : '';
      const address = order.shippingAddress ? String(order.shippingAddress) : '';
      const name =
        order.buyerName || order.customerName || (address ? address.split(',')[0] : '') || '';
      const key = buyerId || address || `order-${order.id}`;
      const existing: CustomerRow =
        map.get(key) ?? {
          key,
          buyerId: buyerId || undefined,
          name: name || 'Anonymous buyer',
          orders: 0,
          total: 0,
          currency: order.currency,
          address: address || undefined,
        };
      existing.orders += 1;
      existing.total += Number(order.totalAmount ?? order.total ?? 0) || 0;
      const date = typeof order.orderDate === 'string' ? order.orderDate : undefined;
      if (date && (!existing.last || date > existing.last)) existing.last = date;
      map.set(key, existing);
    }

    return Array.from(map.values()).sort((a, b) => (b.last ?? '').localeCompare(a.last ?? ''));
  }, [data]);

  const openChat = async (buyerId?: string) => {
    if (!buyerId) return;
    try {
      const token = await getToken();
      const result = await messaging.open(token, buyerId);
      const id = result.chatId || result.id || result.chat?.id;
      if (id) router.push(`/chat/${id}`);
    } catch {
      router.push('/(tabs)/messages');
    }
  };

  return (
    <Screen>
      <SellerHeader title="Customers" subtitle={`${customers.length} buyers`} showBack />
      {loading && !data ? (
        <Loading label="Loading your customers…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(customer) => customer.key}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={reload}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => void openChat(item.buyerId)}
              disabled={!item.buyerId}
              accessibilityRole={item.buyerId ? 'button' : undefined}
              accessibilityLabel={`Customer ${item.name}`}
              style={({ pressed }) => [styles.row, pressed && item.buyerId ? { opacity: 0.85 } : null]}
            >
              <Avatar name={item.name} size={44} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={styles.name}>
                  {item.name}
                </Text>
                <Muted numberOfLines={1}>
                  {item.orders} {item.orders === 1 ? 'order' : 'orders'}
                  {item.last ? ` · last ${shortDate(item.last)}` : ''}
                </Muted>
                {item.address ? (
                  <Muted numberOfLines={1}>{item.address}</Muted>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <Text style={styles.total}>{money(item.total, item.currency)}</Text>
                {item.buyerId ? (
                  <Ionicons name="chatbubble-outline" size={15} color={colors.primary} />
                ) : null}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No customers yet"
              body="People who order from your shop appear here with their real order history."
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
  name: { color: colors.text, ...type.bodyStrong },
  total: { color: colors.text, ...type.caption, fontWeight: '800' },
});
