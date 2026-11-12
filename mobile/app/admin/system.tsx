/**
 * SYSTEM MONITOR — one row per service, each with its own check time.
 *
 * A missing monitoring endpoint is UNKNOWN. An unreachable service is OFFLINE.
 * The two are never collapsed into a green tick.
 */
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Badge, Button, Card, Muted, Screen } from '../../src/components/ui';
import {
  AdminGate,
  CheckCard,
  ErrorCard,
  formatTime,
  Loading,
  SectionLabel,
} from '../../src/components/admin/kit';
import { colors, spacing, type } from '../../src/theme';
import { adminAi, type AdminCheck } from '../../src/lib/api';

export default function SystemScreen() {
  return <AdminGate>{(token) => <SystemBody token={token} />}</AdminGate>;
}

function SystemBody({ token }: { token: string }) {
  const [signals, setSignals] = useState<AdminCheck[]>([]);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        const snapshot = await adminAi.system(token);
        setSignals(snapshot.signals);
        setCheckedAt(snapshot.checkedAt);
        setError(null);
      } catch (err) {
        setError((err as Error)?.message || 'The system status could not be read.');
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

  if (loading && signals.length === 0) {
    return (
      <Screen>
        <Loading label="Checking services…" />
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
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Live checks</Text>
            <Muted>Last snapshot {checkedAt ? formatTime(checkedAt) : 'not taken'}</Muted>
          </View>
          <Badge label="SERVER-MEASURED" />
        </View>

        {error ? <ErrorCard message={error} onRetry={() => void load()} /> : null}

        <SectionLabel>SERVICES</SectionLabel>
        {signals.map((signal) => (
          <CheckCard key={signal.id} check={signal} />
        ))}
        {signals.length === 0 ? (
          <Card>
            <Muted>No checks were performed.</Muted>
          </Card>
        ) : null}

        <Card style={{ gap: spacing.xs }}>
          <Text style={styles.legendTitle}>How to read this</Text>
          <Text style={styles.legend}>
            ONLINE — the probe succeeded.{'\n'}
            DEGRADED — the service answered but is not fully usable.{'\n'}
            OFFLINE — the probe ran and failed.{'\n'}
            UNKNOWN — no probe was performed (not configured or not supported).
          </Text>
        </Card>

        <Button
          label={refreshing ? 'CHECKING…' : 'RUN CHECKS AGAIN'}
          variant="outline"
          icon="pulse-outline"
          loading={refreshing}
          onPress={() => void load('refresh')}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { ...type.title, color: colors.text, fontSize: 20 },
  legendTitle: { ...type.bodyStrong, color: colors.text },
  legend: { ...type.caption, color: colors.textMuted, lineHeight: 19 },
});
