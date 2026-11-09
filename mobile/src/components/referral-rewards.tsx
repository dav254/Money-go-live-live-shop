import React, { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { account, messageFor, referrals } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useAuthedResource } from '../lib/use-authed';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Loading,
  Muted,
  Notice,
  Screen,
  ScrollScreen,
  SectionHeader,
  StatTile,
} from './ui';
import { colors, radius, spacing, type } from '../theme';

/**
 * INVITE & EARN — one screen, both roles.
 *
 * The website renders the same capability at `/app/buyer/rewards` and
 * `/app/seller/rewards` from one component, so the app does the same: the two
 * routes differ only in the header they pass in.
 *
 * Things this deliberately does NOT do:
 *
 *   • it does not mint a balance — `referralPoints` comes off the profile the
 *     server returns, the same field the website reads;
 *   • it does not redeem on the client — unlocking live streaming is a
 *     transaction on the server, so a double tap cannot spend twice;
 *   • it does not promise a payout. A cash request is a queue an administrator
 *     actions, so the app says "requested", never "paid".
 */

const SITE = 'https://vidnov.com';

export function ReferralRewards({
  header,
  role = 'buyer',
}: {
  header?: React.ReactNode;
  role?: 'buyer' | 'seller';
}) {
  const { getToken } = useAuth();
  const router = useRouter();
  const { data, loading, error, reload } = useAuthedResource(
    (token) => account.profile(token),
    [],
  );
  const [busy, setBusy] = useState(false);

  const profile = (data?.profile ?? {}) as {
    referralPoints?: number;
    referralSlug?: string;
    referralCode?: string;
    fullName?: string;
  };
  const balance = Number(profile.referralPoints) || 0;
  const code = profile.referralSlug || profile.referralCode || '';
  const link = code ? `${SITE}/signup?ref=${encodeURIComponent(code)}` : SITE;

  const invite = async () => {
    try {
      await Share.share({
        message: `Join me on Vidnov — buy and sell from real shops near you. ${link}`,
      });
    } catch {
      // Sharing cancelled is not an error worth a dialog.
    }
  };

  const unlockLive = () =>
    Alert.alert(
      'Unlock one hour of live',
      'This spends referral points on a single live-stream unlock. It is taken from your balance immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlock',
          onPress: async () => {
            setBusy(true);
            try {
              const token = await getToken();
              const result = await referrals.redeem(token, { redeem: 'live' });
              Alert.alert('Unlocked', `You have ${result.balance.toLocaleString()} points left.`);
              reload();
            } catch (thrown) {
              Alert.alert('Could not unlock', messageFor(thrown));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );

  if (loading && !data) {
    return (
      <Screen>
        {header}
        <Loading label="Reading your points…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        {header}
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      <ScrollScreen>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>REFERRAL POINTS</Text>
          <Text style={styles.balance}>{balance.toLocaleString()}</Text>
          <Muted style={styles.heroNote}>
            Earned when people you invited join and get confirmed. One point system — the same
            balance the website shows.
          </Muted>
        </View>

        <View style={styles.tiles}>
          <StatTile label="Your code" value={code || 'Pending'} />
          <StatTile label="Unlock cost" value="Live · 1 hr" />
        </View>

        <SectionHeader title="Your invite link" />
        <Card style={styles.card}>
          <Text style={styles.link} selectable numberOfLines={2}>
            {link}
          </Text>
          <View style={styles.actions}>
            <Button label="Share invite" icon="share-outline" onPress={invite} />
            <Button
              label="Unlock live"
              icon="radio-outline"
              variant="outline"
              loading={busy}
              onPress={unlockLive}
            />
          </View>
          <Muted style={styles.cardNote}>
            A cash payout also starts here on the website: it opens a request an administrator
            actions, and nothing is paid automatically.
          </Muted>
        </Card>

        <SectionHeader title="Keep earning" />
        {role === 'buyer' ? (
          <Pressable
            style={styles.row}
            onPress={() => router.push('/seller/rewards')}
            accessibilityRole="button"
          >
            <Ionicons name="storefront-outline" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Invite a seller</Text>
              <Muted style={styles.rowNote}>Their catalogue and audience come with them.</Muted>
            </View>
            <Badge label="Sellers" tone="primary" />
          </Pressable>
        ) : (
          <Pressable
            style={styles.row}
            onPress={() => router.push('/sellers')}
            accessibilityRole="button"
          >
            <Ionicons name="people-outline" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Who you have invited</Text>
              <Muted style={styles.rowNote}>Your confirmed signups decide payout eligibility.</Muted>
            </View>
            <Badge label="Signups" tone="neutral" />
          </Pressable>
        )}

        <Notice
          title="Points are not cash"
          body="Referral points buy in-app unlocks and can request a voucher. A request is reviewed by a person — the app never moves money by itself."
        />
      </ScrollScreen>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 4,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  eyebrow: { color: colors.textFaint, ...type.caption, fontWeight: '700', letterSpacing: 1.2 },
  balance: { color: colors.text, fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  heroNote: { fontSize: 12, lineHeight: 17 },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  card: { gap: spacing.sm },
  link: { color: colors.primary, ...type.bodyStrong },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cardNote: { fontSize: 11, lineHeight: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  rowTitle: { color: colors.text, ...type.bodyStrong },
  rowNote: { fontSize: 11 },
});
