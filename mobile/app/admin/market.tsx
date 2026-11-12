/**
 * ADMIN · MARKET
 *
 * Listings, orders, buyer requests and live sessions. Product moderation and
 * order status are real writes through the existing guarded admin APIs.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { Badge, Card, Muted, Screen, StatTile } from '../../src/components/ui';
import { AdminGate, ErrorCard, Loading } from '../../src/components/admin/kit';
import {
  AdminPageTitle,
  AdminSearch,
  AdminSectionNav,
  money,
  shortDate,
  statusTone,
} from '../../src/components/admin/ops-ui';
import { colors, radius, spacing, type } from '../../src/theme';
import {
  adminOps,
  type AdminOpsLive,
  type AdminOpsMarketResponse,
  type AdminOpsOrder,
  type AdminOpsProduct,
  type AdminOpsRequest,
} from '../../src/lib/api';

type Tab = 'products' | 'orders' | 'requests' | 'live';

const TABS: Array<{ key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'products', label: 'Listings', icon: 'pricetags-outline' },
  { key: 'orders', label: 'Orders', icon: 'receipt-outline' },
  { key: 'requests', label: 'Requests', icon: 'document-text-outline' },
  { key: 'live', label: 'Live', icon: 'radio-outline' },
];

export default function AdminMarketScreen() {
  return <AdminGate>{(token) => <MarketBody token={token} />}</AdminGate>;
}

function MarketBody({ token }: { token: string }) {
  const [data, setData] = useState<AdminOpsMarketResponse | null>(null);
  const [tab, setTab] = useState<Tab>('products');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        const result = await adminOps.market(token);
        setData(result);
        setNotice(result.notices.length ? result.notices.join(' ') : null);
        setError(null);
      } catch (err) {
        setError((err as Error)?.message || 'The marketplace could not be loaded.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const needle = query.trim().toLowerCase();
  const products = useMemo(
    () =>
      (data?.products ?? []).filter((product) =>
        !needle
          ? true
          : [product.name, product.sellerName, product.category, product.id]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(needle)),
      ),
    [data, needle],
  );
  const orders = useMemo(
    () =>
      (data?.orders ?? []).filter((order) =>
        !needle
          ? true
          : [order.id, order.productName, order.buyerName, order.sellerName, order.status]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(needle)),
      ),
    [data, needle],
  );
  const requests = useMemo(
    () =>
      (data?.requests ?? []).filter((request) =>
        !needle
          ? true
          : [request.title, request.category, request.customerName, request.location]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(needle)),
      ),
    [data, needle],
  );
  const live = useMemo(
    () =>
      (data?.live ?? []).filter((session) =>
        !needle
          ? true
          : [session.title, session.sellerName].filter(Boolean).some((value) =>
              String(value).toLowerCase().includes(needle),
            ),
      ),
    [data, needle],
  );

  const patchProduct = useCallback(
    async (product: AdminOpsProduct, patch: { featured?: boolean; unpublished?: boolean }) => {
      setBusyId(product.id);
      setError(null);
      try {
        await adminOps.setProductFlags(token, product.id, patch);
        setData((prev) =>
          prev
            ? {
                ...prev,
                products: prev.products.map((row) => (row.id === product.id ? { ...row, ...patch } : row)),
              }
            : prev,
        );
        setNotice(
          typeof patch.unpublished === 'boolean'
            ? `${product.name} is ${patch.unpublished ? 'unpublished' : 'published'}.`
            : `${product.name} is ${patch.featured ? 'featured' : 'no longer featured'}.`,
        );
      } catch (err) {
        setError((err as Error)?.message || 'The listing could not be updated.');
      } finally {
        setBusyId(null);
      }
    },
    [token],
  );

  const manageProduct = useCallback(
    (product: AdminOpsProduct) => {
      const featured = !product.featured;
      const unpublished = !product.unpublished;
      Alert.alert(
        product.name,
        `Seller: ${product.sellerName || product.sellerId}\nPrice: ${money(product.price)}\nStock: ${product.stock}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: product.featured ? 'Unfeature' : 'Feature',
            onPress: () => void patchProduct(product, { featured }),
          },
          {
            text: product.unpublished ? 'Publish' : 'Unpublish',
            style: product.unpublished ? 'default' : 'destructive',
            onPress: () => void patchProduct(product, { unpublished }),
          },
        ],
      );
    },
    [patchProduct],
  );

  const setOrderStatus = useCallback(
    async (order: AdminOpsOrder, status: string) => {
      setBusyId(order.id);
      setError(null);
      try {
        await adminOps.setOrderStatus(token, order.id, status);
        setData((prev) =>
          prev
            ? {
                ...prev,
                orders: prev.orders.map((row) => (row.id === order.id ? { ...row, status } : row)),
              }
            : prev,
        );
        setNotice(`Order ${order.id.slice(0, 8)} is now ${status}.`);
      } catch (err) {
        setError((err as Error)?.message || 'The order status could not be changed.');
      } finally {
        setBusyId(null);
      }
    },
    [token],
  );

  const confirmOrderStatus = useCallback(
    (order: AdminOpsOrder, status: string) => {
      const destructive = status === 'cancelled';
      Alert.alert(
        `Move this order to ${status}?`,
        `${order.productName}\n${money(order.totalAmount)}\n\nThe backend records the new status and its timeline.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: status.toUpperCase(),
            style: destructive ? 'destructive' : 'default',
            onPress: () => void setOrderStatus(order, status),
          },
        ],
      );
    },
    [setOrderStatus],
  );

  if (loading && !data) {
    return (
      <Screen>
        <Loading label="Reading the marketplace…" />
      </Screen>
    );
  }

  const counts = data?.counts;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load('refresh')}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <AdminSectionNav active="market" />
        <AdminPageTitle
          eyebrow="Operations"
          title="Market"
          detail="Catalogue, orders, demand and live sessions. Listings and order status write through the guarded admin APIs."
        />

        <View style={styles.stats}>
          <StatTile label="Listings" value={String(counts?.products ?? 0)} hint={`${counts?.unpublished ?? 0} unpublished`} />
          <StatTile label="Orders" value={String(counts?.total ?? 0)} hint={`${counts?.open ?? 0} open`} />
          <StatTile label="Requests" value={String(counts?.requests ?? 0)} hint="Buyer briefs" />
          <StatTile label="Live now" value={String(counts?.live ?? 0)} tone={(counts?.live ?? 0) > 0 ? 'danger' : 'default'} hint="Active streams" />
        </View>

        {notice ? (
          <Card style={styles.notice}>
            <Muted>{notice}</Muted>
          </Card>
        ) : null}
        {error ? <ErrorCard message={error} onRetry={() => void load()} /> : null}

        <AdminSearch value={query} onChange={setQuery} placeholder="Search the current section" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {TABS.map((item) => {
            const selected = tab === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  setTab(item.key);
                  setExpanded(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.chip, selected && styles.chipActive]}
              >
                <Ionicons name={item.icon} size={14} color={selected ? colors.primary : colors.textMuted} />
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {tab === 'products' ? (
          <>
            <SectionHead label="LISTINGS" count={products.length} />
            {products.length === 0 ? (
              <Empty icon="pricetags-outline" text="No listings match this search." />
            ) : (
              products.map((product) => {
                const open = expanded === product.id;
                const busy = busyId === product.id;
                return (
                  <Card key={product.id} style={{ gap: spacing.sm }}>
                    <Pressable
                      onPress={() => setExpanded(open ? null : product.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Inspect ${product.name}`}
                      style={styles.rowHead}
                    >
                      <View style={styles.rowIcon}>
                        <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{product.name}</Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          {product.sellerName || product.sellerId} · {money(product.price)}
                        </Text>
                        <View style={styles.badges}>
                          <Badge label={product.listingType.toUpperCase()} />
                          {product.featured ? <Badge label="FEATURED" tone="primary" /> : null}
                          {product.unpublished ? <Badge label="UNPUBLISHED" tone="danger" /> : null}
                          {product.stock <= 0 ? <Badge label="OUT OF STOCK" tone="warning" /> : null}
                        </View>
                      </View>
                      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textFaint} />
                    </Pressable>
                    {open ? (
                      <View style={styles.details}>
                        <Detail label="Category" value={product.category || 'uncategorised'} />
                        <Detail label="Stock" value={String(product.stock)} />
                        <Detail label="Listed" value={shortDate(product.uploadDate)} />
                        <View style={styles.actions}>
                          <SmallAction
                            icon={product.featured ? 'star-outline' : 'star'}
                            label={product.featured ? 'UNFEATURE' : 'FEATURE'}
                            color={colors.primary}
                            disabled={busy}
                            onPress={() => void patchProduct(product, { featured: !product.featured })}
                          />
                          <SmallAction
                            icon={product.unpublished ? 'eye-outline' : 'eye-off-outline'}
                            label={product.unpublished ? 'PUBLISH' : 'UNPUBLISH'}
                            color={product.unpublished ? colors.success : colors.danger}
                            disabled={busy}
                            onPress={() => void patchProduct(product, { unpublished: !product.unpublished })}
                          />
                        </View>
                      </View>
                    ) : null}
                  </Card>
                );
              })
            )}
          </>
        ) : null}

        {tab === 'orders' ? (
          <>
            <SectionHead label="ORDERS" count={orders.length} />
            {orders.length === 0 ? (
              <Empty icon="receipt-outline" text="No orders match this search." />
            ) : (
              orders.map((order) => {
                const open = expanded === order.id;
                const busy = busyId === order.id;
                return (
                  <Card key={order.id} style={{ gap: spacing.sm }}>
                    <Pressable
                      onPress={() => setExpanded(open ? null : order.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Inspect order ${order.id}`}
                      style={styles.rowHead}
                    >
                      <View style={styles.rowIcon}>
                        <Ionicons name="receipt-outline" size={18} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{order.productName}</Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          {order.buyerName || order.buyerId} → {order.sellerName || order.sellerId}
                        </Text>
                        <View style={styles.badges}>
                          <Badge label={order.status.toUpperCase()} tone={statusTone(order.status)} />
                          <Badge label={money(order.totalAmount)} />
                        </View>
                      </View>
                      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textFaint} />
                    </Pressable>
                    {open ? (
                      <View style={styles.details}>
                        <Detail label="Order ID" value={order.id} mono />
                        <Detail label="Placed" value={shortDate(order.orderDate)} />
                        <Detail label="Payment" value={order.paymentMethod || 'not recorded'} />
                        <Text style={styles.actionLabel}>MOVE STATUS</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                          {['processing', 'shipped', 'delivered', 'cancelled', 'disputed'].map((status) => (
                            <Pressable
                              key={status}
                              disabled={busy || status === order.status}
                              onPress={() => confirmOrderStatus(order, status)}
                              accessibilityRole="button"
                              accessibilityLabel={`Set order to ${status}`}
                              style={[
                                styles.statusChip,
                                status === order.status && styles.statusChipActive,
                                busy && { opacity: 0.5 },
                              ]}
                            >
                              <Text style={[styles.statusChipText, status === order.status && { color: colors.primary }]}>
                                {status.toUpperCase()}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    ) : null}
                  </Card>
                );
              })
            )}
          </>
        ) : null}

        {tab === 'requests' ? (
          <>
            <SectionHead label="BUYER REQUESTS" count={requests.length} />
            {requests.length === 0 ? (
              <Empty icon="document-text-outline" text="No buyer requests match this search." />
            ) : (
              requests.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))
            )}
          </>
        ) : null}

        {tab === 'live' ? (
          <>
            <SectionHead label="LIVE NOW" count={live.length} />
            {live.length === 0 ? (
              <Empty icon="radio-outline" text="No live sessions are active." />
            ) : (
              live.map((session) => <LiveCard key={session.id} session={session} />)
            )}
          </>
        ) : null}

        {data && !data.available.orders ? (
          <Card style={styles.notice}>
            <Muted>Orders could not be read right now; the rest of the marketplace is still shown.</Muted>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function RequestCard({ request }: { request: AdminOpsRequest }) {
  const budget =
    request.budgetMin !== null || request.budgetMax !== null
      ? `${request.currency} ${request.budgetMin ?? 0}–${request.budgetMax ?? 'open'}`
      : 'Budget not stated';
  return (
    <Card style={{ gap: 5 }}>
      <View style={styles.rowHead}>
        <View style={styles.rowIcon}>
          <Ionicons name="document-text-outline" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.rowTitle} numberOfLines={2}>{request.title}</Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {request.customerName || 'Buyer'} · {request.category}
          </Text>
          <View style={styles.badges}>
            <Badge label={request.status.toUpperCase()} tone={statusTone(request.status)} />
            <Badge label={`${request.offersCount} offers`} />
            {request.reports > 0 ? <Badge label={`${request.reports} REPORTS`} tone="danger" /> : null}
          </View>
        </View>
      </View>
      <Text style={styles.requestBudget}>{budget}</Text>
      <Text style={styles.requestMeta}>
        {request.location || 'Location not stated'} · {shortDate(request.createdAt)}
      </Text>
    </Card>
  );
}

function LiveCard({ session }: { session: AdminOpsLive }) {
  return (
    <Card style={styles.liveCard}>
      <View style={styles.liveDot} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{session.title}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {session.sellerName || session.sellerId} · {session.viewerCount} watching
        </Text>
      </View>
      <Badge label="LIVE" tone="danger" />
    </Card>
  );
}

function SectionHead({ label, count }: { label: string; count: number }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
}

function Empty({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <Card style={styles.empty}>
      <Ionicons name={icon} size={24} color={colors.textFaint} />
      <Muted style={{ textAlign: 'center' }}>{text}</Muted>
    </Card>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={[styles.detailValue, mono && styles.mono]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function SmallAction({
  icon,
  label,
  color,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.smallAction, { borderColor: `${color}66` }, disabled && { opacity: 0.5 }]}
    >
      <Ionicons name={icon} size={15} color={color} />
      <Text style={[styles.smallActionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  notice: { borderColor: 'rgba(245, 165, 36, 0.35)' },
  chips: { gap: spacing.xs, paddingVertical: 2 },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { ...type.caption, color: colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: colors.primary },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionLabel: { ...type.caption, color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  sectionCount: { ...type.caption, color: colors.textFaint, fontSize: 11 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...type.bodyStrong, color: colors.text, fontSize: 15 },
  rowMeta: { ...type.caption, color: colors.textMuted, fontSize: 11.5 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  details: {
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  detailLabel: { ...type.caption, color: colors.textFaint, width: 82, fontSize: 11 },
  detailValue: { ...type.caption, color: colors.text, flex: 1, lineHeight: 18 },
  mono: { fontFamily: 'monospace', fontSize: 11 },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs },
  actionLabel: { ...type.caption, color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginTop: spacing.xs },
  smallAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  smallActionText: { ...type.caption, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  statusChip: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  statusChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  statusChipText: { ...type.caption, color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  requestBudget: { ...type.bodyStrong, color: colors.primary, fontSize: 14 },
  requestMeta: { ...type.caption, color: colors.textFaint, fontSize: 11 },
  liveCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger },
});
