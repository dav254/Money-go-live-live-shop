/**
 * ADMIN · SELLERS
 *
 * Seller accounts with catalogue, order and live metrics. Verification is a
 * real server write; it is never inferred from a shop merely existing.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { Avatar, Badge, Card, Muted, Screen, StatTile } from '../../src/components/ui';
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
import { adminOps, type AdminOpsSeller } from '../../src/lib/api';

type Filter = 'all' | 'pending' | 'verified' | 'live';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All sellers' },
  { key: 'pending', label: 'Pending' },
  { key: 'verified', label: 'Verified' },
  { key: 'live', label: 'Live now' },
];

export default function AdminSellersScreen() {
  return <AdminGate>{(token) => <SellersBody token={token} />}</AdminGate>;
}

function SellersBody({ token }: { token: string }) {
  const [sellers, setSellers] = useState<AdminOpsSeller[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    buyers: 0,
    sellers: 0,
    resellers: 0,
    admins: 0,
    suspended: 0,
    pendingVerification: 0,
    verified: 0,
    pending: 0,
    live: 0,
  });
  const [filter, setFilter] = useState<Filter>('all');
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
        const result = await adminOps.sellers(token);
        setSellers(result.sellers);
        setCounts(result.counts);
        setNotice(result.notice ?? null);
        setError(null);
      } catch (err) {
        setError((err as Error)?.message || 'Sellers could not be loaded.');
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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sellers.filter((seller) => {
      if (filter === 'pending' && seller.verificationStatus !== 'pending') return false;
      if (filter === 'verified' && seller.verificationStatus !== 'verified') return false;
      if (filter === 'live' && !seller.live) return false;
      if (!needle) return true;
      return [seller.shopName, seller.fullName, seller.email, seller.phone, seller.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [filter, query, sellers]);

  const setVerification = useCallback(
    async (seller: AdminOpsSeller, status: 'verified' | 'rejected') => {
      setBusyId(seller.id);
      setError(null);
      try {
        await adminOps.setVerification(token, seller.id, status);
        setSellers((prev) =>
          prev.map((row) =>
            row.id === seller.id ? { ...row, verificationStatus: status } : row,
          ),
        );
        setNotice(
          status === 'verified'
            ? `${seller.shopName || seller.fullName} is verified.`
            : `${seller.shopName || seller.fullName} was not verified.`,
        );
      } catch (err) {
        setError((err as Error)?.message || 'The verification decision could not be saved.');
      } finally {
        setBusyId(null);
      }
    },
    [token],
  );

  const decide = useCallback(
    (seller: AdminOpsSeller) => {
      const current = seller.verificationStatus;
      Alert.alert(
        current === 'verified' ? 'Remove verification?' : 'Verify this seller?',
        current === 'verified'
          ? `${seller.shopName || seller.fullName} will lose the verified badge.`
          : `Confirm that ${seller.shopName || seller.fullName} has submitted the required business details.`,
        [
          { text: 'Cancel', style: 'cancel' },
          ...(current === 'verified'
            ? [{ text: 'Unverify', style: 'destructive' as const, onPress: () => void setVerification(seller, 'rejected') }]
            : [
                { text: 'Reject', style: 'destructive' as const, onPress: () => void setVerification(seller, 'rejected') },
                { text: 'Verify', onPress: () => void setVerification(seller, 'verified') },
              ]),
        ],
      );
    },
    [setVerification],
  );

  if (loading && sellers.length === 0) {
    return (
      <Screen>
        <Loading label="Reading seller accounts…" />
      </Screen>
    );
  }

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
        <AdminSectionNav active="sellers" />
        <AdminPageTitle
          eyebrow="Operations"
          title="Sellers"
          detail="Businesses, their catalogue and order value. Verification is written to the server, not implied by a shop."
        />

        <View style={styles.stats}>
          <StatTile label="Seller accounts" value={String(counts.sellers)} hint={`${counts.live} live now`} />
          <StatTile label="Verified" value={String(counts.verified)} hint="Approved businesses" />
          <StatTile
            label="Pending"
            value={String(counts.pending)}
            tone={counts.pending > 0 ? 'warning' : 'default'}
            hint="Awaiting a decision"
          />
          <StatTile
            label="Suspended"
            value={String(counts.suspended)}
            tone={counts.suspended > 0 ? 'danger' : 'default'}
            hint="Across all accounts"
          />
        </View>

        {notice ? (
          <Card style={styles.notice}>
            <Muted>{notice}</Muted>
          </Card>
        ) : null}
        {error ? <ErrorCard message={error} onRetry={() => void load()} /> : null}

        <AdminSearch value={query} onChange={setQuery} placeholder="Search shop, owner, email or phone" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((item) => {
            const selected = filter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.chip, selected && styles.chipActive]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {filtered.length === 0 ? (
          <Card style={styles.empty}>
            <Ionicons name="storefront-outline" size={24} color={colors.textFaint} />
            <Muted style={{ textAlign: 'center' }}>No sellers match this filter.</Muted>
          </Card>
        ) : (
          filtered.map((seller) => {
            const open = expanded === seller.id;
            const busy = busyId === seller.id;
            return (
              <Card key={seller.id} style={{ gap: spacing.sm }}>
                <Pressable
                  onPress={() => setExpanded(open ? null : seller.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Inspect ${seller.shopName || seller.fullName}`}
                  style={styles.sellerHead}
                >
                  <Avatar uri={seller.profilePictureUrl} name={seller.shopName || seller.fullName} size={44} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.sellerName} numberOfLines={1}>
                      {seller.shopName || seller.fullName}
                    </Text>
                    <Text style={styles.sellerMeta} numberOfLines={1}>
                      {seller.fullName}
                      {seller.email ? ` · ${seller.email}` : ''}
                    </Text>
                    <View style={styles.badges}>
                      <Badge
                        label={seller.verificationStatus?.toUpperCase() || 'NOT REVIEWED'}
                        tone={seller.verificationStatus ? statusTone(seller.verificationStatus) : 'neutral'}
                      />
                      {seller.status !== 'active' ? (
                        <Badge label={seller.status.toUpperCase()} tone={statusTone(seller.status)} />
                      ) : null}
                      {seller.live ? <Badge label="LIVE" tone="danger" /> : null}
                    </View>
                  </View>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textFaint} />
                </Pressable>

                <View style={styles.miniStats}>
                  <Mini label="Listings" value={String(seller.productCount)} />
                  <Mini label="Orders" value={String(seller.orderCount)} />
                  <Mini label="GMV" value={money(seller.gmv)} />
                </View>

                {open ? (
                  <View style={styles.details}>
                    <Detail label="Phone" value={seller.phone || 'not provided'} />
                    <Detail label="Joined" value={shortDate(seller.joinDate)} />
                    <Detail label="AI points" value={seller.aiPoints.toLocaleString()} />
                    <Detail label="Seller ID" value={seller.id} mono />
                    <View style={styles.actions}>
                      <Pressable
                        onPress={() => decide(seller)}
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityLabel={seller.verificationStatus === 'verified' ? 'Remove verification' : 'Review verification'}
                        style={[
                          styles.action,
                          seller.verificationStatus === 'verified' && styles.actionDanger,
                          busy && { opacity: 0.5 },
                        ]}
                      >
                        <Ionicons
                          name={seller.verificationStatus === 'verified' ? 'close-circle-outline' : 'shield-checkmark-outline'}
                          size={15}
                          color={seller.verificationStatus === 'verified' ? colors.danger : colors.success}
                        />
                        <Text
                          style={[
                            styles.actionText,
                            { color: seller.verificationStatus === 'verified' ? colors.danger : colors.success },
                          ]}
                        >
                          {busy ? 'SAVING…' : seller.verificationStatus === 'verified' ? 'UNVERIFY' : 'REVIEW'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </Card>
            );
          })
        )}

        <Text style={styles.footnote}>
          Verification marks the account; it does not approve every future listing. Dangerous actions
          remain on the web console.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
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
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { ...type.caption, color: colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: colors.primary },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  sellerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sellerName: { ...type.bodyStrong, color: colors.text, fontSize: 16 },
  sellerMeta: { ...type.caption, color: colors.textMuted, fontSize: 11.5 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  miniStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  mini: { flex: 1, gap: 1 },
  miniValue: { ...type.bodyStrong, color: colors.text, fontSize: 15 },
  miniLabel: { ...type.caption, color: colors.textFaint, fontSize: 10.5 },
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
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(47, 191, 113, 0.45)',
  },
  actionDanger: { borderColor: 'rgba(240, 68, 56, 0.45)' },
  actionText: { ...type.caption, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  footnote: { ...type.caption, color: colors.textFaint, fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
