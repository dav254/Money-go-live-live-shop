/**
 * ADMIN · DEVELOPER
 *
 * The VPS-facing side: live checks, Ollama, Paperclip and the real OpenCode
 * bridge. Every agent, task count and error below comes from the server probe.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { Badge, Card, Muted, Screen, StatTile } from '../../src/components/ui';
import {
  AdminGate,
  CheckCard,
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
  type AdminCheck,
  type AdminOpenCodeOverview,
  type AdminOverview,
} from '../../src/lib/api';

const TOOLS: Array<{
  title: string;
  detail: string;
  href: '/admin/system' | '/admin/ollama' | '/admin/paperclip' | '/admin/chat' | '/admin/instructions' | '/admin/tasks';
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { title: 'System monitor', detail: 'Every live service check', href: '/admin/system', icon: 'pulse-outline' },
  { title: 'OpenCode tasks', detail: 'Agents, approvals and real progress', href: '/admin/tasks', icon: 'git-branch-outline' },
  { title: 'Ollama', detail: 'The model brain on the VPS', href: '/admin/ollama', icon: 'hardware-chip-outline' },
  { title: 'Paperclip', detail: 'Verified agents only', href: '/admin/paperclip', icon: 'people-outline' },
  { title: 'AI chat', detail: 'Test the model connection', href: '/admin/chat', icon: 'chatbubbles-outline' },
  { title: 'Instruction Desk', detail: 'Generate a diagnostic report', href: '/admin/instructions', icon: 'terminal-outline' },
];

export default function AdminDeveloperScreen() {
  return <AdminGate>{(token) => <DeveloperBody token={token} />}</AdminGate>;
}

function DeveloperBody({ token }: { token: string }) {
  const router = useRouter();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [openCode, setOpenCode] = useState<AdminOpenCodeOverview | null>(null);
  const [signals, setSignals] = useState<AdminCheck[]>([]);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemError, setSystemError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      const [overviewResult, systemResult, openCodeResult] = await Promise.allSettled([
        adminAi.overview(token),
        adminAi.system(token),
        adminOpenCode.overview(token),
      ]);
      if (overviewResult.status === 'fulfilled') {
        setOverview(overviewResult.value);
        setError(null);
      } else {
        setError((overviewResult.reason as Error)?.message || 'Developer status could not be loaded.');
      }
      if (systemResult.status === 'fulfilled') {
        setSignals(systemResult.value.signals);
        setCheckedAt(systemResult.value.checkedAt);
        setSystemError(null);
      } else {
        setSystemError(
          (systemResult.reason as Error)?.message || 'System checks could not be loaded.',
        );
      }
      if (openCodeResult.status === 'fulfilled') {
        setOpenCode(openCodeResult.value);
      } else {
        setOpenCode(null);
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

  if (loading && !overview && signals.length === 0) {
    return (
      <Screen>
        <Loading label="Reading VPS signals…" />
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
        <AdminSectionNav active="developer" />
        <AdminPageTitle
          eyebrow="Developer"
          title="VPS & integrations"
          detail="Live probes for the services this app actually talks to — Ollama, Paperclip, system checks and the OpenCode coding bridge."
        />

        {error ? <ErrorCard message={error} onRetry={() => void load()} /> : null}
        {systemError ? <ErrorCard message={systemError} onRetry={() => void load()} /> : null}

        <View style={styles.stats}>
          <StatTile
            label="Ollama"
            value={overview?.configuration.ollama.configured ? 'Configured' : 'Not set'}
            tone={overview?.configuration.ollama.configured ? 'default' : 'warning'}
            hint={overview?.assistant.model ?? 'no model'}
            onPress={() => router.push('/admin/ollama')}
          />
          <StatTile
            label="Agents"
            value={overview?.configuration.paperclip.configured ? 'Paperclip' : 'Not set'}
            tone={overview?.configuration.paperclip.configured ? 'default' : 'warning'}
            hint="verified agent bridge"
            onPress={() => router.push('/admin/paperclip')}
          />
          <StatTile
            label="System checks"
            value={String(signals.length)}
            hint={checkedAt ? `at ${formatWhen(checkedAt)}` : 'not taken'}
            onPress={() => router.push('/admin/system')}
          />
          <StatTile
            label="OpenCode"
            value={
              !openCode?.status.configured
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

        <SectionLabel>OPENCODE AGENTS</SectionLabel>
        <Card style={styles.opencode}>
          <View style={styles.opencodeHead}>
            <View style={styles.opencodeIcon}>
              <Ionicons name="git-branch-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.opencodeTitle}>
                {!openCode
                  ? 'Status unavailable'
                  : !openCode.status.configured
                    ? 'Not configured on the server'
                    : openCode.status.reachable
                      ? 'OpenCode bridge live'
                      : 'OpenCode unreachable'}
              </Text>
              <Text style={styles.opencodeMeta}>
                {openCode
                  ? openCode.status.detail
                  : 'The server did not return an OpenCode status.'}
              </Text>
            </View>
            <StatePill state={openCode?.status.state ?? 'unknown'} />
          </View>

          {openCode?.status.configured ? (
            <View style={styles.figures}>
              <Figure label="Version" value={openCode.status.version ?? '—'} />
              <Figure label="Agent" value={openCode.status.agent} />
              <Figure label="Model" value={openCode.status.model ?? 'agent default'} />
              <Figure label="Workspace" value={openCode.status.workspaceConfigured ? 'isolated' : 'default'} />
            </View>
          ) : null}

          {openCode?.status.error ? (
            <Text style={styles.opencodeError}>{openCode.status.error}</Text>
          ) : null}

          {openCode?.status.agents.length ? (
            <View style={{ gap: spacing.sm }}>
              {openCode.status.agents.map((agent) => (
                <View key={agent.name} style={styles.agentRow}>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={styles.agentName}>{agent.name}</Text>
                    <Text style={styles.agentDetail} numberOfLines={2}>
                      {agent.description || `${agent.mode} agent`}
                      {agent.model ? ` · ${agent.model}` : ''}
                    </Text>
                  </View>
                  {agent.name === openCode.status.agent ? <Badge label="DEFAULT" tone="primary" /> : null}
                  {agent.bashPermission ? <Badge label={`bash ${agent.bashPermission}`} /> : null}
                </View>
              ))}
            </View>
          ) : (
            <Muted>
              {openCode?.status.configured
                ? 'No agents were reported. Task creation stays unavailable until one is listed.'
                : 'Add the server-side OpenCode address and credentials to enable agents. They are never stored in the APK.'}
            </Muted>
          )}

          <Pressable
            onPress={() => router.push('/admin/tasks')}
            accessibilityRole="button"
            accessibilityLabel="Open the OpenCode task centre"
            style={styles.openTasks}
          >
            <Text style={styles.openTasksText}>OPEN TASK CENTRE</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.primary} />
          </Pressable>
        </Card>

        <SectionLabel>TOOLS</SectionLabel>
        <View style={styles.grid}>
          {TOOLS.map((tool) => (
            <Pressable
              key={tool.href}
              onPress={() => router.push(tool.href)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${tool.title}`}
              style={({ pressed }) => [styles.tile, pressed && { borderColor: colors.primary }]}
            >
              <View style={styles.tileIcon}>
                <Ionicons name={tool.icon} size={20} color={colors.primary} />
              </View>
              <Text style={styles.tileTitle}>{tool.title}</Text>
              <Text style={styles.tileDetail}>{tool.detail}</Text>
            </Pressable>
          ))}
        </View>

        <SectionLabel>LIVE CHECKS</SectionLabel>
        {signals.map((signal) => (
          <CheckCard key={signal.id} check={signal} />
        ))}
        {signals.length === 0 ? (
          <Card>
            <Muted>No checks were performed.</Muted>
          </Card>
        ) : null}

        <Card style={styles.note}>
          <View style={styles.noteHead}>
            <Ionicons name="lock-closed-outline" size={17} color={colors.primary} />
            <Text style={styles.noteTitle}>No shell from the phone</Text>
          </View>
          <Muted style={{ lineHeight: 19 }}>
            This app can ask the model for text, record approvals and start an approved OpenCode
            session. It cannot open a shell, send arbitrary commands, deploy, restart a service or
            change credentials. OpenCode runs only in its configured workspace with its own
            permission settings.
          </Muted>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={styles.figureValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  opencode: { gap: spacing.sm, borderColor: 'rgba(245, 165, 36, 0.35)' },
  opencodeHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  opencodeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(245, 165, 36, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  opencodeTitle: { ...type.bodyStrong, color: colors.text },
  opencodeMeta: { ...type.caption, color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  opencodeBody: { ...type.caption, color: colors.textMuted, lineHeight: 19 },
  opencodeError: { ...type.caption, color: colors.danger, fontSize: 11, lineHeight: 16 },
  figures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  figure: { minWidth: 100, flexGrow: 1, gap: 1 },
  figureLabel: { ...type.caption, color: colors.textFaint, fontSize: 10 },
  figureValue: { ...type.caption, color: colors.text, fontSize: 11.5, fontWeight: '700' },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  agentName: { ...type.caption, color: colors.text, fontSize: 12, fontWeight: '700' },
  agentDetail: { ...type.caption, color: colors.textMuted, fontSize: 10.5, lineHeight: 15 },
  openTasks: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: spacing.xs },
  openTasksText: { ...type.caption, color: colors.primary, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5 },
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
  note: { gap: spacing.xs, borderStyle: 'dashed' },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  noteTitle: { ...type.bodyStrong, color: colors.text },
});
