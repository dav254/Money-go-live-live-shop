/**
 * OLLAMA — measured, never assumed.
 *
 * "Installed" is not treated as "running": the screen distinguishes a
 * configured server, a reachable server and a reachable server that actually
 * has the configured model.
 */
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { Badge, Button, Card, Muted, Screen } from '../../src/components/ui';
import {
  AdminGate,
  ErrorCard,
  formatTime,
  formatWhen,
  Loading,
  MetaRow,
  SectionLabel,
  StatePill,
} from '../../src/components/admin/kit';
import { colors, spacing, type } from '../../src/theme';
import { adminAi, type AdminOllamaStatus } from '../../src/lib/api';

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

export default function OllamaScreen() {
  return <AdminGate>{(token) => <OllamaScreenBody token={token} />}</AdminGate>;
}

function OllamaScreenBody({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<AdminOllamaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        setStatus(await adminAi.ollama(token));
        setError(null);
      } catch (err) {
        setError((err as Error)?.message || 'The Ollama status could not be read.');
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
        <Loading label="Probing Ollama…" />
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
                  <Text style={styles.heroModel}>{status.activeModel}</Text>
                </View>
                <StatePill state={status.state} />
              </View>
              <Text style={styles.heroDetail}>
                {!status.configured
                  ? 'Ollama is not configured on this server, so no probe was performed.'
                  : status.state === 'online'
                    ? `Reachable${status.version ? ` · version ${status.version}` : ''}.`
                    : status.state === 'degraded'
                      ? 'Reachable, but the configured model was not found.'
                      : 'Not reachable from the Vidnov server.'}
              </Text>
              <View style={styles.figures}>
                <Figure label="Model health" value={status.activeModelInstalled ? 'Installed' : status.reachable ? 'Missing' : 'Not checked'} />
                <Figure label="Latency" value={status.latencyMs === null ? '—' : `${status.latencyMs} ms`} />
                <Figure label="Models" value={String(status.models.length)} />
              </View>
            </Card>

            <Card style={{ gap: spacing.xs }}>
              <SectionLabel>DETAILS</SectionLabel>
              <MetaRow label="Configured" value={status.configured ? 'Yes' : 'No'} />
              <MetaRow label="Server reachable" value={status.reachable ? 'Yes' : 'No'} />
              <MetaRow label="Active model" value={status.activeModel} />
              <MetaRow label="Active model installed" value={status.activeModelInstalled ? 'Yes' : 'No'} />
              <MetaRow label="Version" value={status.version ?? 'not reported'} />
              <MetaRow label="API key in use" value={status.hasApiKey ? 'Yes (kept on server)' : 'No'} />
              <MetaRow label="Checked" value={formatTime(status.checkedAt)} />
              <MetaRow label="Last successful connection" value={status.lastOkAt ? formatTime(status.lastOkAt) : 'none recorded'} />
            </Card>

            {status.error ? (
              <Card style={{ borderColor: 'rgba(240, 68, 56, 0.4)', gap: 4 }}>
                <View style={styles.errorHead}>
                  <Ionicons name="alert-circle-outline" size={17} color={colors.danger} />
                  <Text style={styles.errorTitle}>Connection error</Text>
                </View>
                <Text style={styles.errorBody}>{status.error}</Text>
                <Text style={styles.errorHint}>
                  The app never contacts Ollama directly. The server attempted this probe at{' '}
                  {formatWhen(status.checkedAt)}.
                </Text>
              </Card>
            ) : null}

            <SectionLabel>AVAILABLE MODELS</SectionLabel>
            {status.models.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                {status.models.map((model) => {
                  const active =
                    model.name === status.activeModel || model.name.startsWith(`${status.activeModel}:`);
                  return (
                    <Card key={model.name} style={styles.modelRow}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.modelName}>{model.name}</Text>
                        <Text style={styles.modelMeta}>
                          {formatSize(model.sizeBytes)}
                          {model.modifiedAt ? ` · modified ${new Date(model.modifiedAt).toLocaleDateString()}` : ''}
                        </Text>
                      </View>
                      {active ? <Badge label="ACTIVE" tone="primary" /> : null}
                    </Card>
                  );
                })}
              </View>
            ) : (
              <Card>
                <Muted>
                  {status.configured && status.reachable
                    ? 'Ollama reported no installed models.'
                    : 'No model list is available because the connection did not succeed.'}
                </Muted>
              </Card>
            )}

            <Card style={{ gap: spacing.sm }}>
              <Muted style={{ lineHeight: 19 }}>
                Prompts are sent through Vidnov’s authenticated admin API. The Ollama address and API
                key never reach this phone.
              </Muted>
              <Button label="SEND A PROMPT" icon="chatbubbles-outline" onPress={() => router.push('/admin/chat')} />
            </Card>
          </>
        ) : (
          <Muted>No status could be read.</Muted>
        )}

        <Button
          label={refreshing ? 'PROBING…' : 'REFRESH CONNECTION'}
          variant="outline"
          icon="refresh-outline"
          loading={refreshing}
          onPress={() => void load('refresh')}
        />
      </ScrollView>
    </Screen>
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
  hero: { gap: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary },
  heroHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  heroLabel: { ...type.caption, color: colors.textMuted, fontSize: 10, letterSpacing: 1.2, fontWeight: '700' },
  heroModel: { ...type.title, color: colors.text, fontSize: 19 },
  heroDetail: { ...type.caption, color: colors.textMuted, lineHeight: 19 },
  figures: {
    flexDirection: 'row',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  figure: { flex: 1, gap: 2 },
  figureLabel: { ...type.caption, color: colors.textFaint, fontSize: 10 },
  figureValue: { ...type.caption, color: colors.text, fontWeight: '700' },
  errorHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  errorTitle: { ...type.bodyStrong, color: colors.text },
  errorBody: { ...type.caption, color: colors.danger, lineHeight: 18 },
  errorHint: { ...type.caption, color: colors.textFaint, fontSize: 11, lineHeight: 16 },
  modelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  modelName: { ...type.bodyStrong, color: colors.text },
  modelMeta: { ...type.caption, color: colors.textFaint, fontSize: 11 },
});
