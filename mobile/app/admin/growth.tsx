/**
 * ADMIN · GROWTH
 *
 * The manual growth queue and boost requests. Approving a post records the
 * decision; publishing remains a separate action with its own provider checks.
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
import { adminOps, type AdminOpsCampaign, type AdminOpsGrowthPost } from '../../src/lib/api';

type Tab = 'posts' | 'campaigns';

export default function AdminGrowthScreen() {
  return <AdminGate>{(token) => <GrowthBody token={token} />}</AdminGate>;
}

function GrowthBody({ token }: { token: string }) {
  const [posts, setPosts] = useState<AdminOpsGrowthPost[]>([]);
  const [campaigns, setCampaigns] = useState<AdminOpsCampaign[]>([]);
  const [counts, setCounts] = useState({
    draft: 0,
    approved: 0,
    rejected: 0,
    published: 0,
    failed: 0,
    unknown: 0,
  });
  const [tab, setTab] = useState<Tab>('posts');
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
        const result = await adminOps.growth(token);
        setPosts(result.posts);
        setCampaigns(result.campaigns);
        setCounts(result.counts);
        setNotice(result.notice ?? null);
        setError(null);
      } catch (err) {
        setError((err as Error)?.message || 'Growth could not be loaded.');
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
  const visiblePosts = useMemo(
    () =>
      posts.filter((post) =>
        !needle
          ? true
          : [post.productName, post.caption, post.status, post.sharePath]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(needle)),
      ),
    [needle, posts],
  );
  const visibleCampaigns = useMemo(
    () =>
      campaigns.filter((campaign) =>
        !needle
          ? true
          : [campaign.sellerName, campaign.sellerId, campaign.status, campaign.id]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(needle)),
      ),
    [campaigns, needle],
  );

  const decide = useCallback(
    async (post: AdminOpsGrowthPost, decision: 'approve' | 'reject') => {
      setBusyId(post.id);
      setError(null);
      try {
        await adminOps.decideGrowthPost(token, post.id, decision);
        setPosts((prev) =>
          prev.map((row) =>
            row.id === post.id
              ? { ...row, status: decision === 'approve' ? 'approved' : 'rejected' }
              : row,
          ),
        );
        setCounts((prev) => ({
          ...prev,
          draft: Math.max(0, prev.draft - 1),
          [decision === 'approve' ? 'approved' : 'rejected']:
            prev[decision === 'approve' ? 'approved' : 'rejected'] + 1,
        }));
        setNotice(`Post ${post.id.slice(0, 8)} ${decision === 'approve' ? 'approved' : 'rejected'}.`);
      } catch (err) {
        setError((err as Error)?.message || 'The growth decision could not be saved.');
      } finally {
        setBusyId(null);
      }
    },
    [token],
  );

  const confirmDecision = useCallback(
    (post: AdminOpsGrowthPost, decision: 'approve' | 'reject') => {
      Alert.alert(
        decision === 'approve' ? 'Approve this post?' : 'Reject this post?',
        `${post.productName}\n\n${post.caption.slice(0, 180)}${post.caption.length > 180 ? '…' : ''}\n\nPublishing is still a separate action with its own channel checks.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: decision.toUpperCase(),
            style: decision === 'reject' ? 'destructive' : 'default',
            onPress: () => void decide(post, decision),
          },
        ],
      );
    },
    [decide],
  );

  if (loading && posts.length === 0 && campaigns.length === 0) {
    return (
      <Screen>
        <Loading label="Reading the growth queue…" />
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
        <AdminSectionNav active="growth" />
        <AdminPageTitle
          eyebrow="Operations"
          title="Growth"
          detail="Manually written posts and paid boost requests. Approval records a decision; it does not publish."
        />

        <View style={styles.stats}>
          <StatTile label="Drafts" value={String(counts.draft)} tone={counts.draft > 0 ? 'warning' : 'default'} hint="Awaiting a decision" />
          <StatTile label="Approved" value={String(counts.approved)} hint="Ready to schedule" />
          <StatTile label="Published" value={String(counts.published)} hint="Confirmed channels" />
          <StatTile label="Failed" value={String(counts.failed)} tone={counts.failed > 0 ? 'danger' : 'default'} hint={`${counts.unknown} unknown`} />
        </View>

        {notice ? (
          <Card style={styles.notice}>
            <Muted>{notice}</Muted>
          </Card>
        ) : null}
        {error ? <ErrorCard message={error} onRetry={() => void load()} /> : null}

        <AdminSearch value={query} onChange={setQuery} placeholder="Search post, campaign or seller" />

        <View style={styles.tabs}>
          <TabButton label={`Posts ${posts.length}`} active={tab === 'posts'} onPress={() => setTab('posts')} />
          <TabButton label={`Boosts ${campaigns.length}`} active={tab === 'campaigns'} onPress={() => setTab('campaigns')} />
        </View>

        {tab === 'posts' ? (
          visiblePosts.length === 0 ? (
            <Card style={styles.empty}>
              <Ionicons name="megaphone-outline" size={24} color={colors.textFaint} />
              <Muted style={{ textAlign: 'center' }}>No growth posts match this search.</Muted>
            </Card>
          ) : (
            visiblePosts.map((post) => {
              const open = expanded === post.id;
              const busy = busyId === post.id;
              return (
                <Card key={post.id} style={{ gap: spacing.sm }}>
                  <Pressable
                    onPress={() => setExpanded(open ? null : post.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Inspect growth post for ${post.productName}`}
                    style={styles.rowHead}
                  >
                    <View style={styles.rowIcon}>
                      <Ionicons name="megaphone-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{post.productName || 'Growth post'}</Text>
                      <Text style={styles.rowMeta} numberOfLines={2}>{post.caption || 'No caption recorded.'}</Text>
                      <View style={styles.badges}>
                        <Badge label={post.status.toUpperCase()} tone={statusTone(post.status)} />
                        <Badge label={shortDate(post.createdAt)} />
                      </View>
                    </View>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textFaint} />
                  </Pressable>
                  {open ? (
                    <View style={styles.details}>
                      <Detail label="Share path" value={post.sharePath || 'not recorded'} mono />
                      <Detail label="Post ID" value={post.id} mono />
                      {post.status === 'draft' ? (
                        <View style={styles.actions}>
                          <Action
                            label="APPROVE"
                            icon="checkmark-circle-outline"
                            color={colors.success}
                            disabled={busy}
                            onPress={() => confirmDecision(post, 'approve')}
                          />
                          <Action
                            label="REJECT"
                            icon="close-circle-outline"
                            color={colors.danger}
                            disabled={busy}
                            onPress={() => confirmDecision(post, 'reject')}
                          />
                        </View>
                      ) : (
                        <Muted>This post has already been decided. Publishing and scheduling stay on the web console.</Muted>
                      )}
                    </View>
                  ) : null}
                </Card>
              );
            })
          )
        ) : visibleCampaigns.length === 0 ? (
          <Card style={styles.empty}>
            <Ionicons name="trending-up-outline" size={24} color={colors.textFaint} />
            <Muted style={{ textAlign: 'center' }}>No boost requests match this search.</Muted>
          </Card>
        ) : (
          visibleCampaigns.map((campaign) => (
            <Card key={campaign.id} style={styles.campaign}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {campaign.sellerName || campaign.sellerId}
                </Text>
                <Text style={styles.rowMeta}>
                  {money(campaign.budget, campaign.currency)} budget · {shortDate(campaign.createdAt)}
                </Text>
              </View>
              <Badge label={campaign.status.toUpperCase()} tone={statusTone(campaign.status)} />
            </Card>
          ))
        )}

        <Text style={styles.footnote}>
          Publishing requires a configured channel and remains on the web console. Nothing is posted
          from this screen.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Text style={[styles.tabText, active && { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={[styles.detailValue, mono && styles.mono]} numberOfLines={3}>{value}</Text>
    </View>
  );
}

function Action({ label, icon, color, onPress, disabled }: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; onPress: () => void; disabled?: boolean }) {
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
  tabs: { flexDirection: 'row', gap: spacing.xs },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  tabText: { ...type.caption, color: colors.textMuted, fontWeight: '700' },
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
  rowMeta: { ...type.caption, color: colors.textMuted, fontSize: 11.5, lineHeight: 16 },
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
  campaign: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  footnote: { ...type.caption, color: colors.textFaint, fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
