import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '../../lib/auth';
import { notifications } from '../../lib/api';
import { openBuyerMenu } from '../../lib/menu-bus';
import { fonts, premium, spacing } from '../../theme';

/**
 * DISCOVERY HEADER — compact, one row.
 *
 * Logo, the section name, search, notifications and the account menu. It
 * replaces the tab shell's native header on this screen (that one carries a
 * hamburger and a wordmark, which would have stacked two bars above the feed)
 * and it is deliberately short: every point of height here is a point the
 * listing loses.
 *
 * The unread dot polls the same endpoint the shell's bell polls, so the two
 * can never disagree.
 */
export function DiscoveryHeader({
  searchOpen,
  onToggleSearch,
}: {
  searchOpen: boolean;
  onToggleSearch: () => void;
}) {
  const router = useRouter();
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
        // A badge is decoration; a failed poll must not surface an error.
      }
    };
    void load();
    const timer = setInterval(load, 45_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [status, getToken]);

  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Ionicons name="flash" size={14} color={premium.text} />
        </View>
        <Text style={styles.title}>DISCOVER</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onToggleSearch}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={searchOpen ? 'Close search' : 'Search Vidnov'}
          style={styles.icon}
        >
          <Ionicons name={searchOpen ? 'close' : 'search'} size={20} color={premium.text} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/(tabs)/alerts')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          style={styles.icon}
        >
          <Ionicons name="notifications-outline" size={20} color={premium.text} />
          {unread > 0 ? <View style={styles.dot} /> : null}
        </Pressable>

        <Pressable
          onPress={() => openBuyerMenu()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open your account menu"
          style={styles.icon}
        >
          <Ionicons name="menu" size={22} color={premium.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: premium.background,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premium.brand,
  },
  title: {
    color: premium.text,
    fontFamily: fonts.headingExtra,
    fontSize: 15,
    letterSpacing: 2.6,
    fontWeight: '800',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  icon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: premium.live,
  },
});
