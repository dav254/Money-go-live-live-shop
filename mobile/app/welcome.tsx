import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { VidnovMark, VidnovWordmark } from '../src/components/brand';
import { Button, Muted } from '../src/components/ui';
import { PRIVACY_URL, TERMS_URL } from '../src/lib/config';
import { colors, radius, spacing, type } from '../src/theme';

/**
 * WELCOME — the first thing a new seller sees.
 *
 * Three doors, all real: create an account, sign in, or browse without one.
 * Discovery is public in the Vidnov product, so "Explore" is a genuine option
 * rather than a tease — it opens the same tab shell a signed-out visitor uses.
 */
export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      {/* Native glow, no image asset needed. */}
      <View pointerEvents="none" style={styles.glow} />

      <View style={styles.top}>
        <View style={styles.brand}>
          <VidnovMark size={52} />
          <VidnovWordmark size={24} />
        </View>

        <View style={styles.copy}>
          <Text style={styles.headline}>Discover. Connect. Shop.</Text>
          <Text style={styles.intro}>
            A new way to discover, connect and grow — for the people who buy and
            the businesses that serve them.
          </Text>
        </View>

        <View style={styles.points}>
          <Point icon="storefront-outline" text="Open a shop, list products and services" />
          <Point icon="chatbubbles-outline" text="Talk to buyers and answer requests" />
          <Point icon="receipt-outline" text="Manage orders, revenue and growth" />
        </View>
      </View>

      <View style={styles.actions}>
        <Button label="Create account" onPress={() => router.push('/sign-up')} />
        <Button label="Sign in" variant="outline" onPress={() => router.push('/sign-in')} />
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          accessibilityRole="button"
          accessibilityLabel="Explore Vidnov without an account"
          style={styles.explore}
        >
          <Text style={styles.exploreText}>Explore Vidnov</Text>
          <Ionicons name="arrow-forward" size={15} color={colors.textMuted} />
        </Pressable>

        <Muted style={styles.legal}>
          By continuing you agree to Vidnov&apos;s{' '}
          <Text style={styles.link} onPress={() => void Linking.openURL(TERMS_URL)}>
            terms
          </Text>{' '}
          and{' '}
          <Text style={styles.link} onPress={() => void Linking.openURL(PRIVACY_URL)}>
            privacy policy
          </Text>
          .
        </Muted>
      </View>
    </View>
  );
}

function Point({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.point}>
      <View style={styles.pointIcon}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
  },
  glow: {
    position: 'absolute',
    top: -140,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255,77,46,0.16)',
  },
  top: { gap: spacing.xl },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { gap: spacing.sm, marginTop: spacing.lg },
  headline: {
    color: colors.white,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 44,
  },
  intro: { color: colors.textMuted, ...type.body, lineHeight: 23 },
  points: { gap: spacing.md, marginTop: spacing.sm },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pointIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointText: { color: colors.text, ...type.body, flex: 1 },
  actions: { gap: spacing.md },
  explore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
  exploreText: { color: colors.textMuted, ...type.bodyStrong, fontWeight: '600' },
  legal: { textAlign: 'center', ...type.caption, lineHeight: 18 },
  link: { color: colors.primary, fontWeight: '700' },
});
