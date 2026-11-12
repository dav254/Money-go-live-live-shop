/**
 * APPROVALS — the founder's gate, not an execution button.
 *
 * Approving records a decision bound to the digest shown here. It does not run
 * the action; the API says so and this screen repeats it. Risk and rollback are
 * displayed only when the proposal actually carries them — never invented.
 */
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { Badge, Button, Card, Muted, Screen } from '../../src/components/ui';
import {
  AdminGate,
  ErrorCard,
  formatWhen,
  Loading,
  SectionLabel,
  shortDigest,
} from '../../src/components/admin/kit';
import { colors, radius, spacing, type } from '../../src/theme';
import { adminAi, type AdminApprovalPolicy, type AdminProposal } from '../../src/lib/api';

export default function ApprovalsScreen() {
  return <AdminGate>{(token) => <ApprovalsBody token={token} />}</AdminGate>;
}

function ApprovalsBody({ token }: { token: string }) {
  const [pending, setPending] = useState<AdminProposal[]>([]);
  const [policy, setPolicy] = useState<AdminApprovalPolicy | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        const result = await adminAi.approvals.list(token);
        setPending(result.pending);
        setPolicy(result.policy);
        setCheckedAt(result.checkedAt);
        setError(result.error ?? null);
      } catch (err) {
        setError((err as Error)?.message || 'Approvals could not be read.');
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

  const decide = useCallback(
    async (proposal: AdminProposal, decision: 'approve' | 'reject') => {
      setBusyId(proposal.id);
      setError(null);
      setNotice(null);
      try {
        const result = await adminAi.approvals.decide(token, {
          id: proposal.id,
          decision,
          digest: proposal.actionDigest,
        });
        setPending((prev) => prev.filter((item) => item.id !== proposal.id));
        setNotice(result.message);
      } catch (err) {
        setError((err as Error)?.message || 'The decision could not be recorded.');
      } finally {
        setBusyId(null);
      }
    },
    [token],
  );

  const confirmApprove = useCallback(
    (proposal: AdminProposal) => {
      Alert.alert(
        'Approve this proposal?',
        `${proposal.title}\n\nAction: ${String((proposal.action as { type?: string })?.type ?? proposal.kind)}\nDigest: ${shortDigest(proposal.actionDigest, 20)}\n\nApproval records your decision. It does not execute the action.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Approve', style: 'destructive', onPress: () => void decide(proposal, 'approve') },
        ],
      );
    },
    [decide],
  );

  if (loading && pending.length === 0) {
    return (
      <Screen>
        <Loading label="Reading approvals…" />
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
        <Card style={styles.policyHero}>
          <View style={styles.policyHead}>
            <Ionicons name="shield-checkmark-outline" size={19} color={colors.primary} />
            <Text style={styles.policyTitle}>Founder approval required</Text>
          </View>
          <Text style={styles.policyBody}>
            {policy?.statement ??
              'Every action that modifies code, files, databases or production services needs your approval.'}
          </Text>
          <Badge label="NO AUTONOMOUS EXECUTION" tone="primary" />
        </Card>

        {error ? <ErrorCard message={error} onRetry={() => void load()} /> : null}
        {notice ? (
          <Card style={{ borderColor: 'rgba(47, 191, 113, 0.4)' }}>
            <Text style={styles.notice}>{notice}</Text>
            <Text style={styles.noticeFoot}>Nothing was executed by this decision.</Text>
          </Card>
        ) : null}

        <SectionLabel>PENDING ({pending.length})</SectionLabel>
        {pending.length === 0 ? (
          <Card style={styles.empty}>
            <Ionicons name="checkmark-done-outline" size={26} color={colors.textFaint} />
            <Muted style={{ textAlign: 'center' }}>
              Nothing is waiting for approval.
              {checkedAt ? ` Checked ${formatWhen(checkedAt)}.` : ''}
            </Muted>
          </Card>
        ) : (
          pending.map((proposal) => {
            const open = expanded === proposal.id;
            const busy = busyId === proposal.id;
            const actionType = String((proposal.action as { type?: string })?.type ?? proposal.kind);
            return (
              <Card key={proposal.id} style={{ gap: spacing.sm }}>
                <Pressable
                  onPress={() => setExpanded(open ? null : proposal.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Inspect proposal ${proposal.title}`}
                  style={{ gap: 4 }}
                >
                  <View style={styles.proposalHead}>
                    <Text style={styles.proposalTitle}>{proposal.title}</Text>
                    <Badge label={proposal.kind.toUpperCase()} />
                  </View>
                  <Text style={styles.proposalSummary}>{proposal.summary}</Text>
                  <Text style={styles.proposalMeta}>
                    {proposal.requestedBy.name} · {proposal.requestedBy.department} ·{' '}
                    {formatWhen(proposal.createdAt)}
                  </Text>
                  <View style={styles.inspectRow}>
                    <Text style={styles.inspectText}>{open ? 'HIDE DETAILS' : 'INSPECT ACTION'}</Text>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
                  </View>
                </Pressable>

                {open ? (
                  <View style={styles.details}>
                    <Detail label="Proposed action" value={actionType} />
                    <Detail
                      label="Affected resources"
                      value={JSON.stringify(proposal.action.params ?? {}, null, 2)}
                      mono
                    />
                    <Detail
                      label="Risk / rollback"
                      value="Not supplied by this proposal. Review the parameters and the action type before approving; do not approve an action you cannot reverse."
                    />
                    <Detail label="Verification" value="The approved action still requires a person to run it and verify the result. Approval itself performs no check." />
                    <Detail label="Digest" value={proposal.actionDigest} mono />
                  </View>
                ) : null}

                <View style={styles.buttons}>
                  <Button
                    label="REJECT"
                    variant="outline"
                    onPress={() => void decide(proposal, 'reject')}
                    disabled={busy}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label={busy ? 'RECORDING…' : 'APPROVE'}
                    onPress={() => confirmApprove(proposal)}
                    loading={busy}
                    style={{ flex: 1.3 }}
                  />
                </View>
                <Text style={styles.digestNote}>Bound to digest {shortDigest(proposal.actionDigest, 16)}</Text>
              </Card>
            );
          })
        )}

        <SectionLabel>POLICY</SectionLabel>
        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.listTitle}>Allowed without approval</Text>
          {(policy?.allowedWithoutApproval ?? ['Read-only status checks']).map((item) => (
            <Text key={item} style={styles.listItem}>
              • {item}
            </Text>
          ))}
          <Text style={[styles.listTitle, { marginTop: spacing.sm }]}>Never automatic</Text>
          {(policy?.neverAutomatic ?? []).map((item) => (
            <Text key={item} style={styles.listItem}>
              • {item}
            </Text>
          ))}
        </Card>

        <Button
          label={refreshing ? 'REFRESHING…' : 'REFRESH APPROVALS'}
          variant="outline"
          icon="refresh-outline"
          loading={refreshing}
          onPress={() => void load('refresh')}
        />
      </ScrollView>
    </Screen>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={[styles.detailValue, mono && styles.mono]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  policyHero: { gap: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary },
  policyHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  policyTitle: { ...type.heading, color: colors.text },
  policyBody: { ...type.caption, color: colors.textMuted, lineHeight: 19 },
  notice: { ...type.caption, color: colors.text, lineHeight: 19 },
  noticeFoot: { ...type.caption, color: colors.textFaint, fontSize: 11, marginTop: 2 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  proposalHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  proposalTitle: { ...type.bodyStrong, color: colors.text, flex: 1, fontSize: 16 },
  proposalSummary: { ...type.caption, color: colors.textMuted, lineHeight: 18 },
  proposalMeta: { ...type.caption, color: colors.textFaint, fontSize: 11 },
  inspectRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  inspectText: { ...type.caption, color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  details: {
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  detailLabel: { ...type.caption, color: colors.textFaint, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' },
  detailValue: { ...type.caption, color: colors.text, lineHeight: 18 },
  mono: { fontFamily: 'monospace', fontSize: 11.5, backgroundColor: colors.surfaceRaised, padding: spacing.sm, borderRadius: radius.sm },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  digestNote: { ...type.caption, color: colors.textFaint, fontSize: 10, textAlign: 'center' },
  listTitle: { ...type.bodyStrong, color: colors.text, fontSize: 14 },
  listItem: { ...type.caption, color: colors.textMuted, lineHeight: 18 },
});
