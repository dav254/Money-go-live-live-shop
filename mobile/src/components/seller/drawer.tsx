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
import { SELLER_NAV, type SellerNavItem } from './nav';
import { Avatar } from '../ui';
import { colors, HIT, radius, spacing, type } from '../../theme';

/**
 * THE SELLER DRAWER — the workspace's own navigation panel.
 *
 * A separate component from the buyer drawer on purpose. The two menus answer
 * different questions ("what am I buying?" vs "how is my shop doing?"), they
 * highlight different things and they end in different footers, so sharing one
 * branching component meant every seller change had to be checked for buyer
 * regressions and vice versa. This file owns the seller rows and only the
 * seller rows.
 *
 * The Store / Create & broadcast / Manage / You groups come from
 * `seller/nav.ts`, and every row there is a route that exists.
 *
 * There is no role switcher in this panel: it is the seller workspace and
 * lists seller destinations only. A seller who wants to shop uses the system
 * back gesture, which returns to the shopping side without having to be shown
 * the buyer's menu from inside their own.
 */

const PANEL_MAX = 340;

export function SellerDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useAuth();
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
    () => (item: SellerNavItem): number => {
      if (item.href === '/seller/orders') return counts.sellerOrders;
      if (item.href === '/seller/inquiries' || item.href === '/seller/messages') return counts.unread;
      return 0;
    },
    [counts],
  );

  const go = (href: string) => {
    onClose();
    setTimeout(() => router.push(href as never), 120);
  };

  /** Seller routes are absolute; tab routes arrive with `(tabs)` attached. */
  const here = pathname.replace(/^\/\(tabs\)/, '') || '/';
  const isActive = (href: string) =>
    here === href || (href !== '/seller' && here.startsWith(`${href}/`));

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
              <Avatar
                uri={profile?.profilePictureUrl}
                name={profile?.shopName || profile?.fullName}
                size={44}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {profile?.shopName || 'Your shop'}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {profile?.email || 'Seller workspace'}
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
              {SELLER_NAV.map((group) => (
                <View key={group.title} style={{ gap: spacing.xs }}>
                  <Text style={styles.groupTitle}>{group.title.toUpperCase()}</Text>
                  {group.items.map((item) => {
                    const active = isActive(item.href);
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
                <Text style={styles.groupTitle}>THIS SHOP</Text>
                <Pressable
                  onPress={() => go('/seller/settings')}
                  accessibilityRole="button"
                  accessibilityLabel="Shop settings. Shop profile, delivery, visibility"
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <Ionicons name="storefront-outline" size={19} color={colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Shop settings</Text>
                    <Text style={styles.rowDetail}>Shop profile, delivery, visibility</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                </Pressable>
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
});
