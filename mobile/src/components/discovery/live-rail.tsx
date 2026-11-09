import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { RemoteImage } from '../remote-image';
import { catalog, live } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fonts, premium, radius, spacing } from '../../theme';

type LiveCard = {
  id: string;
  title: string;
  name?: string;
  thumbnailUrl?: string;
  viewerCount?: number;
};

/**
 * LIVE ON VIDNOV — the strip above the feed.
 *
 * Reads the same two sources every other surface reads: the rich card list from
 * `/api/live` for a signed-in browser, and the public `/api/home/live` strip
 * otherwise. If nobody is broadcasting the strip renders nothing at all — a
 * "no live streams" band pinned to the top of Discovery would be a permanent
 * empty advertisement for a feature that is not running.
 *
 * The viewer count is the number the streaming service reports; it is printed
 * only when it exists.
 */
export function LiveRail() {
  const router = useRouter();
  const { status, getToken } = useAuth();
  const [cards, setCards] = useState<LiveCard[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        if (status === 'signedIn') {
          const token = await getToken();
          const result = await live.streams(token);
          const rows = Array.isArray(result?.streams) ? result.streams : [];
          if (!alive) return;
          setCards(
            rows.slice(0, 8).map((row: any) => ({
              id: String(row.id ?? row.sellerId ?? ''),
              title: String(row.title ?? 'Live on Vidnov'),
              name: row.businessName ?? row.sellerName ?? undefined,
              thumbnailUrl: row.thumbnailUrl ?? undefined,
              viewerCount: typeof row.viewerCount === 'number' ? row.viewerCount : undefined,
            })).filter((row: LiveCard) => row.id),
          );
          return;
        }
        const result = await catalog.liveNow();
        const rooms = Array.isArray(result?.rooms) ? result.rooms : [];
        if (!alive) return;
        setCards(
          rooms.slice(0, 8).map((room) => ({
            id: room.id,
            title: room.title || 'Live on Vidnov',
            viewerCount: typeof room.viewerCount === 'number' ? room.viewerCount : undefined,
          })),
        );
      } catch {
        // A live strip is decoration over a working feed; stay silent.
        if (alive) setCards([]);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [status, getToken]);

  if (cards.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.liveBadge}>
          <View style={styles.dot} />
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
        <Text style={styles.heading}>On air now</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {cards.map((card) => (
          <Pressable
            key={card.id}
            onPress={() => router.push(`/live/${card.id}`)}
            style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
            accessibilityRole="button"
            accessibilityLabel={`Watch ${card.title} live`}
          >
            <View style={styles.preview}>
              {card.thumbnailUrl ? (
                <RemoteImage source={card.thumbnailUrl} style={styles.thumb} radius={0} showRetry={false} />
              ) : (
                <View style={styles.thumbFallback}>
                  <Ionicons name="radio-outline" size={20} color={premium.textMuted} />
                </View>
              )}
              {typeof card.viewerCount === 'number' ? (
                <View style={styles.viewers}>
                  <Ionicons name="eye-outline" size={9} color={premium.text} />
                  <Text style={styles.viewersText}>{card.viewerCount}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.cardBody}>
              <Text numberOfLines={1} style={styles.name}>
                {card.name ?? card.title}
              </Text>
              <Text numberOfLines={1} style={styles.title}>
                {card.name ? card.title : 'Tap to watch'}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: premium.border,
    paddingBottom: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: premium.live,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: premium.text },
  liveBadgeText: { color: premium.text, fontFamily: fonts.bodyBold, fontSize: 8, letterSpacing: 1 },
  heading: { color: premium.text, fontFamily: fonts.headingMedium, fontSize: 12.5 },
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  card: {
    width: 132,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: premium.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: premium.border,
  },
  cardPressed: { borderColor: premium.brand },
  preview: { height: 74, backgroundColor: premium.raised },
  thumb: { width: '100%', height: '100%' },
  thumbFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewers: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16,16,16,0.75)',
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  viewersText: { color: premium.text, fontFamily: fonts.bodySemi, fontSize: 9 },
  cardBody: { paddingHorizontal: spacing.sm, paddingVertical: 6, gap: 1 },
  name: { color: premium.text, fontFamily: fonts.bodySemi, fontSize: 11.5 },
  title: { color: premium.textMuted, fontFamily: fonts.body, fontSize: 10 },
});
