/**
 * ADMIN · INTELLIGENCE
 *
 * The AI side of the console: model status, chat, instruction reports and the
 * founder approval gate. The model never executes a change from this screen.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { Badge, Card, Muted, Screen, StatTile } from '../../src/components/ui';
import {
  AdminGate,
  ErrorCard,
  formatWhen,
  Loading,
  SectionLabel,
  StatePill,
} from '../../src/components/admin/kit';
import { AdminPageTitle, AdminSectionNav } from '../../src/components/admin/ops-ui';
import { colors, radius, spacing, type } from '../../src/theme';
import {
  adminAi,
  adminOpenCode,
  type AdminOpenCodeOverview,
  type AdminOverview,
} from '../../src/lib/api';

const LINKS: Array<{
  title: string;
  detail: string;
  href: '/admin/chat' | '/admin/instructions' | '/admin/reports' | '/admin/approvals' | '/admin/ollama' | '/admin/paperclip' | '/admin/tasks';
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { title: 'AI Chat', detail: 'Talk to the configured model', href: '/admin/chat', icon: 'chatbubbles-outline' },
  { title: 'Task Centre', detail: 'Plan, approve and start OpenCode work', href: '/admin/tasks', icon: 'git-branch-outline' },
  { title: 'Instruction Desk', detail: 'Generate a written technical report', href: '/admin/instructions', icon: 'terminal-outline' },
  { title: 'Task Reports', detail: 'Every generated report, with timestamps', href: '/admin/reports', icon: 'document-text-outline' },
  { title: 'Approvals', detail: 'Review proposals before anything runs', href: '/admin/approvals', icon: 'shield-checkmark-outline' },
  { title: 'Ollama', detail: 'Model, version and installed weights', href: '/admin/ollama', icon: 'hardware-chip-outline' },
  { title: 'Paperclip', detail: 'Verified agent list only', href: '/admin/paperclip', icon: 'people-outline' },
];

export default function AdminIntelligenceScreen() {
  return <AdminGate>{(token) => <IntelligenceBody token={token} />}</AdminGate>;
}

function IntelligenceBody({ token }: { token: string }) {
  const router = useRouter();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [openCode, setOpenCode] = useState<AdminOpenCodeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCodeError, setOpenCodeError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      const [aiResult, codeResult] = await Promise.allSettled([
        adminAi.overview(token),
        adminOpenCode.overview(token),
      ]);
      if (aiResult.status === 'fulfilled') {
        setOverview(aiResult.value);
        setError(null);
      } else {
        setError((aiResult.reason as Error)?.message || 'Intelligence status could not be loaded.');
      }
      if (codeResult.status === 'fulfilled') {
        setOpenCode(codeResult.value);
        setOpenCodeError(null);
      } else {
        setOpenCodeError(
          (codeResult.reason as Error)?.message || 'OpenCode status could not be loaded.',
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

  if (loading && !overview) {
    return (
      <Screen>
        <Loading label="Checking the model…" />
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
        <AdminSectionNav active="intelligence" />
        <AdminPageTitle
          eyebrow="Intelligence"
          title="AI operations"
          detail="Chat, reports and the founder gate. The model proposes; it never executes a change from this phone."
        />

        {error ? <ErrorCard message={error} onRetry={() => void load()} /> : null}
        {openCodeError ? <ErrorCard message={openCodeError} onRetry={() => void load()} /> : null}

        {overview ? (
          <>
            <Card style={styles.hero}>
              <View style={styles.heroHead}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.heroLabel}>ASSISTANT</Text>
                  <Text style={styles.heroModel}>{overview.assistant.model ?? 'No model configured'}</Text>
                </View>
                <StatePill state={overview.assistant.state} />
              </View>
              <Text style={styles.heroDetail}>{overview.assistant.detail}</Text>
              <Text style={styles.heroMeta}>
                Last successful contact: {formatWhen(overview.assistant.lastOkAt)}
              </Text>
            </Card>

            <View style={styles.stats}>
              <StatTile
                label="Approvals"
                value={String(overview.approvals.pending)}
                tone={overview.approvals.pending > 0 ? 'warning' : 'default'}
                hint={overview.approvals.available ? 'pending proposals' : 'unavailable'}
                onPress={() => router.push('/admin/approvals')}
              />
              <StatTile
                label="Reports"
                value={String(overview.reports.items.length)}
                hint={overview.reports.available ? 'recent reports' : 'history unavailable'}
                onPress={() => router.push('/admin/reports')}
              />
              <StatTile
                label="Ollama"
                value={overview.configuration.ollama.configured ? 'Set' : 'Not set'}
                tone={overview.configuration.ollama.configured ? 'default' : 'warning'}
                hint="server-side connection"
                onPress={() => router.push('/admin/ollama')}
              />
              <StatTile
                label="Paperclip"
                value={overview.configuration.paperclip.configured ? 'Set' : 'Not set'}
                tone={overview.configuration.paperclip.configured ? 'default' : 'warning'}
                hint="agent bridge"
                onPress={() => router.push('/admin/paperclip')}
              />
              <StatTile
                label="OpenCode"
                value={
                  !openCode
                    ? '—'
                    : !openCode.status.configured
                      ? 'Not set'
                      : openCode.status.state === 'online'
                        ? `${openCode.status.agents.length} agents`
                        : openCode.status.state.toUpperCase()
                }
                tone={openCode?.status.state === 'online' ? 'default' : 'warning'}
                hint={openCode?.status.model ?? 'coding agent'}
                onPress={() => router.push('/admin/tasks')}
              />
            </View>
          </>
        ) : null}

        <SectionLabel>TOOLS</SectionLabel>
        <View style={styles.grid}>
          {LINKS.map((link) => (
            <Pressable
              key={link.href}
              onPress={() => router.push(link.href)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${link.title}`}
              style={({ pressed }) => [styles.tile, pressed && { borderColor: colors.primary }]}
            >
              <View style={styles.tileIcon}>
                <Ionicons name={link.icon} size={20} color={colors.primary} />
              </View>
              <Text style={styles.tileTitle}>{link.title}</Text>
              <Text style={styles.tileDetail}>{link.detail}</Text>
            </Pressable>
          ))}
        </View>

        <SectionLabel>APPROVAL POLICY</SectionLabel>
        <Card style={{ gap: spacing.sm }}>
          <View style={styles.policyHead}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
            <Text style={styles.policyTitle}>No autonomous execution</Text>
            <Badge label="FOUNDER GATE" tone="primary" />
          </View>
          <Muted style={{ lineHeight: 19 }}>
            Approving a proposal records your decision. It does not run the action. Code, files,
            databases, deployments and service restarts still need a separate human action with its
            own verification.
          </Muted>
        </Card>

        <Card style={styles.note}>
          <Muted style={{ lineHeight: 19 }}>
            OpenCode is a separate server-side coding agent. Vidnov Intelligence prepares the plan;
            the Task Centre starts it only after founder approval. The app shows the agents, session
            state, files and tests that OpenCode actually reports — never invented progress.
          </Muted>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  hero: { gap: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary },
  heroHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  heroLabel: { ...type.caption, color: colors.textMuted, fontSize: 10, letterSpacing: 1.2, fontWeight: '700' },
  heroModel: { ...type.title, color: colors.text, fontSize: 19 },
  heroDetail: { ...type.caption, color: colors.textMuted, lineHeight: 19 },
  heroMeta: { ...type.caption, color: colors.textFaint, fontSize: 11 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  tileTitle: { ...type.bodyStrong, color: colors.text },
  tileDetail: { ...type.caption, color: colors.textFaint, fontSize: 11, lineHeight: 15 },
  policyHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  policyTitle: { ...type.bodyStrong, color: colors.text, flex: 1 },
  note: { borderStyle: 'dashed' },
});
