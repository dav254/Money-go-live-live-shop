/**
 * ADMIN COMMAND CENTRE — shared UI.
 *
 * Access is a two-layer thing and this file is explicit about it:
 *   • the app shows these screens only when the signed-in profile says admin,
 *   • every request carries the Firebase token, and the server re-checks the
 *     admin role. Hiding a button is not security; the gate below merely avoids
 *     showing a screen whose data would be refused.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Badge, Body, Card, Muted, Screen, Button } from '../ui';
import { colors, radius, spacing, type } from '../../theme';
import { useAuth } from '../../lib/auth';
import type { AdminCheck, AdminCheckState } from '../../lib/api';

export function AdminGate({ children }: { children: (token: string) => React.ReactNode }) {
  const { status, profile, getToken } = useAuth();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const isAdmin = (profile?.userRole ?? '').toLowerCase() === 'admin';

  useEffect(() => {
    if (status !== 'signedIn' || !isAdmin) {
      setToken(null);
      return;
    }
    let alive = true;
    setFailure(null);
    getToken()
      .then((value) => {
        if (alive) setToken(value);
      })
      .catch(() => {
        if (alive) setFailure('Your session could not be verified. Sign in again.');
      });
    return () => {
      alive = false;
    };
  }, [status, isAdmin, getToken]);

  if (status === 'loading') {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Muted>Checking access…</Muted>
        </View>
      </Screen>
    );
  }

  if (status === 'signedOut') {
    return (
      <Screen>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={32} color={colors.textMuted} />
          <Body style={{ textAlign: 'center' }}>Sign in with an administrator account to open the Command Centre.</Body>
          <Button label="Sign in" onPress={() => router.replace('/sign-in')} />
        </View>
      </Screen>
    );
  }

  if (!isAdmin) {
    return (
      <Screen>
        <View style={styles.center}>
          <Ionicons name="shield-outline" size={32} color={colors.textMuted} />
          <Body style={{ textAlign: 'center' }}>
            This area is for Vidnov administrators. Your account does not have access.
          </Body>
          <Muted style={{ textAlign: 'center' }}>
            Access is enforced by the Vidnov backend, not by this screen.
          </Muted>
        </View>
      </Screen>
    );
  }

  if (!token) {
    return (
      <Screen>
        <View style={styles.center}>
          {failure ? (
            <>
              <Ionicons name="alert-circle-outline" size={30} color={colors.warning} />
              <Body style={{ textAlign: 'center' }}>{failure}</Body>
              <Button label="Sign in again" onPress={() => router.replace('/sign-in')} />
            </>
          ) : (
            <>
              <ActivityIndicator color={colors.primary} />
              <Muted>Securing the connection…</Muted>
            </>
          )}
        </View>
      </Screen>
    );
  }

  return <>{children(token)}</>;
}

export const STATE_COLORS: Record<AdminCheckState, string> = {
  online: colors.success,
  degraded: colors.warning,
  offline: colors.danger,
  unknown: colors.textMuted,
};

export function stateTone(state: AdminCheckState): 'success' | 'warning' | 'danger' | 'neutral' {
  if (state === 'online') return 'success';
  if (state === 'degraded') return 'warning';
  if (state === 'offline') return 'danger';
  return 'neutral';
}

export function StatePill({ state }: { state: AdminCheckState }) {
  return <Badge label={state.toUpperCase()} tone={stateTone(state)} />;
}

export function Dot({ state }: { state: AdminCheckState }) {
  return <View style={[styles.dot, { backgroundColor: STATE_COLORS[state] }]} />;
}

/** A relative timestamp that never hides the check: "not checked" stays said. */
export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return 'never';
  const diff = Date.now() - then;
  if (diff < 0) return 'just now';
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(then).toLocaleDateString();
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return '—';
  return new Date(at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function shortDigest(value: string, length = 12): string {
  if (!value) return '—';
  return value.length <= length ? value : `${value.slice(0, length)}…`;
}

/** Shared status card used by Home, Ollama, Paperclip and System. */
export function CheckCard({ check, onPress }: { check: AdminCheck; onPress?: () => void }) {
  const content = (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.row}>
            <Dot state={check.state} />
            <Text style={styles.cardTitle}>{check.label}</Text>
          </View>
          <Text style={styles.detail}>{check.detail}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <StatePill state={check.state} />
          <Text style={styles.when}>{formatWhen(check.checkedAt)}</Text>
        </View>
      </View>
      {check.figures?.length ? (
        <View style={styles.figures}>
          {check.figures.map((figure) => (
            <View key={figure.label} style={styles.figure}>
              <Text style={styles.figureLabel}>{figure.label}</Text>
              <Text style={styles.figureValue} numberOfLines={1}>
                {figure.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {onPress ? (
        <View style={styles.cardAction}>
          <Text style={styles.cardActionText}>Open</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </View>
      ) : null}
    </Card>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${check.label}`}>
      {content}
    </Pressable>
  );
}

export function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card style={{ borderColor: 'rgba(240, 68, 56, 0.4)' }}>
      <View style={styles.row}>
        <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
        <Text style={[styles.cardTitle, { color: colors.text }]}>Something went wrong</Text>
      </View>
      <Text style={styles.detail}>{message}</Text>
      {onRetry ? <Button label="TRY AGAIN" variant="outline" onPress={onRetry} style={{ marginTop: spacing.md }} /> : null}
    </Card>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      <Muted>{label}</Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  loading: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  card: { gap: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { ...type.bodyStrong, color: colors.text },
  detail: { ...type.caption, color: colors.textMuted, lineHeight: 18, marginTop: 2 },
  when: { ...type.caption, color: colors.textFaint, fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  figures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: 2,
  },
  figure: { minWidth: 90, flexGrow: 1 },
  figureLabel: { ...type.caption, color: colors.textFaint, fontSize: 11 },
  figureValue: { ...type.caption, color: colors.text, fontWeight: '600' },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    marginTop: 2,
  },
  cardActionText: { ...type.caption, color: colors.primary, fontWeight: '700' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 3 },
  metaLabel: { ...type.caption, color: colors.textMuted },
  metaValue: { ...type.caption, color: colors.text, flex: 1, textAlign: 'right' },
  banner: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 77, 46, 0.35)',
  },
  bannerText: { ...type.caption, color: colors.text, flex: 1, lineHeight: 18 },
  sectionLabel: {
    ...type.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: 11,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
});

/** The recurring "nothing was executed" banner. */
export function NotExecutedBanner({ text }: { text?: string }) {
  return (
    <View style={styles.banner}>
      <Ionicons name="information-circle-outline" size={17} color={colors.primary} />
      <Text style={styles.bannerText}>
        {text ??
          'This is a generated report. Nothing was executed, changed, installed or deployed.'}
      </Text>
    </View>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}
