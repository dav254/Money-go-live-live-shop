import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';

import { useAuth } from '../../lib/auth';
import { useNavCounts } from '../../lib/nav-counts';
import { BUYER_NAV, isActiveRoute, type BuyerNavItem } from './nav';
import { Avatar } from '../ui';
import { colors, HIT, radius, spacing, type } from '../../theme';

/**
 * THE BUYER DRAWER — the shopping side's own navigation panel.
 *
 * It is deliberately NOT a mode-switching generic drawer. The buyer and the
 * seller each have a drawer component of their own (`components/buyer/drawer`
 * and `components/seller/drawer`) so that neither menu can borrow the other's
 * rows, copy or footer by accident. What they share is the visual language and
 * nothing else: midnight panel, Vidnov red active row, hairline separators.
 *
 * The footer is this side's account block — Shopping settings and the way into
 * selling. The seller footer is a different set of rows in a different file.
 */

const PANEL_MAX = 340;

export function BuyerDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, canSell } = useAuth();
  const counts = useNavCounts();

  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener(
      'change',
      ({ window }: { window: { width: number } }) => setScreenWidth(window.width),
    );
    return () => sub.remove();
  }, []);

  const wide = screenWidth >= 880;
  const panelWidth = wide ? 320 : Math.min(PANEL_MAX, Math.round(screenWidth * 0.86));

  const slide = useRef(new Animated.Value(-PANEL_MAX)).current;
  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : -PANEL_MAX,
      duration: 190,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  const countFor = useMemo(
    () => (item: BuyerNavItem): number => {
      if (item.badge === 'unread') return counts.unread;
      if (item.badge === 'orders') return counts.orders;
      if (item.badge === 'requests') return counts.requests;
      return 0;
    },
    [counts],
  );

  const go = (href: string) => {
    onClose();
    setTimeout(() => router.push(href as never), 120);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View
          style={[
            styles.panel,
            { width: panelWidth, transform: [{ translateX: slide }] },
            wide && styles.panelWide,
          ]}
        >
          <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
            <View style={styles.identity}>
              <Avatar uri={profile?.profilePictureUrl} name={profile?.fullName} size={44} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {profile?.fullName || 'Your account'}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {profile?.email || 'Buyer account'}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close menu"
                hitSlop={8}
                style={styles.close}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            >
              {BUYER_NAV.map((group) => (
                <View key={group.title} style={{ gap: spacing.xs }}>
                  <Text style={styles.groupTitle}>{group.title.toUpperCase()}</Text>
                  {group.items.map((item) => {
                    const active = isActiveRoute(pathname, item.href);
                    const count = countFor(item);

                    return (
                      <Pressable
                        key={item.href}
                        onPress={() => go(item.href)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={
                          count > 0 ? `${item.label}, ${count} waiting` : item.label
                        }
                        style={({ pressed }) => [
                          styles.row,
                          active && styles.rowActive,
                          pressed && { backgroundColor: colors.surfaceRaised },
                        ]}
                      >
                        <Ionicons
                          name={item.icon}
                          size={19}
                          color={active ? colors.primary : colors.textMuted}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>
                            {item.label}
                          </Text>
                          {item.detail ? (
                            <Text style={styles.rowDetail} numberOfLines={1}>
                              {item.detail}
                            </Text>
                          ) : null}
                        </View>
                        {count > 0 ? (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}

              <View style={styles.footer}>
                <Text style={styles.groupTitle}>YOUR ACCOUNT</Text>
                <Pressable
                  onPress={() => go('/settings')}
                  accessibilityRole="button"
                  accessibilityLabel="Shopping settings. Profile, alerts, sign out"
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <Ionicons name="settings-outline" size={19} color={colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Shopping settings</Text>
                    <Text style={styles.rowDetail}>Profile, alerts, sign out</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                </Pressable>
                {/* Only offered to accounts that cannot sell yet: this is how
                    a buyer joins, not a doorway into the seller menu. An
                    account that already sells switches sides from its own
                    account screen, so the buyer drawer never lists a single
                    seller destination. */}
                {canSell ? null : (
                  <Pressable
                    onPress={() => {
                      onClose();
                      setTimeout(() => router.push('/onboarding/role'), 120);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Become a seller. Set up your shop"
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    <Ionicons name="briefcase-outline" size={19} color={colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel}>Become a seller</Text>
                      <Text style={styles.rowDetail}>Set up your shop</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                  </Pressable>
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>

        <Pressable
          style={styles.scrim}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
      </View>
    </Modal>
  );
}

/** The buyer header's hamburger — the way into this drawer. */
export function MenuButton({ onPress, tint = colors.text }: { onPress: () => void; tint?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open navigation menu"
      hitSlop={10}
      style={styles.menuButton}
    >
      <Ionicons name="menu" size={22} color={tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  panel: {
    backgroundColor: colors.background,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  panelWide: { borderRightWidth: 1, borderRightColor: colors.border },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  name: { ...type.bodyStrong, color: colors.text },
  sub: { ...type.caption, color: colors.textFaint },
  close: { padding: spacing.xs },
  list: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  footer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  groupTitle: {
    ...type.caption,
    color: colors.textFaint,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: HIT,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  rowPressed: { backgroundColor: colors.surfaceRaised },
  rowActive: { backgroundColor: colors.primarySoft },
  rowLabel: { ...type.body, color: colors.text },
  rowLabelActive: { color: colors.text, fontWeight: '700' },
  rowDetail: { ...type.caption, color: colors.textFaint },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...type.caption, color: colors.white, fontWeight: '800' },
  menuButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
