/**
 * One complete task report.
 *
 * The order is the founder's own: title, instruction, model, times, result,
 * errors, files, verification, next step — and a banner that makes the
 * proposed-vs-completed distinction impossible to miss.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, Muted } from '../ui';
import { colors, spacing, type } from '../../theme';
import type { AdminReport } from '../../lib/api';
import { formatTime, MetaRow, NotExecutedBanner } from './kit';

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'completed') return 'success';
  if (status === 'running') return 'warning';
  if (status === 'failed') return 'danger';
  return 'neutral';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function ReportView({
  report,
  onCopy,
  onShare,
}: {
  report: AdminReport;
  onCopy?: () => void;
  onShare?: () => void;
}) {
  const changed = report.filesChanged ?? [];
  const inspected = report.filesInspected ?? [];
  const files = [...changed.map((file) => `changed: ${file}`), ...inspected.map((file) => `inspected: ${file}`)];

  return (
    <View style={{ gap: spacing.md }}>
      <NotExecutedBanner text={report.note} />

      <Card style={{ gap: spacing.sm }}>
        <View style={styles.head}>
          <Text style={styles.title}>{report.title}</Text>
          <Badge label={report.status.toUpperCase()} tone={statusTone(report.status)} />
        </View>
        <MetaRow label="Model" value={report.model} />
        <MetaRow label="Started" value={formatTime(report.startedAt)} />
        <MetaRow label="Completed" value={report.completedAt ? formatTime(report.completedAt) : 'not completed'} />
        <MetaRow
          label="Duration"
          value={report.latencyMs ? `${Math.round(report.latencyMs / 100) / 10}s` : '—'}
        />
        <MetaRow label="Execution" value="Not executed — report only" />
      </Card>

      <Section title="INSTRUCTION SUBMITTED">
        <Card>
          <Text selectable style={styles.body}>
            {report.instruction}
          </Text>
        </Card>
      </Section>

      <Section title="ACTUAL RESULT">
        <Card>
          {report.result ? (
            <Text selectable style={styles.body}>
              {report.result}
            </Text>
          ) : (
            <Muted>No result was produced.</Muted>
          )}
        </Card>
      </Section>

      {report.error ? (
        <Section title="ERROR">
          <Card style={{ borderColor: 'rgba(240, 68, 56, 0.4)' }}>
            <Text selectable style={[styles.body, { color: colors.danger }]}>
              {report.error}
            </Text>
          </Card>
        </Section>
      ) : null}

      <Section title="FILES INSPECTED / CHANGED">
        <Card>
          <Text style={styles.body}>
            {files.length > 0
              ? files.join('\n')
              : 'None. This task had no repository or filesystem access, so no file was read or changed.'}
          </Text>
        </Card>
      </Section>

      <Section title="VERIFICATION">
        <Card>
          <Text selectable style={styles.body}>
            {report.verification}
          </Text>
        </Card>
      </Section>

      <Section title="NEXT RECOMMENDED STEP">
        <Card>
          <Text selectable style={styles.body}>
            {report.nextStep ?? 'No next step was labelled by the model. Review the report above.'}
          </Text>
        </Card>
      </Section>

      {onCopy || onShare ? (
        <View style={styles.actions}>
          {onCopy ? <Button label="COPY REPORT" variant="outline" icon="copy-outline" onPress={onCopy} style={{ flex: 1 }} /> : null}
          {onShare ? <Button label="SHARE" variant="outline" icon="share-outline" onPress={onShare} style={{ flex: 1 }} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Plain-text export used by Copy and Share so both contain the same report. */
export function reportToText(report: AdminReport): string {
  return [
    `VIDNOV AI TASK REPORT — ${report.title}`,
    `Status: ${report.status}`,
    `Execution: NOT EXECUTED (report only)`,
    `Model: ${report.model}`,
    `Started: ${formatTime(report.startedAt)}`,
    `Completed: ${report.completedAt ? formatTime(report.completedAt) : 'not completed'}`,
    '',
    'INSTRUCTION',
    report.instruction,
    '',
    'RESULT',
    report.result || '(no result)',
    ...(report.error ? ['', 'ERROR', report.error] : []),
    '',
    'FILES INSPECTED / CHANGED',
    (report.filesChanged ?? []).length || (report.filesInspected ?? []).length
      ? [...(report.filesChanged ?? []).map((f) => `changed: ${f}`), ...(report.filesInspected ?? []).map((f) => `inspected: ${f}`)].join('\n')
      : 'None — this task had no repository or filesystem access.',
    '',
    'VERIFICATION',
    report.verification,
    '',
    'NEXT RECOMMENDED STEP',
    report.nextStep ?? 'Not labelled by the model.',
    '',
    report.note,
  ].join('\n');
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...type.heading, color: colors.text, flex: 1 },
  section: { gap: spacing.xs },
  sectionTitle: {
    ...type.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontSize: 11,
    fontWeight: '700',
  },
  body: { ...type.body, color: colors.text, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
