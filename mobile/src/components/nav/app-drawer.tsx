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
import { BUYER_NAV, isActiveRoute, type BuyerNavGroup } from '../../nav/buyer';
import { SELLER_NAV, type SellerNavGroup } from '../seller/nav';
import { Avatar } from '../ui';
import { colors, HIT, radius, spacing, type } from '../../theme';

/**
 * THE VIDNOV DRAWER.
 *
 * One component serves both roles and both sizes:
 *
 *   • on a phone it slides in from the left over a scrim, like every Android
 *     marketplace the customer already knows;
 *   • on a wide screen (tablet, Android desktop window) it opens as a 320dp
 *     left sidebar instead of a full-width sheet, which is the only meaningful
 *     difference between the two layouts.
 *
 * It is the single navigation surface for the app. The routes come from
 * `nav/buyer.ts` and `seller/nav.ts` — the same lists the seller dashboard and
 * buyer screens use — so a destination cannot appear in one place and be
 * missing from the other.
 *
 * The role switcher does not swap accounts. It moves the SAME Vidnov identity
 * between its buying and selling workspace (`useAuth().setMode`), which is what
 * keeps orders, messages and reviews attached to one account.
 */

type DrawerItem = {
  label: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  detail?: string;
  badge?: 'unread' | 'orders' | 'requests';
};

const PANEL_MAX = 340;

export function AppDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, mode, setMode, canSell } = useAuth();
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

  const groups: Array<BuyerNavGroup | SellerNavGroup> =
    mode === 'seller' ? (SELLER_NAV as SellerNavGroup[]) : BUYER_NAV;

  const countFor = useMemo(
    () => (item: DrawerItem): number => {
      // Seller rows reuse the same counts; a seller's open orders are work.
      if (item.href === '/seller/orders') return counts.sellerOrders;
      if (item.href === '/seller/inquiries') return counts.unread;
      if (item.badge === 'unread') return counts.unread;
      if (item.badge === 'orders') return counts.orders;
      if (item.badge === 'requests') return counts.requests;
      return 0;
    },
    [counts],
  );

  const go = (href: string) => {
    onClose();
    // A short beat lets the drawer finish closing before the push, so the new
    // screen animates in rather than appearing behind the panel.
    setTimeout(() => router.push(href as never), 120);
  };

  const switchTo = async (next: 'buyer' | 'seller') => {
    if (next === mode) return;
    if (next === 'seller' && !canSell) {
      onClose();
      setTimeout(() => router.push('/onboarding/role'), 120);
      return;
    }
    await setMode(next);
    if (next === 'seller') go('/seller');
    else go('/');
  };

  /**
   * THE FOOTER — the one part of the drawer the two roles never share.
   *
   * A seller's last two actions are the settings of the shop they run and the
   * way back to buying; a buyer's are the settings of the account they own and
   * the way into selling. Rendering one generic "Account settings" row for both
   * was wrong twice over: it pointed a seller at the buyer's settings screen,
   * and it carried a sign-out icon that only navigated.
   *
   * Every row below is a live destination or a live mode switch — `switchTo`
   * sends a buyer without a shop to onboarding rather than to an empty
   * workspace, so the row can never lead nowhere.
   */
  const footer: Array<{
    label: string;
    detail: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  }> =
    mode === 'seller'
      ? [
          {
            label: 'Shop settings',
            detail: 'Shop profile, delivery, visibility',
            icon: 'storefront-outline',
            onPress: () => go('/seller/settings'),
          },
          {
            label: 'Back to buying',
            detail: 'Return to the shopping side',
            icon: 'bag-handle-outline',
            onPress: () => void switchTo('buyer'),
          },
        ]
      : [
          {
            label: 'Shopping settings',
            detail: 'Profile, alerts, sign out',
            icon: 'settings-outline',
            onPress: () => go('/settings'),
          },
          {
            label: 'Become a seller',
            detail: canSell ? 'Open your seller workspace' : 'Set up your shop',
            icon: 'briefcase-outline',
            onPress: () => void switchTo('seller'),
          },
        ];

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
                  {mode === 'seller' ? profile?.shopName || 'Your shop' : profile?.fullName || 'Your account'}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {profile?.email || (mode === 'seller' ? 'Seller workspace' : 'Buyer workspace')}
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

            <View style={styles.switcher}>
              <Pressable
                onPress={() => switchTo('buyer')}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'buyer' }}
                style={[styles.switchHalf, mode === 'buyer' && styles.switchHalfActive]}
              >
                <Ionicons
                  name="bag-handle-outline"
                  size={15}
                  color={mode === 'buyer' ? colors.text : colors.textMuted}
                />
                <Text style={[styles.switchText, mode === 'buyer' && styles.switchTextActive]}>
                  Buying
                </Text>
              </Pressable>
              <Pressable
                onPress={() => switchTo('seller')}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'seller' }}
                style={[styles.switchHalf, mode === 'seller' && styles.switchHalfActive]}
              >
                <Ionicons
                  name="storefront-outline"
                  size={15}
                  color={mode === 'seller' ? colors.text : colors.textMuted}
                />
                <Text style={[styles.switchText, mode === 'seller' && styles.switchTextActive]}>
                  Selling
                </Text>
              </Pressable>
            </View>

            {!canSell ? (
              <Text style={styles.sellerHint}>
                Seller tools unlock after shop setup — tap Selling to set up your shop.
              </Text>
            ) : null}

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            >
              {groups.map((group) => (
                <View key={group.title} style={{ gap: spacing.xs }}>
                  <Text style={styles.groupTitle}>{group.title.toUpperCase()}</Text>
                  {group.items.map((raw) => {
                    const item = raw as DrawerItem;
                    // `/seller` is a prefix of every seller route, so the section
                    // root is matched exactly and the rest by prefix. Tab routes
                    // arrive with their `(tabs)` segment attached; stripping it
                    // once here lets a seller row point at `/alerts` too.
                    const here = pathname.replace(/^\/\(tabs\)/, '') || '/';
                    const active =
                      mode === 'seller'
                        ? here === item.href ||
                          (item.href !== '/seller' && here.startsWith(`${item.href}/`))
                        : isActiveRoute(pathname, item.href);
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
                <Text style={styles.groupTitle}>
                  {mode === 'seller' ? 'THIS SHOP' : 'YOUR ACCOUNT'}
                </Text>
                {footer.map((row) => (
                  <Pressable
                    key={row.label}
                    onPress={row.onPress}
                    accessibilityRole="button"
                    accessibilityLabel={`${row.label}. ${row.detail}`}
                    style={({ pressed }) => [
                      styles.row,
                      pressed && { backgroundColor: colors.surfaceRaised },
                    ]}
                  >
                    <Ionicons name={row.icon} size={19} color={colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel}>{row.label}</Text>
                      <Text style={styles.rowDetail} numberOfLines={1}>
                        {row.detail}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                  </Pressable>
                ))}
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

/** Hamburger for a header — the one way into the drawer from any screen. */
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

  switcher: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  switchHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  switchHalfActive: { backgroundColor: colors.surfaceRaised },
  switchText: { ...type.caption, fontWeight: '700', color: colors.textMuted },
  switchTextActive: { color: colors.text },
  sellerHint: {
    ...type.caption,
    color: colors.textFaint,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },

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
