import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { SellerHeader } from '../../src/components/seller/seller-header';
import { SELLER_NAV } from '../../src/components/seller/nav';
import { Avatar, ListRow, Muted, Notice, Screen } from '../../src/components/ui';
import { useAuth } from '../../src/lib/auth';
import { colors, spacing, type } from '../../src/theme';

/**
 * SELLER MENU — the whole business workspace in one list.
 *
 * Every row is a real destination (see `SELLER_NAV`). The last action is the
 * mode switch: it changes what the app opens into and leaves the seller's shop,
 * orders and messages exactly where they are.
 */
export default function SellerMenuScreen() {
  const router = useRouter();
  const { profile, setMode, canSell } = useAuth();

  return (
    <Screen>
      <SellerHeader title="Seller menu" subtitle={profile?.shopName || 'Your business'} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <Avatar
            uri={profile?.profilePictureUrl}
            name={profile?.shopName || profile?.fullName}
            size={52}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.shopName}>{profile?.shopName || 'Your shop'}</Text>
            <Muted>{profile?.fullName || profile?.email || 'Vidnov seller'}</Muted>
          </View>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.textFaint} />
        </View>

        {!canSell ? (
          <Notice
            tone="warning"
            title="Seller tools are not enabled"
            body="Finish shop setup to unlock the seller tools on this account."
          />
        ) : null}

        {SELLER_NAV.map((group) => (
          <View key={group.title} style={{ gap: spacing.xs }}>
            <Text style={styles.groupTitle}>{group.title.toUpperCase()}</Text>
            <View style={{ gap: spacing.xs }}>
              {group.items.map((item) => (
                <ListRow
                  key={item.href}
                  icon={item.icon}
                  title={item.label}
                  detail={item.detail}
                  onPress={() => router.push(item.href as never)}
                />
              ))}
            </View>
          </View>
        ))}

        <View style={{ gap: spacing.xs }}>
          <Text style={styles.groupTitle}>SWITCH</Text>
          <ListRow
            icon="bag-handle-outline"
            title="Switch to buyer"
            detail="Shop as yourself — your seller data stays untouched"
            onPress={async () => {
              await setMode('buyer');
              router.replace('/(tabs)');
            }}
          />
        </View>

        <Muted style={styles.footnote}>
          Vidnov · Discover. Connect. Shop.
        </Muted>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl * 2 },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  shopName: { color: colors.text, fontSize: 17, fontWeight: '800' },
  groupTitle: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  footnote: { textAlign: 'center', ...type.caption },
});
