/**
 * ADMIN · SAFETY
 *
 * The moderation queue: complaints against products, users and orders. A
 * status decision is written to the existing admin complaints API; it does not
 * delete evidence or ban an account from this screen.
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
  shortDate,
  statusTone,
} from '../../src/components/admin/ops-ui';
import { colors, radius, spacing, type } from '../../src/theme';
import { adminOps, type AdminOpsComplaint } from '../../src/lib/api';

type Filter = 'open' | 'investigating' | 'resolved' | 'dismissed' | 'all';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'open', label: 'Open' },
  { key: 'investigating', label: 'Investigating' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'dismissed', label: 'Dismissed' },
  { key: 'all', label: 'All' },
];

export default function AdminSafetyScreen() {
  return <AdminGate>{(token) => <SafetyBody token={token} />}</AdminGate>;
}

function SafetyBody({ token }: { token: string }) {
  const [complaints, setComplaints] = useState<AdminOpsComplaint[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    open: 0,
    investigating: 0,
    resolved: 0,
    dismissed: 0,
  });
  const [filter, setFilter] = useState<Filter>('open');
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
        const result = await adminOps.safety(token);
        setComplaints(result.complaints);
        setCounts(result.counts);
        setNotice(result.notice ?? null);
        setError(null);
      } catch (err) {
        setError((err as Error)?.message || 'The safety queue could not be loaded.');
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
    return complaints.filter((complaint) => {
      if (filter !== 'all' && complaint.status !== filter) return false;
      if (!needle) return true;
      return [
        complaint.targetName,
        complaint.targetId,
        complaint.reporterName,
        complaint.reason,
        complaint.details,
        complaint.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [complaints, filter, query]);

  const changeStatus = useCallback(
    async (
      complaint: AdminOpsComplaint,
      status: 'open' | 'investigating' | 'resolved' | 'dismissed',
    ) => {
      setBusyId(complaint.id);
      setError(null);
      try {
        await adminOps.setComplaintStatus(token, complaint.id, status);
        setComplaints((prev) =>
          prev.map((row) => (row.id === complaint.id ? { ...row, status } : row)),
        );
        setNotice(`Complaint ${complaint.id.slice(0, 8)} is now ${status}.`);
      } catch (err) {
        setError((err as Error)?.message || 'The complaint status could not be saved.');
      } finally {
        setBusyId(null);
      }
    },
    [token],
  );

  const confirm = useCallback(
    (
      complaint: AdminOpsComplaint,
      status: 'open' | 'investigating' | 'resolved' | 'dismissed',
    ) => {
      const destructive = status === 'dismissed';
      Alert.alert(
        `Mark complaint ${status}?`,
        `${complaint.reason || 'No reason recorded'}.\n\nThis records a moderation decision. It does not delete the complaint or suspend an account.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: status.toUpperCase(),
            style: destructive ? 'destructive' : 'default',
            onPress: () => void changeStatus(complaint, status),
          },
        ],
      );
    },
    [changeStatus],
  );

  if (loading && complaints.length === 0) {
    return (
      <Screen>
        <Loading label="Reading the safety queue…" />
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
        <AdminSectionNav active="safety" />
        <AdminPageTitle
          eyebrow="Operations"
          title="Safety"
          detail="Reports against listings, accounts and orders. Decisions are recorded; evidence and accounts are not deleted here."
        />

        <View style={styles.stats}>
          <StatTile label="Open" value={String(counts.open)} tone={counts.open > 0 ? 'warning' : 'default'} hint="Needs triage" />
          <StatTile label="Investigating" value={String(counts.investigating)} hint="In review" />
          <StatTile label="Resolved" value={String(counts.resolved)} hint="Closed" />
          <StatTile label="Dismissed" value={String(counts.dismissed)} hint={`${counts.total} total reports`} />
        </View>

        {notice ? (
          <Card style={styles.notice}>
            <Muted>{notice}</Muted>
          </Card>
        ) : null}
        {error ? <ErrorCard message={error} onRetry={() => void load()} /> : null}

        <AdminSearch value={query} onChange={setQuery} placeholder="Search target, reporter or reason" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((item) => {
            const selected = filter === item.key;
            const count =
              item.key === 'all'
                ? counts.total
                : item.key === 'open'
                  ? counts.open
                  : item.key === 'investigating'
                    ? counts.investigating
                    : item.key === 'resolved'
                      ? counts.resolved
                      : counts.dismissed;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.chip, selected && styles.chipActive]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                  {item.label} {count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {filtered.length === 0 ? (
          <Card style={styles.empty}>
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.textFaint} />
            <Muted style={{ textAlign: 'center' }}>Nothing in this queue matches the current filter.</Muted>
          </Card>
        ) : (
          filtered.map((complaint) => {
            const open = expanded === complaint.id;
            const busy = busyId === complaint.id;
            return (
              <Card key={complaint.id} style={{ gap: spacing.sm }}>
                <Pressable
                  onPress={() => setExpanded(open ? null : complaint.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Inspect complaint ${complaint.id}`}
                  style={styles.rowHead}
                >
                  <View style={styles.rowIcon}>
                    <Ionicons name="shield-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.rowTitle} numberOfLines={2}>
                      {complaint.reason || 'Complaint'}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {complaint.targetType.toUpperCase()} · {complaint.targetName || complaint.targetId || 'unknown target'}
                    </Text>
                    <View style={styles.badges}>
                      <Badge label={complaint.status.toUpperCase()} tone={statusTone(complaint.status)} />
                      <Badge label={shortDate(complaint.createdAt)} />
                    </View>
                  </View>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textFaint} />
                </Pressable>

                {open ? (
                  <View style={styles.details}>
                    <Detail label="Details" value={complaint.details || 'No additional details were recorded.'} />
                    <Detail label="Reported by" value={complaint.reporterName || complaint.reporterId || 'not recorded'} />
                    <Detail label="Target ID" value={complaint.targetId || 'not recorded'} mono />
                    {complaint.orderId ? <Detail label="Order" value={complaint.orderId} mono /> : null}
                    <Detail label="Complaint ID" value={complaint.id} mono />
                    <Text style={styles.actionLabel}>DECISION</Text>
                    <View style={styles.actions}>
                      {complaint.status !== 'investigating' && complaint.status !== 'resolved' && complaint.status !== 'dismissed' ? (
                        <Action label="INVESTIGATE" icon="search-outline" color={colors.warning} disabled={busy} onPress={() => confirm(complaint, 'investigating')} />
                      ) : null}
                      {complaint.status !== 'resolved' ? (
                        <Action label="RESOLVE" icon="checkmark-circle-outline" color={colors.success} disabled={busy} onPress={() => confirm(complaint, 'resolved')} />
                      ) : null}
                      {complaint.status !== 'dismissed' ? (
                        <Action label="DISMISS" icon="close-circle-outline" color={colors.danger} disabled={busy} onPress={() => confirm(complaint, 'dismissed')} />
                      ) : null}
                      {complaint.status !== 'open' ? (
                        <Action label="REOPEN" icon="refresh-outline" color={colors.primary} disabled={busy} onPress={() => confirm(complaint, 'open')} />
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </Card>
            );
          })
        )}

        <Text style={styles.footnote}>
          Suspending an account or removing a listing stays on the Users / Market screens, where the
          action can be confirmed against the specific account or listing.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={[styles.detailValue, mono && styles.mono]} numberOfLines={4}>
        {value}
      </Text>
    </View>
  );
}

function Action({
  label,
  icon,
  color,
  onPress,
  disabled,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
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
      style={[styles.action, { borderColor: `${color}66` }, disabled && { opacity: 0.5 }]}
    >
      <Ionicons name={icon} size={15} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
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
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { ...type.caption, color: colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: colors.primary },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionText: { ...type.caption, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  footnote: { ...type.caption, color: colors.textFaint, fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
