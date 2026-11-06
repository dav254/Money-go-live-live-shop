import React, { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { RemoteImage } from '../../src/components/remote-image';
import { SellerHeader } from '../../src/components/seller/seller-header';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Heading,
  Loading,
  Muted,
  Notice,
  Screen,
  SectionHeader,
  StatTile,
} from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { commerce, messaging, seller } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { money, orderStatus, shortDate } from '../../src/lib/format';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * SELLER DASHBOARD — the shop's control room.
 *
 * Every number comes from the backend (VPS store first). Nothing here is
 * illustrative: a new seller with no orders sees zeros, an empty state and the
 * one action that changes it, instead of a mocked trend line that would be a
 * lie the moment they compared it to their bank account.
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
  const { profile, canSell, enableSelling } = useAuth();

  const overview = useAuthedResource((token) => seller.overview(token), []);
  const shop = useAuthedResource((token) => seller.shop(token), []);
  const orders = useAuthedResource((token) => commerce.sellerOrders(token), []);
  const threads = useAuthedResource((token) => messaging.threads(token), []);

  const recentOrders = useMemo(() => {
    const list = Array.isArray(orders.data) ? orders.data : [];
    return [...list]
      .sort((a, b) => String(b.orderDate ?? '').localeCompare(String(a.orderDate ?? '')))
      .slice(0, 3);
  }, [orders.data]);

  const shopRecord = shop.data?.shop ?? null;
  const unreadThreads = Array.isArray(threads.data?.chats) ? threads.data!.chats.length : 0;

  const checklist = useMemo(() => {
    const items = [
      {
        label: 'Add a shop logo',
        done: Boolean(shopRecord?.logoUrl),
        href: '/seller/settings',
      },
      {
        label: 'Add a cover photo',
        done: Boolean(shopRecord?.bannerUrl),
        href: '/seller/settings',
      },
      {
        label: 'Describe your business',
        done: (shopRecord?.description?.length ?? 0) >= 10,
        href: '/seller/settings',
      },
      {
        label: 'Set delivery or pickup',
        done: Boolean(shopRecord?.offersDelivery || shopRecord?.offersPickup),
        href: '/seller/settings',
      },
      {
        label: 'Publish your first listing',
        done: (overview.data?.listings.total ?? 0) > 0,
        href: '/seller/products/new',
      },
    ];
    return items;
  }, [overview.data?.listings.total, shopRecord]);

  const remaining = checklist.filter((item) => !item.done).length;

  if (!canSell) {
    return (
      <Screen>
        <SellerHeader title="Seller centre" subtitle="Not enabled yet" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.upgrade}>
            <View style={styles.upgradeIcon}>
              <Ionicons name="storefront-outline" size={26} color={colors.primary} />
            </View>
            <Heading>Turn this account into a shop</Heading>
            <Muted style={{ textAlign: 'center' }}>
              Your buyer account stays exactly as it is. Becoming a seller adds a
              shop, listings and orders to the same login.
            </Muted>
            <Button
              label="Set up my shop"
              icon="arrow-forward"
              onPress={async () => {
                try {
                  await enableSelling('both');
                  router.push('/onboarding/business');
                } catch {
                  router.push('/onboarding/role');
                }
              }}
            />
            <Button
              label="Back to shopping"
              variant="ghost"
              onPress={() => router.replace('/(tabs)')}
            />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  if (overview.loading && !overview.data) {
    return (
      <Screen>
        <SellerHeader title="Seller centre" subtitle={profile?.shopName || 'Your shop'} />
        <Loading label="Loading your dashboard…" />
      </Screen>
    );
  }

  if (overview.error) {
    return (
      <Screen>
        <SellerHeader title="Seller centre" subtitle={profile?.shopName || 'Your shop'} />
        <ErrorState message={overview.error} onRetry={overview.reload} />
      </Screen>
    );
  }

  const stats = overview.data;
  if (!stats) {
    return (
      <Screen>
        <SellerHeader title="Seller centre" subtitle={profile?.shopName || 'Your shop'} />
        <ErrorState message="No dashboard data yet." onRetry={overview.reload} />
      </Screen>
    );
  }

  const nextStep =
    stats.listings.total === 0
      ? { label: 'Add your first product', href: '/seller/products/new' }
      : stats.orders.needsAction > 0
        ? { label: `${stats.orders.needsAction} order needs you`, href: '/seller/orders' }
        : remaining > 0
          ? { label: 'Finish your shop profile', href: '/seller/settings' }
          : { label: 'See what is working', href: '/seller/analytics' };

  return (
    <Screen>
      <SellerHeader
        title={profile?.shopName || 'Your shop'}
        subtitle="Seller centre"
        right={
          <Pressable
            onPress={() => router.push('/(tabs)/alerts')}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            hitSlop={10}
            style={styles.bell}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={overview.loading || orders.loading || shop.loading}
            tintColor={colors.primary}
            colors={[colors.primary]}
            onRefresh={() => {
              overview.reload();
              orders.reload();
              shop.reload();
              threads.reload();
            }}
          />
        }
      >
        {/* Identity + revenue, both real. */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Avatar
              uri={shopRecord?.logoUrl || profile?.profilePictureUrl}
              name={profile?.shopName || profile?.fullName}
              size={52}
            />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.hello}>
                {profile?.fullName ? `Welcome, ${profile.fullName.split(' ')[0]}` : 'Welcome back'}
              </Text>
              <View style={styles.badges}>
                <Badge
                  label={shopRecord?.published ? 'Shop published' : 'Setup in progress'}
                  tone={shopRecord?.published ? 'success' : 'warning'}
                />
                <Badge label="Seller" tone="primary" />
              </View>
            </View>
          </View>

          <View style={styles.revenue}>
            <Text style={styles.revenueValue}>{money(stats.deliveredRevenue)}</Text>
            <Muted>Delivered sales — not a wallet balance</Muted>
          </View>

          <Pressable
            onPress={() => router.push(nextStep.href as never)}
            accessibilityRole="button"
            accessibilityLabel={nextStep.label}
            style={styles.nextStep}
          >
            <Ionicons name="arrow-forward-circle" size={18} color={colors.primary} />
            <Text style={styles.nextStepText}>{nextStep.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
          </Pressable>
        </View>

        {!shopRecord?.shopName ? (
          <Notice
            tone="warning"
            title="Finish setting up your shop"
            body="Your shop has no name, description or logo yet, so buyers cannot see it on Vidnov. Add those details and it becomes public."
          />
        ) : null}
        {!shopRecord?.shopName ? (
          <Button
            label="Set up my shop"
            icon="storefront-outline"
            onPress={() => router.push('/onboarding/business')}
          />
        ) : null}

        <View style={styles.grid}>
          <StatTile
            label="Orders"
            value={String(stats.orders.total)}
            hint={`${stats.orders.delivered} delivered`}
            onPress={() => router.push('/seller/orders')}
          />
          <StatTile
            label="Needs action"
            value={String(stats.orders.needsAction)}
            hint="Accept, pack or ship"
            tone={stats.orders.needsAction > 0 ? 'warning' : 'default'}
            onPress={() => router.push('/seller/orders')}
          />
          <StatTile
            label="Listings"
            value={String(stats.listings.total)}
            hint={
              stats.listings.outOfStock > 0
                ? `${stats.listings.outOfStock} out of stock`
                : 'All in stock'
            }
            onPress={() => router.push('/seller/products')}
          />
          <StatTile
            label="Buyer chats"
            value={String(unreadThreads)}
            hint="Open conversations"
            onPress={() => router.push('/seller/inquiries')}
          />
        </View>

        <SectionHeader title="Quick actions" />
        <View style={styles.actions}>
          <QuickAction
            icon="add-circle-outline"
            label="Add product"
            onPress={() => router.push('/seller/products/new?type=product')}
          />
          <QuickAction
            icon="construct-outline"
            label="Add service"
            onPress={() => router.push('/seller/products/new?type=service')}
          />
          <QuickAction
            icon="videocam-outline"
            label="Upload video"
            onPress={() => router.push('/seller/content')}
          />
          <QuickAction
            icon="radio-outline"
            label="Start live"
            onPress={() => router.push('/seller/live')}
          />
          <QuickAction
            icon="eye-outline"
            label="View shop"
            onPress={() => router.push('/seller/shop')}
          />
          <QuickAction
            icon="receipt-outline"
            label="Orders"
            onPress={() => router.push('/seller/orders')}
          />
        </View>

        {stats.listings.total === 0 ? (
          <EmptyState
            icon="cube-outline"
            title="Your shop is ready"
            body="Add your first product or service to get started. It appears in discovery the moment it is published."
            action={
              <Button
                label="Add your first listing"
                icon="add"
                onPress={() => router.push('/seller/products/new')}
              />
            }
          />
        ) : null}

        <SectionHeader
          title="Recent orders"
          action={
            <Pressable onPress={() => router.push('/seller/orders')} hitSlop={8}>
              <Text style={styles.link}>See all</Text>
            </Pressable>
          }
        />

        {orders.loading && !orders.data ? (
          <Loading label="Loading orders…" />
        ) : orders.error ? (
          <ErrorState message={orders.error} onRetry={orders.reload} />
        ) : recentOrders.length === 0 ? (
          <Muted>No orders yet. Share your shop link to get your first one.</Muted>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {recentOrders.map((order: any) => {
              const status = orderStatus(order.orderStatus ?? order.status);
              const item = order.items?.[0] ?? {};
              return (
                <Pressable
                  key={order.id}
                  onPress={() => router.push('/seller/orders')}
                  accessibilityRole="button"
                  accessibilityLabel={`Order ${order.id}`}
                  style={styles.orderRow}
                >
                  <RemoteImage
                    source={item.imageUrl}
                    style={styles.orderImage}
                    label={item.name ? `${item.name} photo` : 'Order item'}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={styles.orderName}>
                      {item.name || order.productName || 'Order'}
                    </Text>
                    <Muted>
                      #{String(order.id).slice(0, 6).toUpperCase()} ·{' '}
                      {shortDate(typeof order.orderDate === 'string' ? order.orderDate : null)}
                    </Muted>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <Text style={styles.orderTotal}>
                      {money(order.totalAmount ?? order.total, order.currency)}
                    </Text>
                    <Badge label={status.label} tone={status.tone} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <SectionHeader title="Shop completion" />
        <View style={styles.checklist}>
          {checklist.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => router.push(item.href as never)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={styles.checkRow}
            >
              <Ionicons
                name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
                size={19}
                color={item.done ? colors.success : colors.textFaint}
              />
              <Text style={[styles.checkLabel, item.done && styles.checkLabelDone]}>
                {item.label}
              </Text>
              {!item.done ? (
                <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
              ) : null}
            </Pressable>
          ))}
        </View>

        <Notice
          title="Live selling and video publishing"
          body="Those workspaces are in the seller centre, and they say plainly when the streaming backend has not been switched on yet."
        />

        <Button
          label="Open the full seller menu"
          variant="outline"
          icon="grid-outline"
          onPress={() => router.push('/seller/menu')}
        />
      </ScrollView>
    </Screen>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.quick, pressed && { opacity: 0.85 }]}
    >
      <Ionicons name={icon} size={19} color={colors.primary} />
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  bell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  hello: { color: colors.text, fontSize: 17, fontWeight: '800' },
  badges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  revenue: { gap: 2 },
  revenueValue: { color: colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -0.8 },
  nextStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  nextStepText: { color: colors.text, ...type.caption, fontWeight: '700', flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quick: {
    width: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  quickLabel: { color: colors.textMuted, fontSize: 11.5, fontWeight: '600', textAlign: 'center' },
  link: { color: colors.primary, ...type.caption, fontWeight: '700' },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  orderImage: { width: 44, height: 44 },
  orderName: { color: colors.text, ...type.bodyStrong },
  orderTotal: { color: colors.text, ...type.caption, fontWeight: '800' },
  checklist: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  checkLabel: { color: colors.text, ...type.body, flex: 1 },
  checkLabelDone: { color: colors.textFaint, textDecorationLine: 'line-through' },
  upgrade: { flex: 1, alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  upgradeIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
