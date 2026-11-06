import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { SellerHeader } from '../../src/components/seller/seller-header';
import { Button, Muted, Notice, Screen, SectionHeader } from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * AI BUSINESS TOOLS.
 *
 * Points at the AI Studio that already exists in this app (`/api/ai/generate`,
 * `/api/ai/jobs`). No new AI surface is invented here, and nothing claims a
 * capability the backend does not have.
 */
export default function SellerAiScreen() {
  return (
    <RequireAuth>
      <Ai />
    </RequireAuth>
  );
}

function Ai() {
  const router = useRouter();

  return (
    <Screen>
      <SellerHeader title="AI business tools" subtitle="Write and design faster" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Notice
          title="Powered by your Vidnov AI Studio"
          body="Image and copy generation run through the same jobs queue the website uses. Results appear on your device when the job completes."
        />

        <SectionHeader title="What you can use it for" />
        <View style={styles.list}>
          <Point
            icon="images-outline"
            title="Listing images"
            body="Generate a clean product shot or a background for a listing."
          />
          <Point
            icon="create-outline"
            title="Descriptions"
            body="Draft a description in your own voice, then edit it before publishing."
          />
          <Point
            icon="megaphone-outline"
            title="Promotion copy"
            body="Short captions for social posts about your shop."
          />
        </View>

        <Button label="Open AI Studio" icon="sparkles-outline" onPress={() => router.push('/ai-studio')} />
        <Button
          label="Back to dashboard"
          variant="outline"
          onPress={() => router.push('/seller')}
        />
        <Muted style={styles.hint}>
          AI output is a starting point. Check prices, claims and product details before
          publishing — you are responsible for what buyers read.
        </Muted>
      </ScrollView>
    </Screen>
  );
}

function Point({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.point}>
      <View style={styles.pointIcon}>
        <Ionicons name={icon} size={17} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.pointTitle}>{title}</Text>
        <Text style={styles.pointBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  list: { gap: spacing.sm },
  point: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    alignItems: 'flex-start',
  },
  pointIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointTitle: { color: colors.text, ...type.bodyStrong },
  pointBody: { color: colors.textMuted, ...type.caption, lineHeight: 18 },
  hint: { ...type.caption, textAlign: 'center', lineHeight: 17 },
});
