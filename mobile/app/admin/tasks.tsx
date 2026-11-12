/**
 * ADMIN · OPENCODE TASK CENTRE
 *
 * The controlled workflow: describe → prepare a plan → founder approval →
 * start the approved task → watch real OpenCode progress. This screen never
 * creates a session from free text; only an approved proposal can start one.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { Badge, Card, Muted, Screen, StatTile } from '../../src/components/ui';
import { AdminGate, ErrorCard, formatWhen, Loading, SectionLabel, StatePill } from '../../src/components/admin/kit';
import { AdminPageTitle, AdminSectionNav, shortDate, statusTone } from '../../src/components/admin/ops-ui';
import { colors, radius, spacing, type } from '../../src/theme';
import {
  adminOpenCode,
  type AdminOpenCodeApprovedProposal,
  type AdminOpenCodeOverview,
  type AdminOpenCodeTask,
} from '../../src/lib/api';

export default function AdminTasksScreen() {
  return <AdminGate>{(token) => <TasksBody token={token} />}</AdminGate>;
}

function TasksBody({ token }: { token: string }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ draft?: string }>();
  const [overview, setOverview] = useState<AdminOpenCodeOverview | null>(null);
  const [title, setTitle] = useState('');
  const [request, setRequest] = useState('');
  const [agent, setAgent] = useState<string | null>(null);
  const [prepared, setPrepared] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const appliedDraft = useRef<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        const result = await adminOpenCode.overview(token);
        setOverview(result);
        setAgent((current) => current ?? result.status.agent ?? null);
        setError(null);
      } catch (err) {
        setError((err as Error)?.message || 'The OpenCode task centre could not be loaded.');
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

  useEffect(() => {
    if (typeof params.draft !== 'string' || !params.draft.trim()) return;
    if (appliedDraft.current === params.draft) return;
    appliedDraft.current = params.draft;
    setRequest(params.draft);
  }, [params.draft]);

  const prepare = useCallback(async () => {
    if (request.trim().length < 8 || planning) return;
    setPlanning(true);
    setError(null);
    setPrepared(false);
    setNotice(null);
    try {
      const result = await adminOpenCode.plan(token, {
        request: request.trim(),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(agent ? { agent } : {}),
      });
      setPrepared(true);
      setNotice(
        `${result.notice} Plan prepared with ${result.model}. Approve it in the inbox, then start it below.`,
      );
    } catch (err) {
      setError((err as Error)?.message || 'The plan could not be prepared.');
    } finally {
      setPlanning(false);
    }
  }, [agent, planning, request, title, token]);

  const start = useCallback(
    (proposal: AdminOpenCodeApprovedProposal) => {
      Alert.alert(
        'Start this approved task?',
        `${proposal.title}\n\nOpenCode will work in the configured isolated workspace. It cannot deploy or change credentials.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'START',
            onPress: async () => {
              setStartingId(proposal.id);
              setError(null);
              try {
                const result = await adminOpenCode.start(token, proposal.id);
                setNotice(result.notice);
                router.push(`/admin/task/${result.task.id}`);
                void load('refresh');
              } catch (err) {
                setError((err as Error)?.message || 'The task could not be started.');
              } finally {
                setStartingId(null);
              }
            },
          },
        ],
      );
    },
    [load, router, token],
  );

  if (loading && !overview) {
    return (
      <Screen>
        <Loading label="Checking OpenCode…" />
      </Screen>
    );
  }

  const status = overview?.status;
  const canStart = Boolean(status?.configured && status.workspaceConfigured);
  const approved = overview?.approvedProposals ?? [];
  const tasks = overview?.tasks ?? [];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
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
          eyebrow="Intelligence · OpenCode"
          title="Task centre"
          detail="Free text becomes a plan, the plan becomes an approval, and only an approved plan can start a coding session."
        />

        {error ? <ErrorCard message={error} onRetry={() => void load()} /> : null}
        {notice ? (
          <Card style={styles.notice}>
            <Muted style={{ lineHeight: 19 }}>{notice}</Muted>
          </Card>
        ) : null}

        {status ? (
          <Card style={styles.connection}>
            <View style={styles.connectionHead}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.connectionLabel}>OPENCODE CONNECTION</Text>
                <Text style={styles.connectionTitle}>
                  {status.configured ? (status.reachable ? 'Server reachable' : 'Server unreachable') : 'Not configured'}
                </Text>
              </View>
              <StatePill state={status.state} />
            </View>
            <Text style={styles.connectionDetail}>{status.detail}</Text>
            <View style={styles.connectionFigures}>
              <Figure label="Agent" value={status.agent} />
              <Figure label="Model" value={status.model || 'agent default'} />
              <Figure label="Workspace" value={status.workspaceConfigured ? 'isolated' : 'server default'} />
              <Figure label="Agents" value={String(status.agents.length)} />
            </View>
            {status.error ? <Text style={styles.errorText}>{status.error}</Text> : null}
            {!status.configured ? (
              <Muted style={{ lineHeight: 18 }}>
                The server needs the OpenCode address and credentials. They are never placed in the
                APK or shown on this screen.
              </Muted>
            ) : !status.workspaceConfigured ? (
              <Muted style={{ lineHeight: 18 }}>
                No isolated workspace is configured (OPENCODE_DIRECTORY). Starting a coding task is
                blocked until the server has an explicit worktree; the default directory is not used
                for AI work.
              </Muted>
            ) : null}
          </Card>
        ) : null}

        <View style={styles.stats}>
          <StatTile label="Awaiting start" value={String(approved.filter((p) => !p.started).length)} tone={approved.some((p) => !p.started) ? 'warning' : 'default'} hint="approved plans" />
          <StatTile label="Running" value={String(tasks.filter((t) => t.status === 'running' || t.status === 'queued').length)} hint="OpenCode sessions" />
          <StatTile label="Completed" value={String(tasks.filter((t) => t.status === 'completed').length)} hint="reported by OpenCode" />
          <StatTile label="Failed" value={String(tasks.filter((t) => t.status === 'failed').length)} tone={tasks.some((t) => t.status === 'failed') ? 'danger' : 'default'} hint="real failures" />
        </View>

        <SectionLabel>PREPARE A TASK</SectionLabel>
        <Card style={{ gap: spacing.sm }}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Short title (optional)"
            placeholderTextColor={colors.textFaint}
            style={styles.titleInput}
            maxLength={120}
            accessibilityLabel="Task title"
          />
          <TextInput
            value={request}
            onChangeText={setRequest}
            placeholder="Describe the development request. Be concrete about the expected behaviour, files or errors."
            placeholderTextColor={colors.textFaint}
            style={styles.requestInput}
            multiline
            textAlignVertical="top"
            maxLength={8000}
            accessibilityLabel="Development request"
          />
          <Text style={styles.counter}>{request.length.toLocaleString()} / 8,000</Text>

          <Text style={styles.fieldLabel}>CODING AGENT</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Pressable
              onPress={() => setAgent(null)}
              accessibilityRole="button"
              accessibilityState={{ selected: agent === null }}
              style={[styles.chip, agent === null && styles.chipActive]}
            >
              <Text style={[styles.chipText, agent === null && { color: colors.primary }]}>SERVER DEFAULT</Text>
            </Pressable>
            {(status?.agents ?? []).map((item) => (
              <Pressable
                key={item.name}
                onPress={() => setAgent(item.name)}
                accessibilityRole="button"
                accessibilityState={{ selected: agent === item.name }}
                style={[styles.chip, agent === item.name && styles.chipActive]}
              >
                <Text style={[styles.chipText, agent === item.name && { color: colors.primary }]}>
                  {item.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {status && !status.agentsAvailable ? (
            <Muted>The agent list could not be read; the server default will be used.</Muted>
          ) : null}

          <Pressable
            onPress={() => void prepare()}
            disabled={planning || request.trim().length < 8}
            accessibilityRole="button"
            accessibilityLabel="Prepare plan for approval"
            style={[styles.primaryButton, (planning || request.trim().length < 8) && { opacity: 0.5 }]}
          >
            <Ionicons name={planning ? 'hourglass-outline' : 'sparkles-outline'} size={17} color={colors.white} />
            <Text style={styles.primaryText}>{planning ? 'PREPARING PLAN…' : 'PREPARE FOR APPROVAL'}</Text>
          </Pressable>
          {prepared ? (
            <Pressable onPress={() => router.push('/admin/approvals')} accessibilityRole="button" style={styles.linkRow}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
              <Text style={styles.linkText}>OPEN APPROVAL INBOX</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.primary} />
            </Pressable>
          ) : null}
          <Text style={styles.hint}>
            The planner uses Ollama on the VPS. It cannot execute code; it produces a proposal with a
            frozen digest. Approval is separate.
          </Text>
        </Card>

        <SectionLabel>APPROVED TO RUN</SectionLabel>
        {approved.length === 0 ? (
          <Card style={styles.empty}>
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.textFaint} />
            <Muted style={{ textAlign: 'center' }}>
              No approved OpenCode plans yet. Prepare a plan above, then approve it in the inbox.
            </Muted>
          </Card>
        ) : (
          approved.map((proposal) => (
            <Card key={proposal.id} style={{ gap: spacing.sm }}>
              <View style={styles.rowHead}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.rowTitle} numberOfLines={2}>{proposal.title}</Text>
                  <Text style={styles.rowMeta} numberOfLines={2}>{proposal.summary}</Text>
                  <View style={styles.badges}>
                    <Badge label={proposal.started ? 'STARTED' : 'APPROVED'} tone={proposal.started ? 'success' : 'warning'} />
                    {proposal.agent ? <Badge label={proposal.agent} /> : null}
                    <Badge label={shortDate(proposal.decidedAt)} />
                  </View>
                </View>
              </View>
              {!proposal.started ? (
                <Pressable
                  onPress={() => start(proposal)}
                  disabled={startingId === proposal.id || !canStart}
                  accessibilityRole="button"
                  accessibilityLabel={`Start approved task ${proposal.title}`}
                  style={[styles.startButton, (startingId === proposal.id || !canStart) && { opacity: 0.5 }]}
                >
                  <Ionicons name="play-outline" size={16} color={colors.white} />
                  <Text style={styles.startText}>
                    {startingId === proposal.id ? 'STARTING…' : 'START APPROVED TASK'}
                  </Text>
                </Pressable>
              ) : (
                <Muted>This plan already has an OpenCode task in the history below.</Muted>
              )}
            </Card>
          ))
        )}

        <SectionLabel>DEVELOPMENT HISTORY</SectionLabel>
        {tasks.length === 0 ? (
          <Card style={styles.empty}>
            <Ionicons name="git-branch-outline" size={24} color={colors.textFaint} />
            <Muted style={{ textAlign: 'center' }}>No OpenCode tasks have been started.</Muted>
          </Card>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} onPress={() => router.push(`/admin/task/${task.id}`)} />)
        )}

        <Text style={styles.footnote}>
          Only approved plans can start. OpenCode's own permission settings still apply inside the
          workspace; this app does not auto-approve its shell or file permissions.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function TaskCard({ task, onPress }: { task: AdminOpenCodeTask; onPress: () => void }) {
  const progress =
    task.progress && task.progress.total > 0
      ? `${task.progress.completed}/${task.progress.total} steps`
      : null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open task ${task.title}`}>
      <Card style={{ gap: 6 }}>
        <View style={styles.rowHead}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.rowTitle} numberOfLines={2}>{task.title}</Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {task.agent}{task.model ? ` · ${task.model}` : ''} · {formatWhen(task.createdAt)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.textFaint} />
        </View>
        <View style={styles.badges}>
          <Badge label={task.status.toUpperCase()} tone={statusTone(task.status)} />
          {progress ? <Badge label={progress} /> : null}
          {task.changedFileCount ? <Badge label={`${task.changedFileCount} files`} /> : null}
        </View>
        {task.lastError ? <Text style={styles.taskError} numberOfLines={2}>{task.lastError}</Text> : null}
      </Card>
    </Pressable>
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
  notice: { borderColor: 'rgba(47, 191, 113, 0.35)' },
  connection: { gap: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary },
  connectionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  connectionLabel: { ...type.caption, color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  connectionTitle: { ...type.title, color: colors.text, fontSize: 18 },
  connectionDetail: { ...type.caption, color: colors.textMuted, lineHeight: 18 },
  connectionFigures: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm },
  figure: { minWidth: 100, flexGrow: 1, gap: 1 },
  figureLabel: { ...type.caption, color: colors.textFaint, fontSize: 10 },
  figureValue: { ...type.caption, color: colors.text, fontWeight: '700', fontSize: 11.5 },
  errorText: { ...type.caption, color: colors.danger, fontSize: 11, lineHeight: 16 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  titleInput: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    paddingHorizontal: spacing.md,
    ...type.body,
  },
  requestInput: {
    minHeight: 130,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    padding: spacing.md,
    ...type.body,
    lineHeight: 21,
  },
  counter: { ...type.caption, color: colors.textFaint, fontSize: 10, textAlign: 'right' },
  fieldLabel: { ...type.caption, color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: spacing.xs },
  chips: { gap: spacing.xs, paddingVertical: 2 },
  chip: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { ...type.caption, color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  primaryButton: {
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  primaryText: { ...type.bodyStrong, color: colors.white, fontSize: 13, letterSpacing: 0.3 },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: spacing.xs },
  linkText: { ...type.caption, color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  hint: { ...type.caption, color: colors.textFaint, fontSize: 10.5, lineHeight: 15 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowTitle: { ...type.bodyStrong, color: colors.text, fontSize: 15 },
  rowMeta: { ...type.caption, color: colors.textMuted, fontSize: 11.5, lineHeight: 16 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  startButton: {
    minHeight: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  startText: { ...type.caption, color: colors.white, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  taskError: { ...type.caption, color: colors.danger, fontSize: 10.5, lineHeight: 15 },
  footnote: { ...type.caption, color: colors.textFaint, fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
