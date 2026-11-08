import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { RemoteImage } from '../src/components/remote-image';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Loading,
  Muted,
  Price,
  Screen,
} from '../src/components/ui';
import { catalog } from '../src/lib/api';
import { useResource } from '../src/lib/use-resource';
import { colors, radius, spacing, type } from '../src/theme';

/**
 * VIDEOS.
 *
 * Video on Vidnov lives on the LISTING (`videoUrl` / `videoUrls` on the product
 * document), and that is what this feed shows: real listings whose seller
 * uploaded a clip. There is no separate short-video feed on the backend yet, so
 * the screen says that instead of pretending an empty feed means "nothing new".
 *
 * Nothing is invented here: if no listing in the current catalogue page has a
 * video, the empty state is the truth.
 */
type VideoListing = {
  id: string;
  name?: string;
  price?: number | null;
  currency?: string | null;
  shopName?: string;
  sellerName?: string;
  imageUrl?: string | null;
  imageUrls?: string[];
  videoUrl?: string | null;
  videoUrls?: string[];
  category?: string;
};

export default function VideosScreen() {
  const router = useRouter();
  const { data, loading, error, reload } = useResource(
    () => catalog.shelf({ limit: 60 }),
    [],
  );

  const videos = useMemo(() => {
    const listings = (data?.listings ?? []) as VideoListing[];
    return listings.filter(
      (listing) => Boolean(listing.videoUrl) || (listing.videoUrls?.length ?? 0) > 0,
    );
  }, [data]);

  if (loading && !data) return <Loading label="Loading videos…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <Screen>
      <FlatList
        data={videos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={reload}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Muted>
              Listings with a video from the seller. Tap one to watch and buy from the same shop.
            </Muted>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="videocam-outline"
            title="No videos in this catalogue page"
            body="Sellers attach video to their listings from the seller tools. When one is published it appears here."
            action={
              <Button
                label="Browse the catalogue"
                icon="search-outline"
                variant="outline"
                onPress={() => router.push('/discover')}
              />
            }
          />
        }
        renderItem={({ item }) => {
          const cover = item.imageUrl || item.imageUrls?.[0] || null;
          return (
            <Pressable
              onPress={() => router.push(`/listing/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name ?? 'Listing'} with video`}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
            >
              <View style={styles.media}>
                <RemoteImage source={cover} style={styles.mediaImage} radius={0} />
                <View style={styles.mediaBadge}>
                  <Ionicons name="play" size={13} color={colors.white} />
                  <Text style={styles.mediaBadgeText}>VIDEO</Text>
                </View>
              </View>
              <View style={styles.body}>
                <Text style={styles.title} numberOfLines={2}>
                  {item.name ?? 'Listing'}
                </Text>
                <Muted numberOfLines={1}>{item.shopName || item.sellerName || 'Vidnov seller'}</Muted>
                <View style={styles.footer}>
                  <Price amount={item.price} currency={item.currency} />
                  {item.category ? <Badge label={item.category} /> : null}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  intro: { paddingBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  media: { height: 170, backgroundColor: colors.surfaceRaised },
  mediaImage: { width: '100%', height: '100%' },
  mediaBadge: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.66)',
  },
  mediaBadgeText: { ...type.caption, color: colors.white, fontWeight: '800', letterSpacing: 0.6 },
  body: { padding: spacing.md, gap: 4 },
  title: { ...type.bodyStrong, color: colors.text },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
});
