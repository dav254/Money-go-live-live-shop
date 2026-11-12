/**
 * ADMIN · FINANCE
 *
 * Read-only revenue figures plus the payout queue. Payout status is the one
 * money action exposed here: marking a payout paid only records the decision;
 * it does not send money from the phone.
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
import { adminOps, type AdminOpsFinanceResponse, type AdminOpsPayout } from '../../src/lib/api';

export default function AdminFinanceScreen() {
  return <AdminGate>{(token) => <FinanceBody token={token} />}</AdminGate>;
}

function FinanceBody({ token }: { token: string }) {
  const [data, setData] = useState<AdminOpsFinanceResponse | null>(null);
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
        const result = await adminOps.finance(token);
        setData(result);
        setNotice(result.notices.length ? result.notices.join(' ') : null);
        setError(null);
      } catch (err) {
        setError((err as Error)?.message || 'Finance could not be loaded.');
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
  const payouts = useMemo(
    () =>
      (data?.payoutRows ?? []).filter((payout) =>
        !needle
          ? true
          : [payout.sellerName, payout.sellerId, payout.status, payout.method, payout.id]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(needle)),
      ),
    [data, needle],
  );
  const payments = useMemo(
    () =>
      (data?.paymentRows ?? []).filter((payment) =>
        !needle
          ? true
          : [payment.userName, payment.userId, payment.orderId, payment.status, payment.kind]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(needle)),
      ),
    [data, needle],
  );

  const setPayout = useCallback(
    async (payout: AdminOpsPayout, status: 'processing' | 'completed' | 'failed') => {
      setBusyId(payout.id);
      setError(null);
      try {
        await adminOps.setPayoutStatus(token, payout.id, status);
        setData((prev) =>
          prev
            ? {
                ...prev,
                payoutRows: prev.payoutRows.map((row) =>
                  row.id === payout.id ? { ...row, status } : row,
                ),
              }
            : prev,
        );
        setNotice(`Payout ${payout.id.slice(0, 8)} marked ${status}.`);
      } catch (err) {
        setError((err as Error)?.message || 'The payout status could not be saved.');
      } finally {
        setBusyId(null);
      }
    },
    [token],
  );

  const confirmPayout = useCallback(
    (payout: AdminOpsPayout, status: 'processing' | 'completed' | 'failed') => {
      Alert.alert(
        `Mark payout ${status}?`,
        `${money(payout.amount)} to ${payout.sellerName || payout.sellerId}.\n\nThis records the status only. Send the actual money through your payout provider.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: status.toUpperCase(),
            style: status === 'failed' ? 'destructive' : 'default',
            onPress: () => void setPayout(payout, status),
          },
        ],
      );
    },
    [setPayout],
  );

  if (loading && !data) {
    return (
      <Screen>
        <Loading label="Reading the ledger…" />
      </Screen>
    );
  }

  const figures = data?.orders;

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
        <AdminSectionNav active="finance" />
        <AdminPageTitle
          eyebrow="Operations"
          title="Finance"
          detail="Revenue, payouts and captured payments. A status change records a decision; it never sends money."
        />

        <View style={styles.stats}>
          <StatTile label="Today" value={money(figures?.revenueToday ?? 0)} hint={`${figures?.open ?? 0} open orders`} />
          <StatTile label="Last 7 days" value={money(figures?.revenue7d ?? 0)} hint="Excludes refunds" />
          <StatTile label="GMV" value={money(figures?.gmv ?? 0)} hint={`${figures?.total ?? 0} orders`} />
          <StatTile
            label="Pending payouts"
            value={money(data?.payouts.pendingTotal ?? 0)}
            tone={(data?.payouts.pending ?? 0) > 0 ? 'warning' : 'default'}
            hint={`${data?.payouts.pending ?? 0} requests`}
          />
        </View>

        {notice ? (
          <Card style={styles.notice}>
            <Muted>{notice}</Muted>
          </Card>
        ) : null}
        {error ? <ErrorCard message={error} onRetry={() => void load()} /> : null}

        <AdminSearch value={query} onChange={setQuery} placeholder="Search seller, payment or status" />

        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>PAYOUT REQUESTS</Text>
          <Text style={styles.sectionCount}>{payouts.length}</Text>
        </View>

        {payouts.length === 0 ? (
          <Card style={styles.empty}>
            <Ionicons name="wallet-outline" size={24} color={colors.textFaint} />
            <Muted style={{ textAlign: 'center' }}>No payout requests match this search.</Muted>
          </Card>
        ) : (
          payouts.map((payout) => {
            const open = expanded === payout.id;
            const busy = busyId === payout.id;
            return (
              <Card key={payout.id} style={{ gap: spacing.sm }}>
                <Pressable
                  onPress={() => setExpanded(open ? null : payout.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Inspect payout ${payout.id}`}
                  style={styles.rowHead}
                >
                  <View style={styles.rowIcon}>
                    <Ionicons name="cash-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {payout.sellerName || payout.sellerId}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {money(payout.amount)} · {payout.method || 'method not recorded'}
                    </Text>
                    <View style={styles.badges}>
                      <Badge label={payout.status.toUpperCase()} tone={statusTone(payout.status)} />
                      <Badge label={shortDate(payout.requestedAt)} />
                    </View>
                  </View>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textFaint} />
                </Pressable>
                {open ? (
                  <View style={styles.details}>
                    <Detail label="Payout ID" value={payout.id} mono />
                    <Detail label="Seller ID" value={payout.sellerId} mono />
                    <Text style={styles.actionLabel}>RECORD STATUS</Text>
                    <View style={styles.actions}>
                      {(['processing', 'completed', 'failed'] as const).map((status) => (
                        <Pressable
                          key={status}
                          disabled={busy || status === payout.status}
                          onPress={() => confirmPayout(payout, status)}
                          accessibilityRole="button"
                          accessibilityLabel={`Mark payout ${status}`}
                          style={[
                            styles.action,
                            status === 'failed' && styles.actionDanger,
                            status === 'completed' && styles.actionSuccess,
                            (busy || status === payout.status) && { opacity: 0.45 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.actionText,
                              status === 'failed' && { color: colors.danger },
                              status === 'completed' && { color: colors.success },
                            ]}
                          >
                            {status.toUpperCase()}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
              </Card>
            );
          })
        )}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>RECENT PAYMENTS</Text>
          <Text style={styles.sectionCount}>{payments.length}</Text>
        </View>

        {payments.length === 0 ? (
          <Card style={styles.empty}>
            <Ionicons name="card-outline" size={24} color={colors.textFaint} />
            <Muted style={{ textAlign: 'center' }}>No captured payments match this search.</Muted>
          </Card>
        ) : (
          payments.map((payment) => (
            <Card key={payment.id} style={styles.paymentRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {money(payment.amount, payment.currency)}
                  {payment.kind ? ` · ${payment.kind}` : ''}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {payment.userName || payment.userId || 'Unknown payer'}
                  {payment.orderId ? ` · order ${payment.orderId.slice(0, 8)}` : ''}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {payment.method || 'method not recorded'} · {shortDate(payment.createdAt)}
                </Text>
              </View>
              <Badge label={payment.status.toUpperCase()} tone={statusTone(payment.status)} />
            </Card>
          ))
        )}

        <Text style={styles.footnote}>
          Revenue uses non-refunded, non-cancelled orders. Payout totals come from the server's payout
          store; this screen never moves money.
        </Text>
      </ScrollView>
    </Screen>
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
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacing.sm },
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
  actionLabel: { ...type.caption, color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  action: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  actionDanger: { borderColor: 'rgba(240, 68, 56, 0.45)' },
  actionSuccess: { borderColor: 'rgba(47, 191, 113, 0.45)' },
  actionText: { ...type.caption, color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  footnote: { ...type.caption, color: colors.textFaint, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: spacing.sm },
});
