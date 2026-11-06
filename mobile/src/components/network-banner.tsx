import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useOnline } from '../lib/use-authed';
import { colors, spacing, type } from '../theme';

/**
 * OFFLINE BANNER.
 *
 * A phone loses its connection constantly — tunnels, lifts, a plane. Without
 * this, every screen just shows a generic "that didn't load" and a person
 * assumes the app is broken. The banner names the real cause, and it disappears
 * on its own the moment connectivity returns, so nothing has to be retried by
 * hand.
 *
 * It is deliberately non-blocking: cached content stays on screen underneath,
 * because a stale listing is more useful than a blank one.
 */
export function NetworkBanner() {
  const online = useOnline();

  if (online) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={15} color={colors.warning} />
      <Text style={styles.text}>You&apos;re offline. Showing what was already loaded.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(245, 165, 36, 0.14)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: { color: colors.warning, ...type.caption, flex: 1 },
});
