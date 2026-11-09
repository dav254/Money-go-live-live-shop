import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { EDITORIAL_THEMES, type ThemeSeed } from '../../lib/discovery';
import { colors, radius, spacing, type } from '../../theme';

/**
 * DISCOVERY · THEMES — the editorial half of the section.
 *
 * Each tile is a REAL filter on the catalogue (a category the seller form
 * actually writes), so tapping one opens Shop with results that exist. There
 * is no "trending" tile: the server records search demand but nothing reads it
 * back, and a trending row would be a guess wearing a chart.
 */
export function DiscoveryThemes({ onExplore }: { onExplore: (seed: ThemeSeed) => void }) {
  const router = useRouter();

  return (
    <FlatList
      data={EDITORIAL_THEMES}
      keyExtractor={(item) => `${item.kind}:${item.category}`}
      numColumns={2}
      columnWrapperStyle={{ gap: spacing.md }}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push('/live')}
            style={({ pressed }) => [styles.liveCard, pressed ? { opacity: 0.86 } : null]}
            accessibilityRole="button"
            accessibilityLabel="Watch live streams"
          >
            <View style={styles.liveDot} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.liveTitle}>Live right now</Text>
              <Text style={styles.liveBody} numberOfLines={1}>
                Sellers broadcasting from their shops
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.background} />
          </Pressable>
          <Text style={styles.hint}>Browse the marketplace by collection</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onExplore({ category: item.category, kind: item.kind })}
          style={({ pressed }) => [styles.tile, pressed ? { borderColor: colors.primary } : null]}
          accessibilityRole="button"
          accessibilityLabel={`${item.title} — ${item.blurb}`}
        >
          <Text style={styles.kicker}>{item.kicker}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.blurb} numberOfLines={3}>
            {item.blurb}
          </Text>
          <View style={styles.openRow}>
            <Text style={styles.open}>Explore</Text>
            <Ionicons name="arrow-forward" size={13} color={colors.primary} />
          </View>
        </Pressable>
      )}
      ListFooterComponent={
        <Text style={styles.footer}>
          Every collection is a real category — if a tile is empty, no seller has published in it yet.
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  header: { gap: spacing.md, marginBottom: spacing.xs },
  liveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.background },
  liveTitle: { color: colors.background, ...type.heading },
  liveBody: { color: 'rgba(10,10,11,0.72)', ...type.caption },
  hint: { color: colors.textFaint, ...type.caption },
  tile: {
    flex: 1,
    minHeight: 150,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: 4,
  },
  kicker: { color: colors.primary, fontSize: 9.5, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { color: colors.text, ...type.heading },
  blurb: { color: colors.textMuted, ...type.caption, lineHeight: 17, flexGrow: 1 },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  open: { color: colors.primary, fontSize: 11.5, fontWeight: '800' },
  footer: {
    color: colors.textFaint,
    ...type.caption,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
});
