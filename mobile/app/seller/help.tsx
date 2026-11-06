import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { SellerHeader } from '../../src/components/seller/seller-header';
import { Button, Muted, Notice, Screen, SectionHeader } from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { useAuth } from '../../src/lib/auth';
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '../../src/lib/config';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * HELP & SUPPORT.
 *
 * Direct, working routes to a human — email with the account already in the
 * subject line, the terms and privacy policy, and the account facts support
 * will ask for. No ticket list, because this build has no ticket store on the
 * phone.
 */
export default function SellerHelpScreen() {
  return (
    <RequireAuth>
      <Help />
    </RequireAuth>
  );
}

function Help() {
  const router = useRouter();
  const { profile, session } = useAuth();

  const subject = encodeURIComponent(
    `Vidnov seller support — ${profile?.shopName || profile?.fullName || session?.uid || ''}`,
  );

  return (
    <Screen>
      <SellerHeader title="Help & support" subtitle="We are a message away" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="mail-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.title}>Email the team</Text>
            <Muted>{SUPPORT_EMAIL}</Muted>
            <Muted>Replies usually arrive within one working day.</Muted>
          </View>
        </View>

        <Button
          label="Email support"
          icon="mail-outline"
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`)}
        />

        <SectionHeader title="Before you write" />
        <View style={styles.list}>
          <Point
            icon="cube-outline"
            title="A listing will not publish"
            body="Check the name, category, description and price. The form shows the exact problem from the server."
            action={() => router.push('/seller/products/new')}
            actionLabel="Add a listing"
          />
          <Point
            icon="images-outline"
            title="Photos will not upload"
            body="Images must be under 10 MB each and a JPEG, PNG, WebP or GIF. Retry the failed tile in the photo picker."
          />
          <Point
            icon="receipt-outline"
            title="An order is stuck"
            body="Orders move forward one step at a time. If the next step fails, the message from the server explains why."
            action={() => router.push('/seller/orders')}
            actionLabel="Open orders"
          />
        </View>

        <Notice
          title="Account and verification requests"
          body="Changing your sign-in email, business verification or a payout method is a manual review. Email support from the address on this account so the team can verify you."
        />

        <SectionHeader title="Legal" />
        <Button
          label="Terms of service"
          variant="ghost"
          icon="document-text-outline"
          onPress={() => void Linking.openURL(TERMS_URL)}
        />
        <Button
          label="Privacy policy"
          variant="ghost"
          icon="shield-checkmark-outline"
          onPress={() => void Linking.openURL(PRIVACY_URL)}
        />

        <Muted style={styles.meta}>
          Account: {profile?.email || session?.email || '—'}
          {'\n'}Role: {(profile?.userRole ?? 'buyer').toUpperCase()}
        </Muted>
      </ScrollView>
    </Screen>
  );
}

function Point({
  icon,
  title,
  body,
  action,
  actionLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <View style={styles.point}>
      <View style={styles.pointIcon}>
        <Ionicons name={icon} size={17} color={colors.textMuted} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.pointTitle}>{title}</Text>
        <Text style={styles.pointBody}>{body}</Text>
        {action && actionLabel ? (
          <Button label={actionLabel} variant="ghost" onPress={action} style={styles.pointAction} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, ...type.bodyStrong, fontSize: 16 },
  list: { gap: spacing.sm },
  point: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    alignItems: 'flex-start',
  },
  pointIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointTitle: { color: colors.text, ...type.bodyStrong },
  pointBody: { color: colors.textMuted, ...type.caption, lineHeight: 18 },
  pointAction: { alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 0 },
  meta: { marginTop: spacing.md, ...type.caption, lineHeight: 18 },
});
