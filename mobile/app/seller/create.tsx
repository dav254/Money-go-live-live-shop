import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { RequireAuth } from '../../src/components/require-auth';
import { SellerHeader } from '../../src/components/seller/seller-header';
import { Card, Muted, Notice, Screen, ScrollScreen, SectionHeader } from '../../src/components/ui';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * CREATE — the seller's entry point for everything they can publish.
 *
 * `/app/seller/create` on the website is a hub, not a form, and this is the
 * same set of choices with native destinations:
 *
 *   listing        → /seller/products/new   (real form, server-validated)
 *   AI Studio      → /seller/ai             (native generator)
 *   Live studio    → /seller/live
 *   Social content → /seller/content
 *   Growth         → /seller/growth         (distribution + boosts)
 *
 * Every row is a route that exists in this build. The website's browser-only
 * editors (Classic Studio, Video Studio, Living Pictures) are not listed here
 * because there is no native implementation — a row that opens nothing would
 * be worse than an honest absence.
 */
const OPTIONS = [
  {
    href: '/seller/products/new',
    icon: 'add-circle-outline',
    title: 'New listing',
    detail: 'Photos, price, delivery',
    tone: 'primary' as const,
  },
  {
    href: '/seller/ai',
    icon: 'sparkles-outline',
    title: 'AI Studio',
    detail: 'Write and generate listing content',
    tone: 'primary' as const,
  },
  {
    href: '/seller/live',
    icon: 'radio-outline',
    title: 'Go live',
    detail: 'Show stock to buyers in real time',
    tone: 'accent' as const,
  },
  {
    href: '/seller/content',
    icon: 'megaphone-outline',
    title: 'Post to followers',
    detail: 'A photo, caption or video update',
    tone: 'muted' as const,
  },
  {
    href: '/seller/growth',
    icon: 'trending-up-outline',
    title: 'Grow a listing',
    detail: 'Free distribution, paid boosts',
    tone: 'muted' as const,
  },
];

export default function SellerCreateScreen() {
  return (
    <RequireAuth>
      <Create />
    </RequireAuth>
  );
}

function Create() {
  const router = useRouter();
  return (
    <Screen>
      <SellerHeader title="Create" showBack />
      <ScrollScreen>
        <SectionHeader title="What are you publishing?" />
        {OPTIONS.map((option) => (
          <Card key={option.href} style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={option.title}
              onPress={() => router.push(option.href as never)}
              style={({ pressed }) => [styles.touch, pressed && { backgroundColor: colors.surfaceRaised }]}
            >
              <View style={styles.inner}>
                <View
                  style={[
                    styles.icon,
                    option.tone === 'primary' && { backgroundColor: colors.primarySoft },
                    option.tone === 'accent' && { backgroundColor: 'rgba(240,68,56,0.14)' },
                  ]}
                >
                  <Ionicons
                    name={option.icon as keyof typeof Ionicons.glyphMap}
                    size={20}
                    color={option.tone === 'accent' ? colors.danger : colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{option.title}</Text>
                  <Muted style={styles.detail}>{option.detail}</Muted>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </View>
            </Pressable>
          </Card>
        ))}

        <Notice
          title="Studio editors stay on the web"
          body="Classic Studio, Video Studio and Living Pictures are browser editors. They are not in this build, and the app does not link out of the seller section to reach them."
        />
      </ScrollScreen>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden' },
  touch: { width: '100%' },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  title: { color: colors.text, ...type.bodyStrong },
  detail: { fontSize: 12, marginTop: 1 },
});
