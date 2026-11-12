/**
 * PAPERCLIP — only what the installation actually reports.
 *
 * No agent, task, report or progress figure is invented. The screen is
 * explicit about which Paperclip capabilities have been verified (an agent
 * list) and which have not (activity, task progress, reports, pending work in
 * Phase 1).
 */
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { Badge, Card, Muted, Screen } from '../../src/components/ui';
import {
  AdminGate,
  ErrorCard,
  formatTime,
  formatWhen,
  Loading,
  SectionLabel,
  StatePill,
} from '../../src/components/admin/kit';
import { colors, radius, spacing, type } from '../../src/theme';
import { adminAi, type AdminPaperclipStatus } from '../../src/lib/api';

export default function PaperclipScreen() {
  return <AdminGate>{(token) => <PaperclipBody token={token} />}</AdminGate>;
}

function PaperclipBody({ token }: { token: string }) {
  const [status, setStatus] = useState<AdminPaperclipStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        setStatus(await adminAi.paperclip(token));
        setError(null);
      } catch (err) {
        setError((err as Error)?.message || 'The Paperclip status could not be read.');
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

  if (loading && !status) {
    return (
      <Screen>
        <Loading label="Probing Paperclip…" />
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
        {error ? <ErrorCard message={error} onRetry={() => void load()} /> : null}

        {status ? (
          <>
            <Card style={styles.hero}>
              <View style={styles.heroHead}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.heroLabel}>CONNECTION</Text>
                  <Text style={styles.heroTitle}>Paperclip</Text>
                </View>
                <StatePill state={status.state} />
              </View>
              <Text style={styles.heroDetail}>{status.detail}</Text>
              <View style={styles.heroFoot}>
                <Text style={styles.heroFootText}>Checked {formatWhen(status.checkedAt)}</Text>
                <Text style={styles.heroFootText}>
                  {status.latencyMs === null ? '' : `${status.latencyMs} ms`}
                </Text>
              </View>
            </Card>

            {!status.configured ? (
              <Card style={styles.note}>
                <View style={styles.noteHead}>
                  <Ionicons name="help-circle-outline" size={17} color={colors.warning} />
                  <Text style={styles.noteTitle}>No Paperclip API is configured</Text>
                </View>
                <Text style={styles.noteBody}>
                  The installation may exist on the VPS, but Vidnov has no verified API address for
                  it, so this screen stays UNKNOWN rather than showing invented agents. Configure the
                  integration on the server to enable this section.
                </Text>
              </Card>
            ) : null}

            <SectionLabel>REGISTERED AGENTS</SectionLabel>
            {status.agentsAvailable && status.agents.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                {status.agents.map((agent) => (
                  <Card key={agent.id} style={{ gap: 6 }}>
                    <View style={styles.agentHead}>
                      <View style={styles.agentAvatar}>
                        <Text style={styles.agentInitial}>{agent.name.slice(0, 1).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.agentName}>{agent.name}</Text>
                        <Text style={styles.agentRole}>{agent.role ?? 'Role not reported'}</Text>
                      </View>
                      {agent.status ? <Badge label={agent.status.toUpperCase()} /> : null}
                    </View>
                    <Text style={styles.agentMeta}>
                      Last active: {agent.lastActiveAt ? formatTime(agent.lastActiveAt) : 'not reported'}
                    </Text>
                  </Card>
                ))}
              </View>
            ) : (
              <Card>
                <Muted>
                  {status.agentsAvailable
                    ? 'Paperclip is reachable and reports no registered agents.'
                    : 'No agent list is available from the verified API. Nothing is shown rather than guessing.'}
                </Muted>
              </Card>
            )}

            <SectionLabel>AGENT ACTIVITY</SectionLabel>
            <Unavailable
              available={status.activityAvailable}
              reason="Paperclip does not expose a verified activity endpoint to Vidnov yet."
            />

            <SectionLabel>TASK PROGRESS</SectionLabel>
            <Unavailable
              available={false}
              reason="No Paperclip task endpoint has been verified, so progress cannot be shown truthfully."
            />

            <SectionLabel>REPORTS</SectionLabel>
            <Unavailable
              available={status.reportsAvailable}
              reason="Paperclip reports are not available from the verified API. Use Task Reports for Vidnov AI reports."
            />

            <SectionLabel>PENDING WORK</SectionLabel>
            <Unavailable
              available={status.pendingAvailable}
              reason="Pending Paperclip work is not available from the verified API."
            />

            {status.error ? (
              <Card style={{ borderColor: 'rgba(240, 68, 56, 0.4)' }}>
                <Text style={styles.noteTitle}>Error</Text>
                <Text style={[styles.noteBody, { color: colors.danger }]}>{status.error}</Text>
              </Card>
            ) : null}
          </>
        ) : (
          <Muted>No status could be read.</Muted>
        )}
      </ScrollView>
    </Screen>
  );
}

function Unavailable({ available, reason }: { available: boolean; reason: string }) {
  if (available) return null;
  return (
    <Card style={styles.unavailable}>
      <Ionicons name="lock-closed-outline" size={16} color={colors.textFaint} />
      <Text style={styles.unavailableText}>{reason}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  hero: { gap: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary },
  heroHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  heroLabel: { ...type.caption, color: colors.textMuted, fontSize: 10, letterSpacing: 1.2, fontWeight: '700' },
  heroTitle: { ...type.title, color: colors.text, fontSize: 19 },
  heroDetail: { ...type.caption, color: colors.textMuted, lineHeight: 19 },
  heroFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  heroFootText: { ...type.caption, color: colors.textFaint, fontSize: 11 },
  note: { borderColor: 'rgba(245, 165, 36, 0.35)', gap: spacing.xs },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  noteTitle: { ...type.bodyStrong, color: colors.text },
  noteBody: { ...type.caption, color: colors.textMuted, lineHeight: 18 },
  agentHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  agentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentInitial: { ...type.bodyStrong, color: colors.primary },
  agentName: { ...type.bodyStrong, color: colors.text },
  agentRole: { ...type.caption, color: colors.textMuted, fontSize: 11 },
  agentMeta: { ...type.caption, color: colors.textFaint, fontSize: 11 },
  unavailable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderStyle: 'dashed',
  },
  unavailableText: { ...type.caption, color: colors.textMuted, flex: 1, lineHeight: 17 },
});
