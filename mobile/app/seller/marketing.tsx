import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SellerHeader } from '../../src/components/seller/seller-header';
import { Button, Muted, Notice, Screen, SectionHeader } from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { API_BASE_URL } from '../../src/lib/config';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * MARKETING & PROMOTIONS.
 *
 * Deliberately empty of numbers. The only promotions endpoint in this codebase
 * returns hard-coded sample products and earnings — using it would put another
 * seller's fake campaign on screen. Until a real campaign store exists, this
 * screen explains what is available and sends the seller to the workspace that
 * can actually do it.
 */
export default function SellerMarketingScreen() {
  return (
    <RequireAuth>
      <Marketing />
    </RequireAuth>
  );
}

function Marketing() {
  return (
    <Screen>
      <SellerHeader title="Marketing & promotions" subtitle="Reach more buyers" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Notice
          tone="warning"
          title="Campaign tools are not available in this app yet"
          body="Vidnov has no real campaign store exposed to mobile, so no promotion, boost or discount is listed here. The web marketing workspace is where campaigns run today."
        />

        <SectionHeader title="What reaches buyers now" />
        <View style={styles.list}>
          <Point
            icon="images-outline"
            title="Strong photos"
            body="The first image is the one buyers see in discovery — that is the single biggest lever on a listing."
          />
          <Point
            icon="pricetags-outline"
            title="Complete listings"
            body="Category, location and a real description are what the search and request matching use."
          />
          <Point
            icon="chatbubbles-outline"
            title="Fast replies"
            body="Answering buyer inquiries quickly is what turns a view into an order."
          />
        </View>

        <Button
          label="Open marketing on vidnov.com"
          icon="open-outline"
          onPress={() => void Linking.openURL(`${API_BASE_URL}/dashboard/seller/marketing`)}
        />
        <Button
          label="Improve a listing"
          variant="outline"
          icon="cube-outline"
          onPress={() => Linking.openURL(`${API_BASE_URL}/app/seller/products`)}
        />
        <Muted style={styles.hint}>
          Nothing on this screen is a promotion record. When campaign APIs are exposed to the
          app, this page will list real campaigns with their real status.
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
