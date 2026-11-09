import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { RemoteImage } from '../remote-image';
import { isService, type ThemeSeed } from '../../lib/discovery';
import { fonts, premium, radius, spacing } from '../../theme';
import type { Product } from '../../lib/types';

/**
 * DISCOVERY · THEMES.
 *
 * Editorially it reads like a magazine; underneath every tile is a filter the
 * catalogue can actually answer. The categories are the platform's own —
 * `PRODUCT_CATEGORIES` and `SERVICE_CATEGORIES` — not an invented taxonomy, so
 * a tile either has real listings or honestly shows none.
 *
 * Tile art comes from the catalogue page the feed already loaded: the first
 * listing in that category, credited to nobody. No stock photography is
 * fetched, so a category with no sellers cannot look populated.
 */

type Theme = {
  key: string;
  title: string;
  kicker: string;
  blurb: string;
  icon: keyof typeof Ionicons.glyphMap;
  seed: ThemeSeed;
  /** Category value to match against a listing when picking cover art. */
  match?: string;
  services?: boolean;
};

const THEMES: Theme[] = [
  {
    key: 'fashion',
    title: 'Fashion',
    kicker: 'The new wardrobe',
    blurb: 'Pieces from sellers who photograph what they stock.',
    icon: 'shirt-outline',
    seed: { category: 'Fashion & Apparel', kind: 'product' },
    match: 'Fashion & Apparel',
  },
  {
    key: 'electronics',
    title: 'Electronics',
    kicker: 'Built to last',
    blurb: 'Phones, audio and accessories with real stock counts.',
    icon: 'hardware-chip-outline',
    seed: { category: 'Electronics & Gadgets', kind: 'product' },
    match: 'Electronics & Gadgets',
  },
  {
    key: 'beauty',
    title: 'Beauty',
    kicker: 'Rituals',
    blurb: 'Everyday care from shops that ship.',
    icon: 'sparkles-outline',
    seed: { category: 'Beauty & Personal Care', kind: 'product' },
    match: 'Beauty & Personal Care',
  },
  {
    key: 'home',
    title: 'Home & Living',
    kicker: 'Make it home',
    blurb: 'Furniture, decor and the small things that finish a room.',
    icon: 'home-outline',
    seed: { category: 'Home & Living', kind: 'product' },
    match: 'Home & Living',
  },
  {
    key: 'food',
    title: 'Food & Groceries',
    kicker: 'Kitchen to table',
    blurb: 'Pantry staples and fresh produce from local sellers.',
    icon: 'basket-outline',
    seed: { category: 'Food & Groceries', kind: 'product' },
    match: 'Food & Groceries',
  },
  {
    key: 'health',
    title: 'Health & Wellness',
    kicker: 'Feel better',
    blurb: 'Care, supplements and wellbeing from real shops.',
    icon: 'medkit-outline',
    seed: { category: 'Health & Wellness', kind: 'product' },
    match: 'Health & Wellness',
  },
  {
    key: 'sports',
    title: 'Sports & Outdoors',
    kicker: 'Move more',
    blurb: 'Kit for training, hiking and the weekend.',
    icon: 'basketball-outline',
    seed: { category: 'Sports & Outdoors', kind: 'product' },
    match: 'Sports & Outdoors',
  },
  {
    key: 'auto',
    title: 'Automotive',
    kicker: 'On the road',
    blurb: 'Parts, spares and car care.',
    icon: 'car-outline',
    seed: { category: 'Automotive', kind: 'product' },
    match: 'Automotive',
  },
  {
    key: 'kids',
    title: 'Baby & Kids',
    kicker: 'Little things',
    blurb: 'Clothing, toys and everyday care.',
    icon: 'happy-outline',
    seed: { category: 'Baby & Kids', kind: 'product' },
    match: 'Baby & Kids',
  },
  {
    key: 'construction',
    title: 'Construction',
    kicker: 'Build it',
    blurb: 'Masons, builders and site crews.',
    icon: 'hammer-outline',
    seed: { category: 'construction', kind: 'service' },
    match: 'construction',
    services: true,
  },
  {
    key: 'professional',
    title: 'Professional services',
    kicker: 'Get it done',
    blurb: 'Plumbing, electrical, IT and repairs.',
    icon: 'construct-outline',
    seed: { kind: 'service' },
    services: true,
  },
  {
    key: 'events',
    title: 'Events & entertainment',
    kicker: 'Host it well',
    blurb: 'Catering, decor and event crews.',
    icon: 'musical-notes-outline',
    seed: { category: 'catering', kind: 'service' },
    match: 'catering',
    services: true,
  },
];

export function DiscoveryThemes({
  products,
  onExplore,
}: {
  products: Product[];
  onExplore: (seed: ThemeSeed) => void;
}) {
  const router = useRouter();

  /* One real cover per tile, borrowed from the loaded catalogue page. */
  const covers = useMemo(() => {
    const map = new Map<string, string>();
    for (const theme of THEMES) {
      const match = (theme.match ?? '').toLowerCase();
      const hit = products.find((product) => {
        const image = product.imageUrl || product.imageUrls?.[0];
        if (!image) return false;
        if (theme.services) {
          return isService(product) && (match ? (product.category ?? '').toLowerCase() === match : true);
        }
        return (product.category ?? '').toLowerCase() === match;
      });
      const image = hit?.imageUrl || hit?.imageUrls?.[0];
      if (image) map.set(theme.key, image);
    }
    return map;
  }, [products]);

  return (
    <FlatList
      data={THEMES}
      keyExtractor={(item) => item.key}
      numColumns={2}
      columnWrapperStyle={{ gap: spacing.md }}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push('/live')}
            style={({ pressed }) => [styles.liveCard, pressed ? { opacity: 0.88 } : null]}
            accessibilityRole="button"
            accessibilityLabel="Watch live streams"
          >
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.liveTitle}>Sellers on air right now</Text>
              <Text style={styles.liveBody} numberOfLines={1}>
                Watch a shop, ask questions, buy from the stream
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={premium.text} />
          </Pressable>

          {/* FIND WHAT YOU NEED — the buyer's own brief. Posts through the
              request flow that already exists (sellers answer with offers),
              so the app is not opening a second request system. */}
          <Pressable
            onPress={() => router.push('/request/new')}
            style={({ pressed }) => [styles.needCard, pressed ? { opacity: 0.88 } : null]}
            accessibilityRole="button"
            accessibilityLabel="Post what you are looking for"
          >
            <View style={styles.needIcon}>
              <Ionicons name="megaphone-outline" size={17} color={premium.brand} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.liveTitle}>Find what you need</Text>
              <Text style={styles.liveBody} numberOfLines={2}>
                Describe it, add a photo, set a budget — sellers reply with offers
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={premium.textMuted} />
          </Pressable>

          <Text style={styles.hint}>Browse the marketplace by collection</Text>
        </View>
      }
      renderItem={({ item }) => {
        const cover = covers.get(item.key);
        return (
          <Pressable
            onPress={() => onExplore(item.seed)}
            style={({ pressed }) => [styles.tile, pressed ? styles.tilePressed : null]}
            accessibilityRole="button"
            accessibilityLabel={`${item.title} — ${item.blurb}`}
          >
            {cover ? (
              <>
                <RemoteImage source={cover} style={styles.cover} radius={0} showRetry={false} />
                <View style={styles.coverScrim} />
              </>
            ) : (
              <View style={styles.coverFallback}>
                <Ionicons name={item.icon} size={26} color={premium.textMuted} />
              </View>
            )}
            <View style={styles.tileBody}>
              <Text style={styles.kicker}>{item.kicker.toUpperCase()}</Text>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.blurb} numberOfLines={2}>
                {item.blurb}
              </Text>
            </View>
          </Pressable>
        );
      }}
      ListFooterComponent={
        <Text style={styles.footer}>
          Every collection is a real category. A quiet tile means no seller has published in it
          yet — we do not fill it with stock photos.
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
    backgroundColor: premium.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: premium.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: premium.live,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: premium.text },
  liveBadgeText: { color: premium.text, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.1 },
  needCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: premium.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: premium.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  needIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premium.brandSoft,
  },
  liveTitle: { color: premium.text, fontFamily: fonts.heading, fontSize: 15 },
  liveBody: { color: premium.textMuted, fontFamily: fonts.body, fontSize: 12 },
  hint: { color: premium.textMuted, fontFamily: fonts.bodyMedium, fontSize: 11.5, letterSpacing: 0.4 },
  tile: {
    flex: 1,
    height: 190,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: premium.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: premium.border,
    justifyContent: 'flex-end',
  },
  tilePressed: { borderColor: premium.brand },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  coverScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: 'rgba(16,16,16,0.55)',
  },
  coverFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premium.raised,
  },
  tileBody: { padding: spacing.md, gap: 2 },
  kicker: {
    color: premium.brand,
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.4,
  },
  title: { color: premium.text, fontFamily: fonts.heading, fontSize: 16 },
  blurb: { color: premium.textMuted, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16 },
  footer: {
    color: premium.textMuted,
    fontFamily: fonts.body,
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 17,
  },
});
