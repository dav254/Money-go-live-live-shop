/**
 * ADMIN HOME — the founder's first screen.
 *
 * Two independent reads: the AI/Ollama connection report and the platform
 * operations summary. One failing store must not hide the other. Every number
 * is a real record or an explicit UNKNOWN.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { Badge, Button, Card, Muted, Screen, StatTile } from '../../src/components/ui';
import {
  AdminGate,
  CheckCard,
  ErrorCard,
  formatWhen,
  Loading,
  SectionLabel,
  StatePill,
} from '../../src/components/admin/kit';
import { AdminPageTitle, AdminSectionNav, money } from '../../src/components/admin/ops-ui';
import { colors, radius, spacing, type } from '../../src/theme';
import { useAuth } from '../../src/lib/auth';
import { adminAi, adminOps, type AdminOpsSummary, type AdminOverview } from '../../src/lib/api';

const SECTIONS: Array<{
  key: string;
  label: string;
  detail: string;
  href: '/admin/users' | '/admin/sellers' | '/admin/market' | '/admin/finance' | '/admin/safety' | '/admin/growth' | '/admin/intelligence' | '/admin/developer';
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'users', label: 'Users', detail: 'Accounts and access', href: '/admin/users', icon: 'people-outline' },
  { key: 'sellers', label: 'Sellers', detail: 'Businesses and verification', href: '/admin/sellers', icon: 'storefront-outline' },
  { key: 'market', label: 'Market', detail: 'Listings, orders, live', href: '/admin/market', icon: 'bag-handle-outline' },
  { key: 'finance', label: 'Finance', detail: 'Revenue and payouts', href: '/admin/finance', icon: 'cash-outline' },
  { key: 'safety', label: 'Safety', detail: 'Reports and moderation', href: '/admin/safety', icon: 'shield-checkmark-outline' },
  { key: 'growth', label: 'Growth', detail: 'Posts and boosts', href: '/admin/growth', icon: 'trending-up-outline' },
  { key: 'intelligence', label: 'Intelligence', detail: 'AI chat and approvals', href: '/admin/intelligence', icon: 'sparkles-outline' },
  { key: 'developer', label: 'Developer', detail: 'System and integrations', href: '/admin/developer', icon: 'terminal-outline' },
];

function assistantColor(state: AdminOverview['assistant']['state']) {
  if (state === 'online') return colors.success;
  if (state === 'degraded') return colors.warning;
  if (state === 'offline') return colors.danger;
  return colors.textMuted;
}

export default function AdminHomeScreen() {
  return <AdminGate>{(token) => <AdminHome token={token} />}</AdminGate>;
}

function AdminHome({ token }: { token: string }) {
  const router = useRouter();
  const { profile } = useAuth();
  const firstName = (profile?.fullName || 'Founder').trim().split(/\s+/)[0];
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [summary, setSummary] = useState<AdminOpsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      const [overviewResult, summaryResult] = await Promise.allSettled([
        adminAi.overview(token),
        adminOps.summary(token),
      ]);
      if (overviewResult.status === 'fulfilled') {
        setOverview(overviewResult.value);
        setOverviewError(null);
      } else {
        setOverviewError(
          (overviewResult.reason as Error)?.message || 'The AI status could not be loaded.',
        );
      }
      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value);
        setSummaryError(null);
      } else {
        setSummaryError(
          (summaryResult.reason as Error)?.message || 'The operations summary could not be loaded.',
        );
      }
      setLoading(false);
      setRefreshing(false);
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading && !overview && !summary) {
    return (
      <Screen>
        <Loading label="Reading live status…" />
      </Screen>
    );
  }

  const attention = [
    {
      label: 'Approvals',
      value: String(summary?.approvals.pending ?? 0),
      hint: summary?.approvals.available === false ? 'unavailable' : 'waiting for you',
      tone: (summary?.approvals.pending ?? 0) > 0 ? ('warning' as const) : ('default' as const),
      href: '/admin/approvals' as const,
    },
    {
      label: 'Open reports',
      value: String(summary?.safety.open ?? 0),
      hint: 'safety queue',
      tone: (summary?.safety.open ?? 0) > 0 ? ('danger' as const) : ('default' as const),
      href: '/admin/safety' as const,
    },
    {
      label: 'Pending payouts',
      value: money(summary?.finance.pendingTotal ?? 0),
      hint: `${summary?.finance.pending ?? 0} requests`,
      tone: (summary?.finance.pending ?? 0) > 0 ? ('warning' as const) : ('default' as const),
      href: '/admin/finance' as const,
    },
    {
      label: 'Live now',
      value: String(summary?.live.active ?? 0),
      hint: 'active streams',
      tone: (summary?.live.active ?? 0) > 0 ? ('danger' as const) : ('default' as const),
      href: '/admin/market' as const,
    },
  ];

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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>VIDNOV</Text>
            <Text style={styles.title}>Command Centre</Text>
            <Muted>
              Welcome back, {firstName} · {summary ? formatWhen(summary.generatedAt) : 'not loaded'}
            </Muted>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Badge label="ADMIN" tone="primary" />
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close Command Centre"
              style={styles.close}
            >
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        <AdminSectionNav active="home" />

        <AdminPageTitle
          eyebrow="Home"
          title="Operations"
          detail="Accounts, marketplace, money, safety and growth — one live surface. Intelligence and developer tools stay separate."
        />

        {summaryError ? <ErrorCard message={summaryError} onRetry={() => void load()} /> : null}
        {overviewError ? <ErrorCard message={overviewError} onRetry={() => void load()} /> : null}
        {summary?.notices?.length ? (
          <Card style={styles.notice}>
            <Muted>{summary.notices.join(' ')}</Muted>
          </Card>
        ) : null}

        <View style={styles.stats}>
          <StatTile
            label="Accounts"
            value={String(summary?.users.total ?? 0)}
            hint={`${summary?.users.buyers ?? 0} buyers · ${summary?.users.sellers ?? 0} sellers`}
            onPress={() => router.push('/admin/users')}
          />
          <StatTile
            label="Listings"
            value={String(summary?.products.total ?? 0)}
            hint={`${summary?.products.reported ?? 0} reported`}
            onPress={() => router.push('/admin/market')}
          />
          <StatTile
            label="Orders"
            value={String(summary?.orders.total ?? 0)}
            hint={`${summary?.orders.open ?? 0} open · ${money(summary?.orders.gmv ?? 0)}`}
            onPress={() => router.push('/admin/market')}
          />
          <StatTile
            label="Today"
            value={money(summary?.orders.revenueToday ?? 0)}
            hint={`${money(summary?.orders.revenue7d ?? 0)} last 7 days`}
            onPress={() => router.push('/admin/finance')}
          />
        </View>

        <SectionLabel>NEEDS ATTENTION</SectionLabel>
        <View style={styles.attention}>
          {attention.map((item) => (
            <StatTile
              key={item.label}
              label={item.label}
              value={item.value}
              hint={item.hint}
              tone={item.tone}
              onPress={() => router.push(item.href)}
            />
          ))}
        </View>

        <SectionLabel>SECTIONS</SectionLabel>
        <View style={styles.grid}>
          {SECTIONS.map((section) => (
            <Pressable
              key={section.key}
              onPress={() => router.push(section.href)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${section.label}`}
              style={({ pressed }) => [styles.tile, pressed && { borderColor: colors.primary }]}
            >
              <View style={styles.tileIcon}>
                <Ionicons name={section.icon} size={20} color={colors.primary} />
              </View>
              <Text style={styles.tileLabel}>{section.label}</Text>
              <Text style={styles.tileDetail}>{section.detail}</Text>
            </Pressable>
          ))}
        </View>

        <SectionLabel>AI ASSISTANT</SectionLabel>
        <Pressable
          onPress={() => router.push('/admin/chat')}
          accessibilityRole="button"
          accessibilityLabel="Open AI chat"
        >
          <View
            style={[
              styles.hero,
              { borderLeftColor: overview ? assistantColor(overview.assistant.state) : colors.textMuted },
            ]}
          >
            <View style={styles.heroHead}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.heroLabel}>INTELLIGENCE</Text>
                <Text style={styles.heroModel}>{overview?.assistant.model ?? 'No model configured'}</Text>
              </View>
              {overview ? <StatePill state={overview.assistant.state} /> : <Badge label="UNKNOWN" />}
            </View>
            <Text style={styles.heroDetail}>
              {overview?.assistant.detail ?? 'Status has not been checked.'}
            </Text>
            <View style={styles.heroFoot}>
              <Text style={styles.heroFootText}>
                Last successful contact: {formatWhen(overview?.assistant.lastOkAt)}
              </Text>
              <Ionicons name="arrow-forward" size={16} color={colors.primary} />
            </View>
          </View>
        </Pressable>

        <Pressable
          onPress={() => router.push('/admin/tasks')}
          accessibilityRole="button"
          accessibilityLabel="Open OpenCode task centre"
        >
          <Card style={styles.taskCard}>
            <View style={styles.approvalIcon}>
              <Ionicons name="git-branch-outline" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.approvalTitle}>OpenCode task centre</Text>
              <Text style={styles.approvalBody}>
                Prepare a plan, approve it, then watch the real coding session.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Card>
        </Pressable>

        {overview && !overview.configuration.ollama.configured ? (
          <Card style={styles.configNote}>
            <View style={styles.configHead}>
              <Ionicons name="settings-outline" size={17} color={colors.warning} />
              <Text style={styles.configTitle}>Ollama is not configured</Text>
            </View>
            <Text style={styles.configBody}>
              No connection details were provided to this server, so the status stays UNKNOWN and
              chat cannot answer. Set the Ollama connection in the server environment, then pull to
              refresh here.
            </Text>
          </Card>
        ) : null}

        <SectionLabel>APPROVALS</SectionLabel>
        <Pressable
          onPress={() => router.push('/admin/approvals')}
          accessibilityRole="button"
          accessibilityLabel="Open approvals"
        >
          <Card style={styles.approvalCard}>
            <View style={styles.approvalIcon}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.approvalTitle}>
                {summary && summary.approvals.pending > 0
                  ? `${summary.approvals.pending} awaiting your decision`
                  : overview && overview.approvals.pending > 0
                    ? `${overview.approvals.pending} awaiting your decision`
                    : 'No pending approvals'}
              </Text>
              <Text style={styles.approvalBody}>
                {summary && !summary.approvals.available
                  ? 'Approval records could not be read.'
                  : 'Every modifying action needs the founder’s approval.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Card>
        </Pressable>

        <SectionLabel>CONNECTIONS</SectionLabel>
        {(overview?.checks ?? []).map((check) => (
          <CheckCard
            key={check.id}
            check={check}
            onPress={
              check.id === 'ollama'
                ? () => router.push('/admin/ollama')
                : check.id === 'paperclip'
                  ? () => router.push('/admin/paperclip')
                  : check.id === 'opencode'
                    ? () => router.push('/admin/tasks')
                    : check.id === 'vidnov'
                      ? () => router.push('/admin/system')
                      : undefined
            }
          />
        ))}
        {overview && overview.checks.length === 0 ? <Muted>No checks were performed.</Muted> : null}

        <SectionLabel>RECENT AI REPORTS</SectionLabel>
        {overview?.reports.items.length ? (
          <View style={{ gap: spacing.sm }}>
            {overview.reports.items.slice(0, 3).map((report) => (
              <Pressable
                key={report.id}
                onPress={() => router.push('/admin/reports')}
                accessibilityRole="button"
                accessibilityLabel={`Open report ${report.title}`}
              >
                <Card style={{ gap: 4 }}>
                  <View style={styles.reportHead}>
                    <Text style={styles.reportTitle} numberOfLines={1}>{report.title}</Text>
                    <Badge
                      label={report.status.toUpperCase()}
                      tone={report.status === 'completed' ? 'success' : report.status === 'failed' ? 'danger' : 'warning'}
                    />
                  </View>
                  <Text style={styles.reportPreview} numberOfLines={2}>
                    {report.preview || report.error || 'No output.'}
                  </Text>
                  <Text style={styles.reportMeta}>{report.model} · {formatWhen(report.startedAt)} · not executed</Text>
                </Card>
              </Pressable>
            ))}
          </View>
        ) : (
          <Card>
            <Muted>
              {overview && !overview.reports.available
                ? 'Report history is unavailable — the local store is not configured on this server.'
                : 'No AI reports yet. Send an instruction from the Intelligence section.'}
            </Muted>
          </Card>
        )}

        <Button
          label={refreshing ? 'CHECKING…' : 'REFRESH STATUS'}
          variant="outline"
          icon="refresh-outline"
          loading={refreshing}
          onPress={() => void load('refresh')}
        />
        <Text style={styles.footnote}>
          Statuses are measured by the Vidnov server on each refresh. UNKNOWN means no check was
          performed — not that the service is healthy.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  topBar: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { ...type.caption, color: colors.primary, fontWeight: '800', letterSpacing: 2, fontSize: 10 },
  title: { ...type.display, color: colors.text },
  notice: { borderColor: 'rgba(245, 165, 36, 0.35)' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  attention: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tileLabel: { ...type.bodyStrong, color: colors.text },
  tileDetail: { ...type.caption, color: colors.textFaint, fontSize: 11 },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderLeftWidth: 3,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  heroLabel: { ...type.caption, color: colors.textMuted, fontSize: 10, letterSpacing: 1.3, fontWeight: '700' },
  heroModel: { ...type.title, color: colors.text, fontSize: 19 },
  heroDetail: { ...type.caption, color: colors.textMuted, lineHeight: 19 },
  heroFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  heroFootText: { ...type.caption, color: colors.textFaint, fontSize: 11 },
  configNote: { borderColor: 'rgba(245, 165, 36, 0.35)', gap: spacing.xs },
  configHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  configTitle: { ...type.bodyStrong, color: colors.text },
  configBody: { ...type.caption, color: colors.textMuted, lineHeight: 18 },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
  },
  approvalCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  approvalIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalTitle: { ...type.bodyStrong, color: colors.text },
  approvalBody: { ...type.caption, color: colors.textMuted, lineHeight: 17 },
  reportHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reportTitle: { ...type.bodyStrong, color: colors.text, flex: 1 },
  reportPreview: { ...type.caption, color: colors.textMuted, lineHeight: 17 },
  reportMeta: { ...type.caption, color: colors.textFaint, fontSize: 11 },
  footnote: { ...type.caption, color: colors.textFaint, fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
