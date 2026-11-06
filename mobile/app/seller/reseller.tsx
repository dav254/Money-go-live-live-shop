import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SellerHeader } from '../../src/components/seller/seller-header';
import {
  Badge,
  Button,
  Muted,
  Notice,
  Screen,
  SectionHeader,
} from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { useAuth } from '../../src/lib/auth';
import { SUPPORT_EMAIL } from '../../src/lib/config';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * RESELLER PROGRAMME.
 *
 * Status only, from the account's real role. There is no reseller earnings API
 * in this build, so no commission figure, referral count or payout estimate is
 * shown — an accepted reseller sees that they are one, and how to get in touch,
 * and nothing that could be mistaken for a statement.
 */
export default function SellerResellerScreen() {
  return (
    <RequireAuth>
      <Reseller />
    </RequireAuth>
  );
}

function Reseller() {
  const { profile } = useAuth();
  const role = (profile?.userRole ?? 'buyer').toLowerCase();
  const isReseller = role === 'reseller' || role === 'admin';

  return (
    <Screen>
      <SellerHeader title="Reseller programme" subtitle="Sell for Vidnov sellers" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.status}>
          <View style={styles.statusIcon}>
            <Ionicons name="git-network-outline" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.statusTitle}>
              {isReseller ? 'You are a Vidnov reseller' : 'Not a reseller yet'}
            </Text>
            <Badge label={role.toUpperCase()} tone={isReseller ? 'success' : 'warning'} />
          </View>
        </View>

        <SectionHeader title="How the programme works" />
        <View style={styles.list}>
          <Point text="Resellers share products they trust and earn a commission when a sale completes." />
          <Point text="Commission rates and payouts are agreed with the Vidnov team — they are not fixed by the app." />
          <Point text="A reseller account keeps full access to buyer and seller tools; nothing is taken away." />
        </View>

        {!isReseller ? (
          <Notice
            title="Joining is a manual review"
            body="Vidnov does not switch accounts to reseller automatically in the app. Message the team and they will review and enable it on your account."
          />
        ) : (
          <Notice
            tone="warning"
            title="Earnings are not shown here"
            body="This build has no reseller ledger endpoint. Your commission records are handled by the team until that API reaches the app."
          />
        )}

        <Button
          label="Contact the Vidnov team"
          icon="mail-outline"
          onPress={() =>
            void Linking.openURL(
              `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Vidnov reseller programme')}`,
            )
          }
        />
        <Muted style={styles.hint}>
          Anything you earn as a seller is separate from reseller commission and stays on your
          seller records.
        </Muted>
      </ScrollView>
    </Screen>
  );
}

function Point({ text }: { text: string }) {
  return (
    <View style={styles.point}>
      <Ionicons name="checkmark-circle-outline" size={16} color={colors.textMuted} />
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: { color: colors.text, ...type.bodyStrong, fontSize: 16 },
  list: { gap: spacing.sm },
  point: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  pointText: { color: colors.textMuted, ...type.body, flex: 1, lineHeight: 21 },
  hint: { ...type.caption, textAlign: 'center', lineHeight: 17 },
});
