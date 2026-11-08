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
} from '../src/components/ui';
import { commerce } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { useAuthedResource } from '../src/lib/use-authed';
import { shortDate } from '../src/lib/format';
import { colors, radius, spacing, type } from '../src/theme';

/**
 * MY ADDRESSES.
 *
 * The backend has one source of truth for a delivery address: the address on
 * the ORDER it was used for. There is no separate address book collection, and
 * inventing one here would create a second place addresses live — exactly the
 * duplication the marketplace rules forbid.
 *
 * So this screen shows the addresses that are actually on the buyer's orders,
 * newest first, deduplicated, each with the order it came from. It also shows
 * the contact number the courier will use, which IS editable (it writes to the
 * same profile document the website edits).
 */
type BuyerOrder = {
  id: string;
  status?: string;
  shippingAddress?: string;
  placedAt?: string | null;
};

type SavedAddress = {
  address: string;
  orders: number;
  lastUsed?: string | null;
  latestOrderId: string;
};

export default function AddressesScreen() {
  return (
    <RequireAuth>
      <Addresses />
    </RequireAuth>
  );
}

function Addresses() {
  const router = useRouter();
  const { profile } = useAuth();
  const { data, loading, error, reload } = useAuthedResource(
    (token) => commerce.buyerOrders(token),
    [],
  );

  const addresses = useMemo(() => {
    const orders = (data?.orders ?? []) as BuyerOrder[];
    const seen = new Map<string, SavedAddress>();
    // The API returns newest first, so the first time an address is seen is the
    // most recent use of it.
    for (const order of orders) {
      const address = String(order.shippingAddress ?? '').trim();
      if (!address) continue;
      const existing = seen.get(address);
      if (existing) {
        existing.orders += 1;
        continue;
      }
      seen.set(address, {
        address,
        orders: 1,
        lastUsed: order.placedAt ?? null,
        latestOrderId: order.id,
      });
    }
    return Array.from(seen.values());
  }, [data]);

  if (loading && !data) return <Loading label="Loading your addresses…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: spacing.xs }}>
          <Heading>Where your orders go</Heading>
          <Muted>
            Every address you have used on a Vidnov order, with the most recent at the top.
          </Muted>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="call-outline" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Contact number for deliveries</Text>
              <Muted>{profile?.phoneNumber || 'No number on your profile yet'}</Muted>
            </View>
          </View>
          <Button
            label={profile?.phoneNumber ? 'Change number' : 'Add a number'}
            variant="outline"
            icon="create-outline"
            onPress={() => router.push('/profile/edit')}
          />
        </View>

        <SectionHeader title={`Delivery addresses (${addresses.length})`} />

        {addresses.length === 0 ? (
          <EmptyState
            icon="map-outline"
            title="No delivery address yet"
            body="Your first order's delivery address appears here. Addresses are captured per order, so a new one is entered when you check out."
            action={
              <Button
                label="Browse the marketplace"
                icon="storefront-outline"
                onPress={() => router.push('/discover')}
              />
            }
          />
        ) : (
          <View style={styles.group}>
            {addresses.map((entry) => (
              <ListRow
                key={entry.address}
                icon="location-outline"
                title={entry.address}
                detail={`${entry.orders} order${entry.orders === 1 ? '' : 's'}${
                  entry.lastUsed ? ` · last used ${shortDate(entry.lastUsed)}` : ''
                }`}
                onPress={() => router.push('/orders')}
              />
            ))}
          </View>
        )}

        <Notice
          title="Addresses are per order"
          body="Vidnov stores the delivery address on the order it was used for. Editing an address here would change history, so a different address is entered at checkout instead."
        />

        <Button
          label="Contact support about an address"
          variant="outline"
          icon="mail-outline"
          onPress={() => router.push('/help')}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardHead: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  cardTitle: { ...type.bodyStrong, color: colors.text },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});
