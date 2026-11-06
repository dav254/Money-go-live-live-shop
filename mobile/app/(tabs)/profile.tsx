import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Avatar, Badge, Button, ListRow, Muted, Screen, SectionHeader } from '../../src/components/ui';
import { SignedOutPrompt } from '../../src/components/require-auth';
import { useAuth } from '../../src/lib/auth';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * PROFILE — the account hub.
 *
 * Which rows appear depends on the account's real role, read from the profile
 * document the server returns. A buyer never sees a seller dashboard that would
 * 403, and a seller never sees a buyer-only row that does not apply. Nothing is
 * hidden behind a "coming soon" that would be a lie later.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { status, profile, signOut, refreshProfile, canSell, mode, setMode } = useAuth();

  if (status === 'signedOut') {
    return (
      <SignedOutPrompt
        title="Your Vidnov account"
        body="Sign in to manage your listings, orders, messages and settings in the app."
      />
    );
  }

  const role = (profile?.userRole ?? 'buyer').toLowerCase();
  const isSeller = canSell;
  const name = profile?.fullName || profile?.shopName || 'Vidnov member';

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Avatar uri={profile?.profilePictureUrl} name={name} size={64} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.name}>{name}</Text>
            {profile?.email ? <Muted>{profile.email}</Muted> : null}
            <View style={styles.badges}>
              <Badge label={role.charAt(0).toUpperCase() + role.slice(1)} tone="primary" />
              {profile?.shopName ? <Badge label={profile.shopName} /> : null}
            </View>
          </View>
        </View>

        <View style={styles.quickRow}>
          <QuickStat icon="receipt-outline" label="Orders" onPress={() => router.push('/orders')} />
          <QuickStat icon="heart-outline" label="Saved" onPress={() => router.push('/saved')} />
          <QuickStat icon="pricetag-outline" label="Offers" onPress={() => router.push('/offers')} />
          <QuickStat icon="sparkles-outline" label="AI Studio" onPress={() => router.push('/ai-studio')} />
        </View>

        {isSeller ? (
          <>
            <SectionHeader
              title="Selling"
              action={<Badge label={mode === 'seller' ? 'Seller mode' : 'Buyer mode'} tone="primary" />}
            />
            <View style={styles.group}>
              <ListRow
                icon="storefront-outline"
                title="Seller centre"
                detail="Dashboard, products, orders and growth"
                onPress={() => router.push('/seller')}
              />
              <ListRow
                icon="receipt-outline"
                title="Seller orders"
                detail="Update fulfilment status"
                onPress={() => router.push('/seller/orders')}
              />
              <ListRow
                icon="cube-outline"
                title="Your listings"
                detail="Add, edit and publish"
                onPress={() => router.push('/seller/products')}
              />
              <ListRow
                icon="swap-horizontal-outline"
                title={mode === 'seller' ? 'Switch to buyer' : 'Switch to seller'}
                detail="Change what the app opens into — same account"
                onPress={async () => {
                  await setMode(mode === 'seller' ? 'buyer' : 'seller');
                  if (mode === 'buyer') router.push('/seller');
                }}
              />
            </View>
          </>
        ) : (
          <>
            <SectionHeader title="Selling" />
            <View style={styles.group}>
              <ListRow
                icon="storefront-outline"
                title="Start selling on Vidnov"
                detail="Open a shop on this same account"
                onPress={() => router.push('/onboarding/role')}
              />
            </View>
          </>
        )}

        <SectionHeader title="Shopping" />
        <View style={styles.group}>
          <ListRow icon="receipt-outline" title="My orders" onPress={() => router.push('/orders')} />
          <ListRow icon="heart-outline" title="Saved items" onPress={() => router.push('/saved')} />
          <ListRow
            icon="document-text-outline"
            title="Requests & offers"
            onPress={() => router.push('/offers')}
          />
          <ListRow icon="radio-outline" title="Live now" onPress={() => router.push('/live')} />
        </View>

        <SectionHeader title="Account" />
        <View style={styles.group}>
          <ListRow
            icon="refresh-outline"
            title="Refresh account"
            detail="Re-read your profile from Vidnov"
            onPress={() => {
              void refreshProfile();
            }}
          />
          <ListRow icon="settings-outline" title="Settings" onPress={() => router.push('/settings')} />
        </View>

        <Button
          label="Sign out"
          variant="outline"
          icon="log-out-outline"
          onPress={async () => {
            await signOut();
            router.replace('/(tabs)');
          }}
        />
      </ScrollView>
    </Screen>
  );
}

function QuickStat({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.quick} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={19} color={colors.primary} />
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { color: colors.text, fontSize: 20, fontWeight: '800' },
  badges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginTop: 2 },
  quickRow: { flexDirection: 'row', gap: spacing.sm },
  quick: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  quickLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  group: { gap: spacing.xs },
});
