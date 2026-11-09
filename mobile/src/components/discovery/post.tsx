import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';

import { RemoteImage } from '../remote-image';
import { Avatar } from '../ui';
import { apiUrl } from '../../lib/config';
import {
  availabilityLabel,
  coverOf,
  discountPercent,
  isOutOfStock,
  isService,
  mediaOf,
  priceLabel,
  type MediaItem,
} from '../../lib/discovery';
import { colors, radius, spacing, type } from '../../theme';
import type { Product, SellerCard } from '../../lib/types';

/**
 * ONE POST IN THE DISCOVERY FEED.
 *
 * The native twin of the website's `DiscoveryVideoPost`: media owns the whole
 * cell, the seller and the buy card float over its lower half, and there is
 * exactly one primary action. Nothing here is a webview — the clip plays
 * through `expo-video`, the photo is drawn by `RemoteImage`, and every button
 * is a native pressable that opens a native route.
 *
 * Only the post on screen mounts a player. Fifty hidden `<VideoView>`s would
 * hold fifty decoders open on a mid-range Android and the feed would stutter
 * before the third card; an idle post shows its own cover photo instead.
 */

const SCRIM_STEPS = 10;

/** A gradient without a gradient library: ten stacked bands of black. */
function Scrim() {
  return (
    <View pointerEvents="none" style={styles.scrim}>
      {Array.from({ length: SCRIM_STEPS }).map((_, index) => (
        <View
          key={index}
          style={{
            flex: 1,
            backgroundColor: `rgba(10,10,11,${(0.02 + (index / SCRIM_STEPS) * 0.34).toFixed(3)})`,
          }}
        />
      ))}
    </View>
  );
}

function PostVideo({ item, active }: { item: MediaItem; active: boolean }) {
  const player = useVideoPlayer(apiUrl(item.url), (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  useEffect(() => {
    if (active) player.play();
    else player.pause();
    return () => player.pause();
  }, [active, player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      pointerEvents="none"
    />
  );
}

export function DiscoveryPost({
  product,
  seller,
  active,
  height,
}: {
  product: Product;
  seller: SellerCard | null | undefined;
  active: boolean;
  height: number;
}) {
  const router = useRouter();
  const media = useMemo(() => mediaOf(product), [product]);
  const [index, setIndex] = useState(0);
  const current = media[Math.min(index, media.length - 1)];
  const cover = coverOf(product);
  const service = isService(product);
  const soldOut = isOutOfStock(product);
  const place = product.location || product.vendorLocation;
  const discount = discountPercent(product);
  const availability = availabilityLabel(product);
  const sellerName = seller?.shopName || seller?.name || 'Vidnov seller';
  const caption = [product.description?.trim(), product.tags?.trim() ? `#${(product.tags ?? '').trim().split(/[,\s]+/).filter(Boolean).join(' #')}` : '']
    .filter(Boolean)
    .join('\n\n');

  return (
    <View style={[styles.post, { height }]}>
      {/* Media */}
      <View style={styles.media}>
        {current?.type === 'video' && active ? (
          <PostVideo item={current} active={active} />
        ) : (
          <RemoteImage
            source={current?.type === 'image' ? current.url : cover}
            style={StyleSheet.absoluteFill}
            contentFit={current?.type === 'image' ? 'contain' : 'cover'}
            radius={0}
            showRetry={false}
            label={product.name ? `${product.name} media` : 'Listing media'}
          />
        )}
        {current?.type === 'video' && !active ? (
          <View style={styles.playBadge} pointerEvents="none">
            <Ionicons name="play" size={22} color={colors.white} />
          </View>
        ) : null}
      </View>

      <Scrim />

      {media.length > 1 ? (
        <View style={styles.pips} pointerEvents="none">
          {media.map((entry, i) => (
            <View
              key={entry.key}
              style={[styles.pip, i === index ? styles.pipActive : null]}
            />
          ))}
        </View>
      ) : null}

      {/* Copy block */}
      {/* Not a ScrollView on purpose: a scrollable block inside a paging list
          steals the vertical swipe that is supposed to change the post. */}
      <View style={styles.body}>
        <View style={styles.sellerRow}>
          <Pressable
            onPress={() => (seller?.id ?? product.sellerId) && router.push(`/shop/${seller?.id ?? product.sellerId}`)}
            style={styles.identity}
            accessibilityRole="button"
            accessibilityLabel={`Open ${sellerName}`}
          >
            <View style={styles.avatarRing}>
              <Avatar uri={seller?.avatarUrl} name={sellerName} size={36} />
            </View>
            <Text numberOfLines={1} style={styles.sellerName}>
              {sellerName}
            </Text>
            {seller?.verified ? (
              <View style={styles.verified}>
                <Ionicons name="checkmark" size={10} color={colors.primary} />
              </View>
            ) : null}
          </Pressable>

          {product.sellerId ? (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/chat/[id]', params: { id: `new:${product.sellerId}` } })
              }
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={`Chat with ${sellerName}`}
            >
              <Ionicons name="chatbubble-outline" size={15} color={colors.white} />
            </Pressable>
          ) : null}
        </View>

        {caption ? (
          <Text style={styles.caption} numberOfLines={3}>
            {caption}
          </Text>
        ) : null}

        {media.length > 1 ? (
          <View style={styles.thumbs}>
            {media.slice(0, 6).map((entry, i) => (
              <Pressable
                key={entry.key}
                onPress={() => setIndex(i)}
                style={[styles.thumb, i === index ? styles.thumbActive : null]}
                accessibilityRole="button"
                accessibilityLabel={`Show media ${i + 1} of ${media.length}`}
              >
                {entry.type === 'video' ? (
                  <View style={styles.thumbVideo}>
                    <Ionicons name="videocam" size={13} color={colors.white} />
                  </View>
                ) : (
                  <RemoteImage source={entry.url} style={styles.thumbImage} radius={6} showRetry={false} />
                )}
              </Pressable>
            ))}
            {media.length > 6 ? <Text style={styles.thumbMore}>+{media.length - 6}</Text> : null}
          </View>
        ) : null}

        {/* Buy card */}
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <RemoteImage source={cover} style={styles.cardMedia} radius={12} showRetry={false} />
            <View style={styles.cardText}>
              <Text numberOfLines={1} style={styles.cardName}>
                {product.name || 'Untitled listing'}
              </Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{priceLabel(product)}</Text>
                {discount > 0 ? <Text style={styles.discount}>-{discount}%</Text> : null}
              </View>
              <View style={styles.metaRow}>
                {availability ? (
                  <Text style={[styles.meta, soldOut ? styles.metaDanger : null]}>{availability}</Text>
                ) : null}
                {place ? (
                  <View style={styles.metaGroup}>
                    <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                    <Text numberOfLines={1} style={styles.meta}>
                      {place}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => router.push(`/listing/${product.id}`)}
              style={({ pressed }) => [styles.primary, pressed ? styles.primaryPressed : null]}
              accessibilityRole="button"
              accessibilityLabel={`${service ? 'View service' : 'View product'} — ${product.name ?? 'listing'}`}
            >
              <Ionicons name={service ? 'construct-outline' : 'bag-handle-outline'} size={16} color={colors.background} />
              <Text style={styles.primaryLabel}>{service ? 'View service' : 'View product'}</Text>
            </Pressable>

            {product.sellerId ? (
              <Pressable
                onPress={() => router.push(`/shop/${product.sellerId}`)}
                style={({ pressed }) => [styles.secondary, pressed ? styles.secondaryPressed : null]}
                accessibilityRole="button"
                accessibilityLabel={`Visit ${sellerName}'s shop`}
              >
                <Ionicons name="storefront-outline" size={15} color={colors.white} />
                <Text style={styles.secondaryLabel}>Shop</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  post: { width: '100%', backgroundColor: '#08080A', overflow: 'hidden' },
  media: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  playBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '44%',
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '32%' },
  pips: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    gap: 5,
  },
  pip: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)' },
  pipActive: { backgroundColor: colors.primary },
  body: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  avatarRing: {
    padding: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  sellerName: { color: colors.white, ...type.bodyStrong, flexShrink: 1 },
  verified: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  caption: { color: 'rgba(255,255,255,0.88)', ...type.caption, lineHeight: 18 },
  thumbs: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    opacity: 0.75,
  },
  thumbActive: { borderColor: colors.primary, opacity: 1 },
  thumbImage: { flex: 1 },
  thumbVideo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  thumbMore: { color: colors.white, fontSize: 11, fontWeight: '800', paddingHorizontal: 6 },
  card: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(16,16,19,0.86)',
    padding: spacing.md,
    gap: spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardMedia: { width: 52, height: 52 },
  cardText: { flex: 1, minWidth: 0, gap: 2 },
  cardName: { color: colors.white, fontSize: 13.5, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price: { color: colors.primary, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  discount: {
    color: colors.background,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    fontSize: 9,
    fontWeight: '900',
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  metaGroup: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  meta: { color: colors.textMuted, fontSize: 11 },
  metaDanger: { color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.sm },
  primary: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  primaryPressed: { backgroundColor: colors.primaryPressed },
  primaryLabel: { color: colors.background, fontSize: 13.5, fontWeight: '800' },
  secondary: {
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryPressed: { borderColor: colors.primary },
  secondaryLabel: { color: colors.white, fontSize: 12.5, fontWeight: '700' },
});
