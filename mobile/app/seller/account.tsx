import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { RequireAuth } from '../../src/components/require-auth';
import { SellerHeader } from '../../src/components/seller/seller-header';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorState,
  ListRow,
  Loading,
  Muted,
  Notice,
  Screen,
  ScrollScreen,
  SectionHeader,
} from '../../src/components/ui';
import { account } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useAuthedResource } from '../../src/lib/use-authed';
import { messageFor } from '../../src/lib/api';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * ACCOUNT (seller) — the hub `/app/seller/account` is: who you are, the shop
 * you run, and the exits.
 *
 * The exit is a real sign-out on this screen because the seller drawer has no
 * footer here (unlike Android's drawer, which carries Shop settings / Back to
 * buying). Two sign-out buttons in one workspace is how people press the wrong
 * one.
 */
export default function SellerAccountScreen() {
  return (
    <RequireAuth>
      <Account />
    </RequireAuth>
  );
}

function Account() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { data, loading, error, reload } = useAuthedResource(
    (token) => account.profile(token),
    [],
  );
  const [busy, setBusy] = useState(false);

  const profile = (data?.profile ?? {}) as {
    fullName?: string;
    email?: string;
    phoneNumber?: string;
    shopName?: string;
    userRole?: string;
    profilePictureUrl?: string;
    aiPoints?: number;
  };

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'Your shop stays online. You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await signOut();
            router.replace('/welcome');
          } catch (thrown) {
            Alert.alert('Could not sign out', messageFor(thrown));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  if (loading && !data) {
    return (
      <Screen>
        <SellerHeader title="Account" showBack />
        <Loading label="Loading your account…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <SellerHeader title="Account" showBack />
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  const role = (profile.userRole ?? 'seller').toLowerCase();
  const points = Number(profile.aiPoints) || 0;

  return (
    <Screen>
      <SellerHeader title="Account" showBack />
      <ScrollScreen>
        <Card style={styles.identity}>
          <Avatar
            uri={profile.profilePictureUrl}
            name={profile.shopName || profile.fullName}
            size={56}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.name} numberOfLines={1}>
              {profile.shopName || profile.fullName || 'Your business'}
            </Text>
            <Muted numberOfLines={1} style={styles.email}>
              {profile.email || 'No email on file'}
            </Muted>
            <View style={styles.badges}>
              <Badge label={role === 'reseller' ? 'Reseller' : 'Seller'} tone="primary" />
              <Badge label={`${points.toLocaleString()} AI points`} tone="neutral" />
            </View>
          </View>
        </Card>

        <SectionHeader title="Your shop" />
        <ListRow
          icon="storefront-outline"
          title="Shop settings"
          detail="Name, delivery, visibility"
          onPress={() => router.push('/seller/settings')}
        />
        <ListRow
          icon="person-outline"
          title="Edit profile"
          detail="Name, phone, photo, bio"
          onPress={() => router.push('/seller/profile')}
        />
        <ListRow
          icon="location-outline"
          title="My business"
          detail="Where you operate"
          onPress={() => router.push('/seller/business')}
        />
        <ListRow
          icon="qr-code-outline"
          title="Share & QR"
          detail="Your shop link and code"
          onPress={() => router.push('/seller/share')}
        />

        <SectionHeader title="Money & growth" />
        <ListRow
          icon="wallet-outline"
          title="Wallet"
          detail="Delivered orders and payouts"
          onPress={() => router.push('/seller/wallet')}
        />
        <ListRow
          icon="ribbon-outline"
          title="AI points"
          detail="Balance and what it buys"
          onPress={() => router.push('/seller/points')}
        />
        <ListRow
          icon="gift-outline"
          title="Invite & earn"
          detail="Referral points and unlocks"
          onPress={() => router.push('/seller/rewards')}
        />

        <SectionHeader title="Support" />
        <ListRow
          icon="help-buoy-outline"
          title="Customer care"
          detail="Talk to the Vidnov team"
          onPress={() => router.push('/seller/help')}
        />

        <Notice
          title="One Vidnov identity"
          body="Your shop and your buying account are the same person. Switching to buying does not sign you out or create a second account."
        />

        <Button
          label={busy ? 'Signing out…' : 'Sign out of the app'}
          variant="outline"
          loading={busy}
          onPress={confirmSignOut}
        />
      </ScrollScreen>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { color: colors.text, ...type.heading },
  email: { fontSize: 12 },
  badges: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
});
