/**
 * ADMIN · OPENCODE TASK DETAIL
 *
 * Shows what OpenCode actually reported: session state, steps, assistant
 * output, changed files, test/tool results and errors. While a task is active
 * this screen polls the server; it never simulates progress when OpenCode is
 * unreachable.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Badge, Card, Muted, Screen } from '../../../src/components/ui';
import { AdminGate, ErrorCard, formatWhen, Loading, SectionLabel } from '../../../src/components/admin/kit';
import { shortDate, statusTone } from '../../../src/components/admin/ops-ui';
import { colors, radius, spacing, type } from '../../../src/theme';
import {
  adminOpenCode,
  type AdminOpenCodeChangedFile,
  type AdminOpenCodeTaskDetail,
  type AdminOpenCodeTest,
  type AdminOpenCodeTodo,
  type AdminOpenCodeTool,
} from '../../../src/lib/api';

export default function AdminTaskDetailScreen() {
  return <AdminGate>{(token) => <TaskBody token={token} />}</AdminGate>;
}

function TaskBody({ token }: { token: string }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const [detail, setDetail] = useState<AdminOpenCodeTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [aborting, setAborting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(
    async (mode: 'initial' | 'poll' | 'refresh' = 'initial') => {
      if (!id) {
        setError('No task id was supplied.');
        setLoading(false);
        return;
      }
      if (mode === 'refresh') setRefreshing(true);
      try {
        const result = await adminOpenCode.task(token, id);
        if (!mounted.current) return;
        setDetail(result);
        setError(null);
      } catch (err) {
        if (!mounted.current) return;
        setError((err as Error)?.message || 'The task detail could not be loaded.');
      } finally {
        if (!mounted.current) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, token],
  );

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const active =
    detail?.task.status === 'queued' ||
    detail?.task.status === 'running' ||
    detail?.sessionStatus === 'busy' ||
    detail?.sessionStatus === 'retry';

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      void load('poll');
    }, 4_500);
    return () => clearInterval(timer);
  }, [active, load]);

  const abort = useCallback(() => {
    if (!detail || aborting) return;
    Alert.alert(
      'Stop this OpenCode task?',
      'This asks OpenCode to abort the current session. Work already written to the workspace is not rolled back automatically.',
      [
        { text: 'Keep running', style: 'cancel' },
        {
          text: 'STOP',
          style: 'destructive',
          onPress: async () => {
            setAborting(true);
            try {
              await adminOpenCode.abort(token, detail.task.id);
              await load('refresh');
            } catch (err) {
              setError((err as Error)?.message || 'OpenCode did not accept the abort.');
            } finally {
              setAborting(false);
            }
          },
        },
      ],
    );
  }, [aborting, detail, load, token]);

  if (loading && !detail) {
    return (
      <Screen>
        <Loading label="Reading OpenCode task…" />
      </Screen>
    );
  }

  if (!detail) {
    return (
      <Screen>
        <View style={styles.content}>
          <ErrorCard message={error || 'Task not found.'} onRetry={() => void load()} />
          <Pressable onPress={() => router.push('/admin/tasks')} accessibilityRole="button" style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>BACK TO TASK CENTRE</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const { task } = detail;
  const progress =
    task.progress && task.progress.total > 0
      ? Math.min(100, Math.round((task.progress.completed / task.progress.total) * 100))
      : 0;

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
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.eyebrow}>OPENCODE TASK · {task.agent.toUpperCase()}</Text>
            <Text style={styles.title}>{task.title}</Text>
            <Text style={styles.meta}>
              {task.model || 'agent default'} · started {formatWhen(task.createdAt)}
            </Text>
          </View>
          <Badge label={task.status.toUpperCase()} tone={statusTone(task.status)} />
        </View>

        {error ? <ErrorCard message={error} onRetry={() => void load()} /> : null}
        {detail.syncError ? (
          <Card style={styles.warnCard}>
            <View style={styles.inline}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
              <Text style={styles.warnText}>{detail.syncError}</Text>
            </View>
            <Muted style={{ fontSize: 11 }}>
              The status below is the last state OpenCode confirmed. Nothing is being simulated.
            </Muted>
          </Card>
        ) : null}

        <Card style={{ gap: spacing.sm }}>
          <View style={styles.rowHead}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.label}>SESSION</Text>
              <Text style={styles.value}>
                {detail.sessionStatus === 'busy'
                  ? 'OpenCode is working'
                  : detail.sessionStatus === 'retry'
                    ? 'OpenCode is retrying'
                    : detail.sessionStatus === 'idle'
                      ? 'Session idle'
                      : 'Session state unavailable'}
              </Text>
            </View>
            {active ? <Badge label="LIVE" tone="primary" /> : <Badge label="FINISHED" />}
          </View>
          {task.progress && task.progress.total > 0 ? (
            <>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {task.progress.completed} of {task.progress.total} steps complete
              </Text>
            </>
          ) : (
            <Muted>No step list has been reported yet.</Muted>
          )}
          <View style={styles.figures}>
            <Figure label="Files changed" value={String(detail.changedFiles.length)} />
            <Figure label="Tests found" value={String(detail.tests.length)} />
            <Figure label="Updated" value={shortDate(task.updatedAt)} />
          </View>
          {active ? (
            <Pressable
              onPress={abort}
              disabled={aborting}
              accessibilityRole="button"
              accessibilityLabel="Stop OpenCode task"
              style={[styles.stopButton, aborting && { opacity: 0.5 }]}
            >
              <Ionicons name="stop-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.stopText}>{aborting ? 'STOPPING…' : 'STOP TASK'}</Text>
            </Pressable>
          ) : null}
        </Card>

        {detail.error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>OPENCODE REPORTED AN ERROR</Text>
            <Text style={styles.errorBody}>{detail.error}</Text>
          </Card>
        ) : null}

        <SectionLabel>STEPS</SectionLabel>
        {detail.todos.length === 0 ? (
          <Card style={styles.empty}>
            <Muted>OpenCode has not published a step list for this session.</Muted>
          </Card>
        ) : (
          <Card style={{ gap: spacing.sm }}>
            {detail.todos.map((todo) => <TodoRow key={todo.id} todo={todo} />)}
          </Card>
        )}

        <SectionLabel>OUTPUT</SectionLabel>
        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.output} selectable>
            {detail.output || 'No assistant answer has been reported yet.'}
          </Text>
        </Card>

        <SectionLabel>CHANGED FILES</SectionLabel>
        {detail.changedFiles.length === 0 ? (
          <Card style={styles.empty}>
            <Muted>OpenCode has not reported any changed files.</Muted>
          </Card>
        ) : (
          <Card style={{ gap: 8 }}>
            {detail.changedFiles.map((file) => <ChangedFileRow key={file.file} file={file} />)}
          </Card>
        )}

        <SectionLabel>TEST RESULTS</SectionLabel>
        {detail.tests.length === 0 ? (
          <Card style={styles.empty}>
            <Muted>No test commands were found in OpenCode's tool calls.</Muted>
          </Card>
        ) : (
          detail.tests.map((test, index) => <TestCard key={`${test.command}-${index}`} test={test} />)
        )}

        {detail.tools.length ? (
          <>
            <SectionLabel>TOOL ACTIVITY</SectionLabel>
            <Card style={{ gap: spacing.sm }}>
              {detail.tools.slice(-8).map((tool, index) => (
                <ToolRow key={`${tool.tool}-${index}`} tool={tool} />
              ))}
            </Card>
          </>
        ) : null}

        <SectionLabel>REVIEW</SectionLabel>
        <Card style={{ gap: spacing.sm }}>
          <Muted style={{ lineHeight: 18 }}>
            Read the changed files and test results before approving a next step. This task did not
            deploy, change credentials or touch production data.
          </Muted>
          <Pressable
            onPress={() => router.push('/admin/tasks')}
            accessibilityRole="button"
            style={styles.secondaryButton}
          >
            <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.secondaryText}>PREPARE A FOLLOW-UP TASK</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/admin/chat')}
            accessibilityRole="button"
            style={styles.secondaryButton}
          >
            <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
            <Text style={styles.secondaryText}>ASK INTELLIGENCE TO EXPLAIN</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function TodoRow({ todo }: { todo: AdminOpenCodeTodo }) {
  const complete = todo.status === 'completed';
  const active = todo.status === 'in_progress';
  return (
    <View style={styles.inlineStart}>
      <Ionicons
        name={complete ? 'checkmark-circle' : active ? 'ellipse' : 'ellipse-outline'}
        size={16}
        color={complete ? colors.success : active ? colors.primary : colors.textFaint}
        style={{ marginTop: 1 }}
      />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[styles.todoText, complete && { color: colors.textMuted }]}>{todo.content}</Text>
        <Text style={styles.todoMeta}>
          {todo.status.replace('_', ' ')} · {todo.priority}
        </Text>
      </View>
    </View>
  );
}

function ChangedFileRow({ file }: { file: AdminOpenCodeChangedFile }) {
  return (
    <View style={styles.fileRow}>
      <Ionicons name="document-text-outline" size={15} color={colors.textMuted} />
      <Text style={styles.fileText} numberOfLines={2}>{file.file}</Text>
      <Text style={styles.additions}>+{file.additions}</Text>
      <Text style={styles.deletions}>−{file.deletions}</Text>
    </View>
  );
}

function TestCard({ test }: { test: AdminOpenCodeTest }) {
  return (
    <Card style={{ gap: 6 }}>
      <View style={styles.rowHead}>
        <Text style={styles.command} numberOfLines={2}>{test.command}</Text>
        <Badge
          label={test.status.toUpperCase()}
          tone={test.status === 'completed' ? 'success' : test.status === 'error' ? 'danger' : 'warning'}
        />
      </View>
      {test.output ? (
        <Text style={styles.testOutput} selectable numberOfLines={8}>{test.output}</Text>
      ) : null}
    </Card>
  );
}

function ToolRow({ tool }: { tool: AdminOpenCodeTool }) {
  return (
    <View style={{ gap: 2 }}>
      <View style={styles.fileRow}>
        <Ionicons name="construct-outline" size={14} color={colors.textFaint} />
        <Text style={styles.toolName} numberOfLines={1}>{tool.tool}</Text>
        <Text style={styles.toolStatus}>{tool.status}</Text>
      </View>
      {tool.command ? <Text style={styles.toolCommand} numberOfLines={2}>{tool.command}</Text> : null}
      {tool.error ? <Text style={styles.toolError} numberOfLines={3}>{tool.error}</Text> : null}
    </View>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={styles.figureValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  eyebrow: { ...type.caption, color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { ...type.title, color: colors.text, fontSize: 22, lineHeight: 27 },
  meta: { ...type.caption, color: colors.textMuted, fontSize: 11.5, lineHeight: 16 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  label: { ...type.caption, color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  value: { ...type.bodyStrong, color: colors.text, fontSize: 16 },
  figures: { flexDirection: 'row', gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm },
  figure: { flex: 1, gap: 1 },
  figureLabel: { ...type.caption, color: colors.textFaint, fontSize: 10 },
  figureValue: { ...type.caption, color: colors.text, fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 7, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  progressText: { ...type.caption, color: colors.textMuted, fontSize: 11 },
  stopButton: {
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(240,68,68,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  stopText: { ...type.caption, color: colors.danger, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  warnCard: { borderColor: 'rgba(240,170,50,0.4)', gap: 4 },
  inline: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  inlineStart: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  warnText: { ...type.caption, color: colors.warning, fontSize: 11.5, lineHeight: 17, flex: 1 },
  errorCard: { borderColor: 'rgba(240,68,68,0.45)', gap: 5 },
  errorTitle: { ...type.caption, color: colors.danger, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  errorBody: { ...type.body, color: colors.text, fontSize: 13, lineHeight: 19 },
  empty: { alignItems: 'flex-start' },
  output: { ...type.body, color: colors.text, fontSize: 13, lineHeight: 20 },
  todoText: { ...type.body, color: colors.text, fontSize: 13, lineHeight: 18 },
  todoMeta: { ...type.caption, color: colors.textFaint, fontSize: 10 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fileText: { ...type.caption, color: colors.text, fontSize: 11.5, flex: 1 },
  additions: { ...type.caption, color: colors.success, fontSize: 10.5, fontWeight: '700' },
  deletions: { ...type.caption, color: colors.danger, fontSize: 10.5, fontWeight: '700' },
  command: { ...type.caption, color: colors.text, fontSize: 11.5, fontWeight: '700', flex: 1 },
  testOutput: {
    ...type.caption,
    color: colors.textMuted,
    fontSize: 10.5,
    lineHeight: 15,
    fontFamily: 'monospace',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  toolName: { ...type.caption, color: colors.text, fontSize: 11.5, fontWeight: '700', flex: 1 },
  toolStatus: { ...type.caption, color: colors.textFaint, fontSize: 10 },
  toolCommand: { ...type.caption, color: colors.textMuted, fontSize: 10.5, marginLeft: 20 },
  toolError: { ...type.caption, color: colors.danger, fontSize: 10.5, marginLeft: 20 },
  secondaryButton: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  secondaryText: { ...type.caption, color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
});
