import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { RequireAuth } from '../src/components/require-auth';
import {
  Button,
  Heading,
  ListRow,
  Muted,
  Notice,
  Screen,
  SectionHeader,
} from '../src/components/ui';
import { useAuth } from '../src/lib/auth';
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '../src/lib/config';
import { colors, radius, spacing, type } from '../src/theme';

/**
 * HELP & SUPPORT (buyer).
 *
 * The buyer's version of the seller help screen: a working route to a human,
 * the account facts support will ask for, and short answers to the questions
 * that actually reach support — orders, refunds, sellers, reviews.
 *
 * The email button composes the message with the account already in the
 * subject line, so a customer never has to copy an order id by hand.
 */
const FAQ = [
  {
    q: 'Where is my order?',
    a: 'Open My orders. Each order shows its current status and, once the seller ships it, the tracking number.',
  },
  {
    q: 'How do refunds work?',
    a: 'A refund returns to the method you paid with. If an order is cancelled or refunded, it appears in My wallet under “Refunded”.',
  },
  {
    q: 'Can I message a seller before buying?',
    a: 'Yes. Open the shop or listing and use Message — it lands in the same inbox the seller answers from on the website.',
  },
  {
    q: 'How do I leave a review?',
    a: 'After an order is delivered, a “Rate this order” button appears on it. You can review each order once.',
  },
  {
    q: 'How do I start selling?',
    a: 'Account → Become a seller, or the Buying/Selling switch in the menu. Shop setup unlocks the seller tools on the same account.',
  },
];

export default function BuyerHelpScreen() {
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
    `Vidnov buyer support — ${profile?.fullName || profile?.email || session?.uid || ''}`,
  );

  return (
    <Screen>
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

        <SectionHeader title="Common questions" />
        <View style={{ gap: spacing.sm }}>
          {FAQ.map((entry) => (
            <View key={entry.q} style={styles.faq}>
              <Text style={styles.faqQ}>{entry.q}</Text>
              <Text style={styles.faqA}>{entry.a}</Text>
            </View>
          ))}
        </View>

        <SectionHeader title="Account & policies" />
        <View style={styles.group}>
          <ListRow
            icon="person-outline"
            title="Your account details"
            detail={profile?.email || 'Signed in'}
            onPress={() => router.push('/profile/edit')}
          />
          <ListRow
            icon="document-text-outline"
            title="Terms of service"
            onPress={() => void Linking.openURL(TERMS_URL)}
          />
          <ListRow
            icon="shield-checkmark-outline"
            title="Privacy policy"
            onPress={() => void Linking.openURL(PRIVACY_URL)}
          />
          <ListRow
            icon="trash-outline"
            title="Request account deletion"
            detail="Recorded as a dated request"
            onPress={() => router.push('/settings')}
          />
        </View>

        <Notice
          title="No ticket queue in the app"
          body="This build contacts support by email with your account attached. A signed-in chat with support, and an in-app ticket history, are not available on Android yet."
        />

        <Heading>Support facts</Heading>
        <Muted>
          Include your order number and the account email above when you write — it is the
          fastest way to a resolution.
        </Muted>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.bodyStrong, color: colors.text },
  faq: {
    gap: 4,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  faqQ: { ...type.bodyStrong, color: colors.text },
  faqA: { ...type.body, color: colors.textMuted },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});
