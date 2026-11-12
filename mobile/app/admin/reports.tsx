/**
 * TASK REPORTS — the full history of instruction runs.
 *
 * Each row states whether the task completed and that nothing was executed.
 * Opening one shows every field the founder asked for, including empty
 * "files inspected" sections, which are empty because the model has no access.
 */
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';

import { Badge, Button, Card, Muted, Screen } from '../../src/components/ui';
import { AdminGate, ErrorCard, formatWhen, Loading, SectionLabel } from '../../src/components/admin/kit';
import { ReportView, reportToText } from '../../src/components/admin/report-view';
import { colors, spacing, type } from '../../src/theme';
import { adminAi, type AdminReport, type AdminReportSummary } from '../../src/lib/api';

function tone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'completed') return 'success';
  if (status === 'running') return 'warning';
  if (status === 'failed') return 'danger';
  return 'neutral';
}

export default function ReportsScreen() {
  return <AdminGate>{(token) => <ReportsBody token={token} />}</AdminGate>;
}

function ReportsBody({ token }: { token: string }) {
  const [reports, setReports] = useState<AdminReportSummary[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminReport | null>(null);
  const [opening, setOpening] = useState(false);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        const result = await adminAi.reports.list(token);
        setReports(result.reports);
        setAvailable(result.available);
        setError(result.error ?? null);
      } catch (err) {
        setError((err as Error)?.message || 'Report history could not be read.');
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

  const open = useCallback(
    async (id: string) => {
      setOpening(true);
      setError(null);
      try {
        const result = await adminAi.reports.get(token, id);
        setSelected(result.report);
      } catch (err) {
        setError((err as Error)?.message || 'That report could not be opened.');
      } finally {
        setOpening(false);
      }
    },
    [token],
  );

  const copy = useCallback(async () => {
    if (!selected) return;
    await Clipboard.setStringAsync(reportToText(selected));
    Alert.alert('Copied', 'The complete report is on your clipboard.');
  }, [selected]);

  const share = useCallback(async () => {
    if (!selected) return;
    await Share.share({ message: reportToText(selected), title: selected.title });
  }, [selected]);

  if (loading && reports.length === 0 && !selected) {
    return (
      <Screen>
        <Loading label="Reading report history…" />
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
        {selected ? (
          <>
            <Pressable
              onPress={() => setSelected(null)}
              style={styles.backRow}
              accessibilityRole="button"
              accessibilityLabel="Back to all reports"
            >
              <Ionicons name="arrow-back" size={16} color={colors.primary} />
              <Text style={styles.backText}>ALL REPORTS</Text>
            </Pressable>
            <ReportView report={selected} onCopy={() => void copy()} onShare={() => void share()} />
            <Button label="BACK TO REPORTS" variant="outline" onPress={() => setSelected(null)} />
          </>
        ) : (
          <>
            {error ? <ErrorCard message={error} onRetry={() => void load()} /> : null}

            {!available ? (
              <Card style={{ borderColor: 'rgba(245, 165, 36, 0.35)' }}>
                <Muted>
                  Report history is unavailable because the local store is not configured on this
                  server. Instructions can still generate reports, but they will not be saved.
                </Muted>
              </Card>
            ) : null}

            <SectionLabel>HISTORY</SectionLabel>
            {reports.length === 0 ? (
              <Card style={styles.empty}>
                <Ionicons name="documents-outline" size={26} color={colors.textFaint} />
                <Muted style={{ textAlign: 'center', lineHeight: 19 }}>
                  No reports yet. Send an instruction from the Instruction Desk.
                </Muted>
              </Card>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {reports.map((report) => (
                  <Pressable
                    key={report.id}
                    onPress={() => void open(report.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open report ${report.title}`}
                    disabled={opening}
                  >
                    <Card style={{ gap: 5 }}>
                      <View style={styles.rowHead}>
                        <Text style={styles.rowTitle} numberOfLines={2}>
                          {report.title}
                        </Text>
                        <Badge label={report.status.toUpperCase()} tone={tone(report.status)} />
                      </View>
                      <Text style={styles.preview} numberOfLines={2}>
                        {report.preview || report.error || 'No output.'}
                      </Text>
                      <View style={styles.rowFoot}>
                        <Text style={styles.meta}>{report.model}</Text>
                        <Text style={styles.meta}>{formatWhen(report.startedAt)}</Text>
                        <Text style={styles.executed}>NOT EXECUTED</Text>
                      </View>
                    </Card>
                  </Pressable>
                ))}
              </View>
            )}

            {opening ? <Loading label="Opening report…" /> : null}
            <Button
              label={refreshing ? 'REFRESHING…' : 'REFRESH REPORTS'}
              variant="outline"
              icon="refresh-outline"
              loading={refreshing}
              onPress={() => void load('refresh')}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { ...type.caption, color: colors.primary, fontWeight: '800', fontSize: 11, letterSpacing: 0.6 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rowTitle: { ...type.bodyStrong, color: colors.text, flex: 1 },
  preview: { ...type.caption, color: colors.textMuted, lineHeight: 17 },
  rowFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  meta: { ...type.caption, color: colors.textFaint, fontSize: 11 },
  executed: {
    ...type.caption,
    color: colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginLeft: 'auto',
  },
});
