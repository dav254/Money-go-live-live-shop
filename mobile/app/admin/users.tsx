/**
 * ADMIN · USERS
 *
 * Live account directory across buyers, sellers, resellers and admins. The
 * server merges Firestore with the VPS copy, so a blocked Firestore degrades
 * to the mirror instead of an empty list. Suspend/reactivate is the only
 * account mutation exposed here; role changes stay on the web console because
 * they carry last-admin lockout rules.
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
  shortDate,
  statusTone,
} from '../../src/components/admin/ops-ui';
import { colors, radius, spacing, type } from '../../src/theme';
import { adminOps, type AdminOpsUser } from '../../src/lib/api';

const ROLES = [
  { key: 'all', label: 'All' },
  { key: 'buyer', label: 'Buyers' },
  { key: 'seller', label: 'Sellers' },
  { key: 'reseller', label: 'Resellers' },
  { key: 'admin', label: 'Admins' },
] as const;

type RoleFilter = (typeof ROLES)[number]['key'];

export default function AdminUsersScreen() {
  return <AdminGate>{(token) => <UsersBody token={token} />}</AdminGate>;
}

function UsersBody({ token }: { token: string }) {
  const [users, setUsers] = useState<AdminOpsUser[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    buyers: 0,
    sellers: 0,
    resellers: 0,
    admins: 0,
    suspended: 0,
    pendingVerification: 0,
  });
  const [role, setRole] = useState<RoleFilter>('all');
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
        const result = await adminOps.users(token);
        setUsers(result.users);
        setCounts(result.counts);
        setNotice(result.notice ?? null);
        setError(null);
      } catch (err) {
        setError((err as Error)?.message || 'Accounts could not be loaded.');
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
    return users.filter((user) => {
      if (role !== 'all' && user.role !== role) return false;
      if (!needle) return true;
      return [user.fullName, user.email, user.phone, user.shopName, user.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [query, role, users]);

  const changeStatus = useCallback(
    async (user: AdminOpsUser, status: 'active' | 'suspended') => {
      setBusyId(user.id);
      setError(null);
      try {
        await adminOps.setUserStatus(token, user.id, status);
        setUsers((prev) =>
          prev.map((row) => (row.id === user.id ? { ...row, status } : row)),
        );
        setNotice(
          status === 'suspended'
            ? `${user.fullName} is suspended. Their next API call will be refused.`
            : `${user.fullName} is active again.`,
        );
      } catch (err) {
        setError((err as Error)?.message || 'The account status could not be changed.');
      } finally {
        setBusyId(null);
      }
    },
    [token],
  );

  const manage = useCallback(
    (user: AdminOpsUser) => {
      if (user.role === 'admin') {
        Alert.alert(
          'Admin account',
          'Admin roles are managed from the web console so the last-admin lockout rule can be enforced.',
        );
        return;
      }
      const next = user.status === 'suspended' ? 'active' : 'suspended';
      Alert.alert(
        next === 'suspended' ? 'Suspend this account?' : 'Reactivate this account?',
        next === 'suspended'
          ? `${user.fullName} will lose access to buying and selling. The backend checks the role on every request.`
          : `${user.fullName} will be able to use Vidnov again.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: next === 'suspended' ? 'Suspend' : 'Reactivate',
            style: next === 'suspended' ? 'destructive' : 'default',
            onPress: () => void changeStatus(user, next),
          },
        ],
      );
    },
    [changeStatus],
  );

  if (loading && users.length === 0) {
    return (
      <Screen>
        <Loading label="Reading accounts…" />
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
        <AdminSectionNav active="users" />
        <AdminPageTitle
          eyebrow="Operations"
          title="Users"
          detail="Every account, merged from Firestore and the VPS copy. Counts are real records, not estimates."
        />

        <View style={styles.stats}>
          <StatTile label="Accounts" value={String(counts.total)} hint={`${counts.buyers} buyers`} />
          <StatTile label="Sellers" value={String(counts.sellers)} hint={`${counts.pendingVerification} pending verification`} />
          <StatTile
            label="Suspended"
            value={String(counts.suspended)}
            tone={counts.suspended > 0 ? 'danger' : 'default'}
            hint="Blocked accounts"
          />
          <StatTile label="Resellers" value={String(counts.resellers)} hint={`${counts.admins} admins`} />
        </View>

        {notice ? (
          <Card style={styles.notice}>
            <Muted>{notice}</Muted>
          </Card>
        ) : null}
        {error ? <ErrorCard message={error} onRetry={() => void load()} /> : null}

        <AdminSearch value={query} onChange={setQuery} placeholder="Search name, email, phone or shop" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {ROLES.map((item) => {
            const selected = role === item.key;
            const count =
              item.key === 'all'
                ? counts.total
                : item.key === 'buyer'
                  ? counts.buyers
                  : item.key === 'seller'
                    ? counts.sellers
                    : item.key === 'reseller'
                      ? counts.resellers
                      : counts.admins;
            return (
              <Pressable
                key={item.key}
                onPress={() => setRole(item.key)}
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

        <View style={styles.listHead}>
          <Text style={styles.listLabel}>DIRECTORY</Text>
          <Text style={styles.listCount}>{filtered.length} shown</Text>
        </View>

        {filtered.length === 0 ? (
          <Card style={styles.empty}>
            <Ionicons name="people-outline" size={24} color={colors.textFaint} />
            <Muted style={{ textAlign: 'center' }}>
              No accounts match this filter. The full directory is still loaded.
            </Muted>
          </Card>
        ) : (
          filtered.map((user) => {
            const open = expanded === user.id;
            const busy = busyId === user.id;
            return (
              <Card key={user.id} style={{ gap: spacing.sm }}>
                <Pressable
                  onPress={() => setExpanded(open ? null : user.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Inspect ${user.fullName}`}
                  style={styles.userHead}
                >
                  <Avatar uri={user.profilePictureUrl} name={user.fullName} size={42} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {user.shopName || user.fullName}
                    </Text>
                    <Text style={styles.userMeta} numberOfLines={1}>
                      {user.email || user.phone || user.id}
                    </Text>
                    <View style={styles.badges}>
                      <Badge label={user.role.toUpperCase()} tone={user.role === 'admin' ? 'primary' : 'neutral'} />
                      <Badge label={user.status.toUpperCase()} tone={statusTone(user.status)} />
                      {user.verificationStatus ? (
                        <Badge label={user.verificationStatus.toUpperCase()} tone={statusTone(user.verificationStatus)} />
                      ) : null}
                    </View>
                  </View>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textFaint} />
                </Pressable>

                {open ? (
                  <View style={styles.details}>
                    <Detail label="Account ID" value={user.id} mono />
                    <Detail label="Legal name" value={user.fullName} />
                    <Detail label="Email" value={user.email || 'not provided'} />
                    <Detail label="Phone" value={user.phone || 'not provided'} />
                    <Detail label="Shop" value={user.shopName || 'not a seller'} />
                    <Detail label="Joined" value={shortDate(user.joinDate)} />
                    <Detail label="AI points" value={user.aiPoints.toLocaleString()} />
                    <View style={styles.actions}>
                      <Pressable
                        onPress={() => manage(user)}
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityLabel={user.status === 'suspended' ? 'Reactivate account' : 'Suspend account'}
                        style={[styles.action, user.status !== 'suspended' && styles.actionDanger, busy && { opacity: 0.5 }]}
                      >
                        <Ionicons
                          name={user.status === 'suspended' ? 'checkmark-circle-outline' : 'ban-outline'}
                          size={15}
                          color={user.status === 'suspended' ? colors.success : colors.danger}
                        />
                        <Text style={[styles.actionText, { color: user.status === 'suspended' ? colors.success : colors.danger }]}>
                          {busy ? 'SAVING…' : user.status === 'suspended' ? 'REACTIVATE' : 'SUSPEND'}
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
          Role changes and last-admin protection stay on the web console. Suspension is checked by the
          backend on every request, not just hidden in this screen.
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
  listHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  listLabel: { ...type.caption, color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  listCount: { ...type.caption, color: colors.textFaint, fontSize: 11 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  userHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  userName: { ...type.bodyStrong, color: colors.text, fontSize: 15.5 },
  userMeta: { ...type.caption, color: colors.textMuted, fontSize: 11.5 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  details: {
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  detailLabel: { ...type.caption, color: colors.textFaint, width: 92, fontSize: 11 },
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
