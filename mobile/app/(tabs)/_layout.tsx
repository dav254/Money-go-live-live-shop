import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type ColorValue } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { BuyerDrawer, MenuButton } from '../../src/components/buyer/drawer';
import { subscribeBuyerMenu } from '../../src/lib/menu-bus';
import { useAuth } from '../../src/lib/auth';
import { notifications } from '../../src/lib/api';
import { colors, spacing } from '../../src/theme';

/**
 * TAB SHELL.
 *
 * Five destinations, all native: Home, Discover, Requests, Messages, Profile.
 * Alerts keeps its route (the header bell opens it) but does not take a tab
 * slot — the badge on the bell already shows when there is something new.
 * There is no web view and no embedded browser anywhere in this app.
 */

/** Poll the unread badge on the same interval the website header uses. */
function useUnreadBadge() {
  const { status, getToken } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (status !== 'signedIn') {
      setUnread(0);
      return;
    }
    let alive = true;

    const load = async () => {
      try {
        const token = await getToken();
        const result = await notifications.unread(token);
        if (alive) setUnread(Number(result?.unread ?? 0));
      } catch {
        // A badge is decoration; never surface a network error here.
      }
    };

    load();
    const timer = setInterval(load, 45_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [status, getToken]);

  return unread;
}

/** Header bell — the same target on every tab, with the live unread count. */
function HeaderBell({ count }: { count: number }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/(tabs)/alerts')}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Alerts, ${count} unread` : 'Alerts'}
      hitSlop={10}
      style={styles.bell}
    >
      <Ionicons name="notifications-outline" size={21} color={colors.text} />
      {count > 0 ? (
        <View style={styles.bellDot}>
          <View style={styles.bellDotInner} />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function TabsLayout() {
  const unread = useUnreadBadge();
  const [menuOpen, setMenuOpen] = useState(false);

  /* The Discovery header shows its own menu button (the tab header is hidden
     there), so it announces through this bus instead of duplicating state. */
  useEffect(() => subscribeBuyerMenu(() => setMenuOpen(true)), []);

  const tabIcon =
    (name: keyof typeof Ionicons.glyphMap, focusedName: keyof typeof Ionicons.glyphMap) =>
    ({ color, focused, size }: { color: ColorValue | null; focused: boolean; size: number }) => (
      <Ionicons
        name={focused ? focusedName : name}
        size={size}
        // The navigator hands back a processed ColorValue; icons take strings.
        color={typeof color === 'string' ? color : colors.text}
      />
    );

  return (
    <>
      {/* The drawer is the full marketplace map for the active role; the tab
          bar below is the five everyday destinations from that map. */}
      <BuyerDrawer visible={menuOpen} onClose={() => setMenuOpen(false)} />
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerLeft: () => <MenuButton onPress={() => setMenuOpen(true)} />,
        headerRight: () => <HeaderBell count={unread} />,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'Vidnov',
          tabBarIcon: tabIcon('home-outline', 'home'),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          /* The section renders its own compact bar (logo, DISCOVER, search,
             bell, menu). Two stacked headers would cost the feed a row of
             height and show two different menu buttons. */
          headerShown: false,
          tabBarIcon: tabIcon('search-outline', 'search'),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Requests',
          tabBarIcon: tabIcon('document-text-outline', 'document-text'),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: tabIcon('chatbubbles-outline', 'chatbubbles'),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          // Reachable from the header bell, deliberately not a tab.
          href: null,
          title: 'Alerts',
          tabBarIcon: tabIcon('notifications-outline', 'notifications'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Account',
          tabBarIcon: tabIcon('person-outline', 'person'),
        }}
      />
    </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  bell: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  bellDot: {
    position: 'absolute',
    top: 4,
    right: spacing.md,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDotInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
});
