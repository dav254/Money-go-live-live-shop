import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type ColorValue } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../src/lib/auth';
import { notifications } from '../../src/lib/api';
import { colors, spacing } from '../../src/theme';

/**
 * TAB SHELL.
 *
 * Five destinations, all native: Home, Discover, Messages, Alerts, Profile.
 * There is no web view and no embedded browser anywhere in this app — every
 * tab is a React Native screen talking to the Vidnov API over HTTPS.
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
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
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
          tabBarIcon: tabIcon('search-outline', 'search'),
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
          title: 'Alerts',
          tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, fontSize: 10 },
          tabBarIcon: tabIcon('notifications-outline', 'notifications'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: tabIcon('person-outline', 'person'),
        }}
      />
    </Tabs>
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
