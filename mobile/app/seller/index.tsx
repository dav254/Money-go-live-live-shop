import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
  Badge,
  Button,
  ErrorState,
  Heading,
  ListRow,
  Loading,
  Muted,
  Screen,
  SectionHeader,
} from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { seller } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { money } from '../../src/lib/format';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * SELLER DASHBOARD.
 *
 * One request (`/api/mobile/seller/overview`) answers what a seller opens the
 * app to learn: what needs action, how many orders are in flight, how many
 * listings are out of stock. The money figure is explicitly DELIVERED revenue,
 * not a spendable balance — Vidnov wallet and payouts are a different system and
 * this screen does not pretend to hold them.
 *
 * It is only reachable for seller-capable accounts; the server also scopes every
 * number to the verified uid, so the gate is defence in depth, not the only
 * control.
 */
export default function SellerDashboardScreen() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}

function Dashboard() {
  const router = useRouter();
  const { profile } = useAuth();
  const { data, loading, error, reload } = useAuthedResource((token) => seller.overview(token), []);

  const role = (profile?.userRole ?? 'buyer').toLowerCase();
  const canSell = ['seller', 'reseller', 'admin'].includes(role);

  if (!canSell) {
    return (
      <Screen>
        <View style={styles.upgrade}>
          <View style={styles.icon}>
            <Ionicons name="storefront-outline" size={26} color={colors.primary} />
          </View>
          <Heading>Selling isn&apos;t enabled on this account</Heading>
          <Muted style={{ textAlign: 'center' }}>
            This account is registered as a buyer. Seller tools need a seller account — contact
            support to switch, and your data stays exactly where it is.
          </Muted>
          <Button
            label="Back to shopping"
            variant="outline"
            onPress={() => router.push('/(tabs)/discover')}
          />
        </View>
      </Screen>
    );
  }

  if (loading && !data) return <Loading label="Loading your dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <ErrorState message="No dashboard data yet." onRetry={reload} />;

  const { orders, listings, deliveredRevenue } = data;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Muted>{profile?.shopName || 'Your shop'}</Muted>
          <Text style={styles.heroValue}>{money(deliveredRevenue)}</Text>
          <Muted>Delivered revenue (not a wallet balance)</Muted>
        </View>

        <View style={styles.grid}>
          <Stat
            label="Needs action"
            value={String(orders.needsAction)}
            tone={orders.needsAction > 0 ? 'warning' : 'neutral'}
            onPress={() => router.push('/seller/orders')}
          />
          <Stat
            label="Orders"
            value={String(orders.total)}
            onPress={() => router.push('/seller/orders')}
          />
          <Stat
            label="Listings"
            value={String(listings.total)}
            onPress={() => router.push('/seller/products')}
          />
          <Stat
            label="Out of stock"
            value={String(listings.outOfStock)}
            tone={listings.outOfStock > 0 ? 'danger' : 'neutral'}
            onPress={() => router.push('/seller/products')}
          />
        </View>

        <SectionHeader title="Manage" />
        <View style={styles.group}>
          <ListRow
            icon="receipt-outline"
            title="Orders"
            detail={
              orders.needsAction > 0
                ? `${orders.needsAction} waiting on you`
                : 'Nothing needs action right now'
            }
            onPress={() => router.push('/seller/orders')}
          />
          <ListRow
            icon="cube-outline"
            title="Your listings"
            detail={`${listings.total} published · ${listings.outOfStock} out of stock`}
            onPress={() => router.push('/seller/products')}
          />
          <ListRow
            icon="pricetag-outline"
            title="Offers you sent"
            onPress={() => router.push('/offers')}
          />
          <ListRow
            icon="chatbubbles-outline"
            title="Buyer messages"
            onPress={() => router.push('/(tabs)/messages')}
          />
        </View>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
          <Muted style={{ flex: 1 }}>
            Creating and editing listings, shop branding and wallet/invoices are handled in the
            seller studio on vidnov.com — those screens are not in this build yet, and this app
            will not pretend otherwise.
          </Muted>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
  onPress,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'warning' | 'danger';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [styles.stat, pressed && { opacity: 0.85 }]}
    >
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {tone !== 'neutral' ? (
        <Badge label={tone === 'danger' ? 'Attention' : 'Pending'} tone={tone === 'danger' ? 'danger' : 'warning'} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 2,
  },
  heroValue: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 3,
  },
  statValue: { color: colors.text, fontSize: 24, fontWeight: '800' },
  statLabel: { color: colors.textMuted, ...type.caption },
  group: { gap: spacing.xs },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  upgrade: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  icon: {
    width: 62,
    height: 62,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
