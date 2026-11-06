import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Button, Muted, Screen } from '../src/components/ui';
import { colors, radius, spacing, type } from '../src/theme';

/**
 * Unknown route.
 *
 * This replaced the Expo template screen, which imported a `Themed` component
 * this project never had — so a bad deep link crashed instead of explaining
 * itself. A dev build sometimes keeps a stale route in history after a rename,
 * and a person should land somewhere with a way out.
 */
export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.icon}>
          <Ionicons name="compass-outline" size={28} color={colors.primary} />
        </View>
        <Text style={styles.title}>That screen doesn&apos;t exist</Text>
        <Muted style={styles.body}>
          The link may be from an older version of the app. Everything below still works.
        </Muted>
        <Button label="Go to home" onPress={() => router.replace('/')} style={styles.action} />
        <Button
          label="Browse listings"
          variant="outline"
          onPress={() => router.replace('/(tabs)/discover')}
          style={styles.action}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  icon: {
    width: 62,
    height: 62,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, ...type.title, textAlign: 'center' },
  body: { textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: spacing.xs },
});
