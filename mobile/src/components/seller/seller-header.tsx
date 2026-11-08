import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { AppDrawer } from '../nav/app-drawer';
import { colors, HIT, spacing, type } from '../../theme';

/**
 * The seller centre's own header.
 *
 * The seller screens run without the navigator header so the shop's identity is
 * the top of the page — but a business tool still needs one predictable way
 * back to the menu and to the previous screen. Both live here, at the same
 * height, on every seller screen.
 */
export function SellerHeader({
  title,
  subtitle,
  showBack = false,
  right,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  // The drawer is the seller's sidebar on every screen of the workspace.
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      {showBack ? (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/seller'))}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          style={styles.iconButton}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
      ) : null}

      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right}

      <Pressable
        onPress={() => setMenuOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Open seller menu"
        hitSlop={10}
        style={styles.iconButton}
      >
        <Ionicons name="menu" size={22} color={colors.text} />
      </Pressable>

      <AppDrawer visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: HIT + 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  title: { color: colors.text, ...type.heading },
  subtitle: { color: colors.textFaint, ...type.caption, marginTop: 1 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
