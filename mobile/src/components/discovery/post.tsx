import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';

import { RemoteImage } from '../remote-image';
import { Avatar } from '../ui';
import { API_BASE_URL, apiUrl } from '../../lib/config';
import { following, saved as savedApi, catalog } from '../../lib/api';
import { useAuth } from '../../lib/auth';
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
import { fonts, premium, radius, spacing } from '../../theme';
import type { Product, SellerCard } from '../../lib/types';

/**
 * ONE POST IN THE DISCOVERY FEED.
 *
 * Media owns the cell, the seller sits above the copy, and the shopping card is
 * anchored to the bottom where a thumb reaches it. Everything overlaid is real
 * document data — the verified mark needs `verified`, the LIVE pill needs a
 * session the streaming service reports, the like count is the `likes` field
 * the website writes, and nothing renders a number nobody produced.
 *
 * Only the visible post mounts a player: fifty hidden `<VideoView>`s would hold
 * fifty decoders open and the second swipe would stutter.
 */

const SCRIM_STEPS = 12;

/** A gradient without a gradient library: stacked bands of the page colour. */
function Scrim() {
  return (
    <View pointerEvents="none" style={styles.scrim}>
      {Array.from({ length: SCRIM_STEPS }).map((_, index) => (
        <View
          key={index}
          style={{
            flex: 1,
            backgroundColor: `rgba(16,16,16,${(0.015 + (index / SCRIM_STEPS) * 0.42).toFixed(3)})`,
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

function RailAction({
  icon,
  label,
  count,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count?: number | null;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.railItem}
      accessibilityRole="button"
      accessibilityLabel={count != null ? `${label}, ${count}` : label}
    >
      <View style={[styles.railIcon, active ? styles.railIconActive : null]}>
        <Ionicons name={icon} size={21} color={premium.text} />
      </View>
      {count != null ? <Text style={styles.railCount}>{count > 999 ? '999+' : count}</Text> : null}
      <Text style={styles.railLabel}>{label}</Text>
    </Pressable>
  );
}

export function DiscoveryPost({
  product,
  seller,
  active,
  height,
  likes,
  isLive,
  commentCount,
  onOpenComments,
}: {
  product: Product;
  seller: SellerCard | null | undefined;
  active: boolean;
  height: number;
  /** Real `likes` count from the catalogue, when the document carries one. */
  likes?: number;
  /** True only when the streaming service reports an active session. */
  isLive?: boolean;
  /** Present only after this post's thread has actually been read. */
  commentCount?: number;
  onOpenComments: () => void;
}) {
  const router = useRouter();
  const { status, getToken, profile } = useAuth();
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

  const [likeCount, setLikeCount] = useState<number | null>(typeof likes === 'number' ? likes : null);
  const [liked, setLiked] = useState(false);
  const [isSaved, setSaved] = useState(false);
  const [followingSeller, setFollowingSeller] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof likes === 'number') setLikeCount(likes);
  }, [likes, product.id]);

  useEffect(() => {
    setSaved((profile?.wishlist ?? []).includes(product.id));
    if (seller?.id) setFollowingSeller((profile?.following ?? []).includes(seller.id));
  }, [profile, product.id, seller?.id]);

  const requireAuth = (message: string) => {
    if (status === 'signedIn') return false;
    Alert.alert('Sign in', message, [
      { text: 'Not now', style: 'cancel' },
      { text: 'Sign in', onPress: () => router.push('/sign-in') },
    ]);
    return true;
  };

  const toggleLike = async () => {
    if (requireAuth('Liking a listing needs an account so it stays yours.')) return;
    if (busy) return;
    const next = !liked;
    setBusy(true);
    setLiked(next);
    setLikeCount((count) => Math.max(0, (count ?? 0) + (next ? 1 : -1)));
    try {
      const token = await getToken();
      const result = await catalog.like(token, product.id, next);
      if (typeof result?.likes === 'number') setLikeCount(Math.max(0, result.likes));
    } catch {
      setLiked(!next);
      setLikeCount((count) => Math.max(0, (count ?? 0) + (next ? -1 : 1)));
      Alert.alert('Like not saved', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const toggleSave = async () => {
    if (requireAuth('Saving an item needs an account so it is waiting for you later.')) return;
    if (busy) return;
    const next = !isSaved;
    setBusy(true);
    setSaved(next);
    try {
      const token = await getToken();
      await savedApi.set(token, product.id, next);
    } catch {
      setSaved(!next);
      Alert.alert('Could not update saved items', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const toggleFollow = async () => {
    if (!seller?.id) return;
    if (requireAuth('Following a shop needs an account.')) return;
    if (busy) return;
    const next = !followingSeller;
    setBusy(true);
    setFollowingSeller(next);
    try {
      const token = await getToken();
      await following.set(token, seller.id, next ? 'follow' : 'unfollow');
    } catch {
      setFollowingSeller(!next);
      Alert.alert('Could not update following', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const url = `${API_BASE_URL}/products/${product.id}`;
    try {
      await Share.share({
        message: `${product.name || 'A listing'} on Vidnov — ${url}`,
        title: product.name || 'Vidnov listing',
      });
    } catch {
      // A dismissed share sheet is not an error.
    }
  };

  return (
    <View style={[styles.post, { height }]}>
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
            <Ionicons name="play" size={22} color={premium.text} />
          </View>
        ) : null}
      </View>

      <Scrim />

      {media.length > 1 ? (
        <View style={styles.pips} pointerEvents="none">
          {media.map((entry, i) => (
            <View key={entry.key} style={[styles.pip, i === index ? styles.pipActive : null]} />
          ))}
        </View>
      ) : null}

      <View style={styles.topRow} pointerEvents="none">
        {isLive ? (
          <View style={styles.livePill}>
            <View style={styles.liveDotSmall} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        ) : null}
        {product.listingType === 'service' ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>SERVICE</Text>
          </View>
        ) : null}
        {discount > 0 ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>-{discount}%</Text>
          </View>
        ) : null}
      </View>

      {/* Action rail — real interactions only. */}
      <View style={styles.rail}>
        <RailAction
          icon={liked ? 'heart' : 'heart-outline'}
          label="Like"
          count={likeCount}
          active={liked}
          onPress={() => void toggleLike()}
        />
        <RailAction
          icon="chatbubble-ellipses-outline"
          label="Comments"
          count={commentCount}
          onPress={onOpenComments}
        />
        <RailAction
          icon={isSaved ? 'bookmark' : 'bookmark-outline'}
          label="Save"
          active={isSaved}
          onPress={() => void toggleSave()}
        />
        <RailAction icon="paper-plane-outline" label="Share" onPress={() => void share()} />
        {product.sellerId ? (
          <RailAction
            icon="mail-outline"
            label="Message"
            onPress={() =>
              router.push({ pathname: '/chat/[id]', params: { id: `new:${product.sellerId}` } })
            }
          />
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.sellerRow}>
          <Pressable
            onPress={() =>
              (seller?.id ?? product.sellerId) && router.push(`/shop/${seller?.id ?? product.sellerId}`)
            }
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
                <Ionicons name="checkmark" size={10} color={premium.success} />
              </View>
            ) : null}
          </Pressable>

          {seller?.id && product.sellerId !== profile?.uid ? (
            <Pressable
              onPress={() => void toggleFollow()}
              style={[styles.follow, followingSeller ? styles.following : null]}
              accessibilityRole="button"
              accessibilityState={{ selected: followingSeller }}
              accessibilityLabel={followingSeller ? `Unfollow ${sellerName}` : `Follow ${sellerName}`}
            >
              <Text style={[styles.followText, followingSeller ? styles.followingText : null]}>
                {followingSeller ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text numberOfLines={1} style={styles.name}>
          {product.name || 'Untitled listing'}
        </Text>
        {product.description?.trim() ? (
          <Text numberOfLines={2} style={styles.caption}>
            {product.description.trim()}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <Text style={styles.price}>{priceLabel(product)}</Text>
          {availability ? (
            <Text style={[styles.meta, soldOut ? styles.metaDanger : null]}>{availability}</Text>
          ) : null}
          {place ? (
            <View style={styles.metaGroup}>
              <Ionicons name="location-outline" size={11} color={premium.textMuted} />
              <Text numberOfLines={1} style={styles.meta}>
                {place}
              </Text>
            </View>
          ) : null}
        </View>

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
                    <Ionicons name="videocam" size={13} color={premium.text} />
                  </View>
                ) : (
                  <RemoteImage source={entry.url} style={styles.thumbImage} radius={6} showRetry={false} />
                )}
              </Pressable>
            ))}
            {media.length > 6 ? <Text style={styles.thumbMore}>+{media.length - 6}</Text> : null}
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push(`/listing/${product.id}`)}
            style={({ pressed }) => [styles.buy, pressed ? styles.buyPressed : null]}
            accessibilityRole="button"
            accessibilityLabel={`${service ? 'Request service' : 'Buy'} — ${product.name ?? 'listing'}`}
          >
            <Ionicons
              name={service ? 'construct-outline' : 'bag-handle-outline'}
              size={16}
              color={premium.text}
            />
            <Text style={styles.buyLabel}>{service ? 'GET QUOTE' : 'BUY'}</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              product.sellerId ? router.push(`/shop/${product.sellerId}`) : undefined
            }
            disabled={!product.sellerId}
            style={({ pressed }) => [styles.shop, pressed ? styles.shopPressed : null]}
            accessibilityRole="button"
            accessibilityLabel={`Visit ${sellerName}'s shop`}
          >
            <Ionicons name="storefront-outline" size={15} color={premium.text} />
            <Text style={styles.shopLabel}>SHOP</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  post: { width: '100%', backgroundColor: premium.background, overflow: 'hidden' },
  media: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  playBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,16,16,0.55)',
  },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '26%' },
  pips: {
    position: 'absolute',
    top: 12,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    gap: 4,
  },
  pip: { flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  pipActive: { backgroundColor: premium.brand },
  topRow: {
    position: 'absolute',
    top: 22,
    left: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: premium.live,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  liveDotSmall: { width: 5, height: 5, borderRadius: 3, backgroundColor: premium.text },
  liveText: { color: premium.text, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.2 },
  tag: {
    backgroundColor: 'rgba(37,37,37,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: premium.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  tagText: { color: premium.text, fontFamily: fonts.bodySemi, fontSize: 9, letterSpacing: 1 },
  rail: {
    position: 'absolute',
    right: spacing.md,
    bottom: 210,
    alignItems: 'center',
    gap: spacing.md,
  },
  railItem: { alignItems: 'center', gap: 3, width: 52 },
  railIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(25,25,25,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: premium.border,
  },
  railIconActive: { backgroundColor: premium.brandSoft, borderColor: premium.brand },
  railCount: { color: premium.text, fontFamily: fonts.bodySemi, fontSize: 11 },
  railLabel: { color: premium.textMuted, fontFamily: fonts.bodyMedium, fontSize: 9.5 },
  body: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingRight: 84,
    gap: spacing.sm,
  },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  avatarRing: {
    padding: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  sellerName: { color: premium.text, fontFamily: fonts.bodySemi, fontSize: 14, flexShrink: 1 },
  verified: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: premium.success,
    backgroundColor: 'rgba(39,201,130,0.16)',
  },
  follow: {
    paddingHorizontal: 14,
    height: 30,
    borderRadius: radius.pill,
    justifyContent: 'center',
    backgroundColor: premium.brand,
  },
  following: {
    backgroundColor: 'rgba(25,25,25,0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: premium.border,
  },
  followText: { color: premium.text, fontFamily: fonts.bodyBold, fontSize: 11.5 },
  followingText: { color: premium.textMuted },
  name: { color: premium.text, fontFamily: fonts.heading, fontSize: 17 },
  caption: { color: premium.textMuted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  price: { color: premium.text, fontFamily: fonts.headingExtra, fontSize: 19, letterSpacing: -0.3 },
  metaGroup: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  meta: { color: premium.textMuted, fontFamily: fonts.body, fontSize: 11.5 },
  metaDanger: { color: premium.brand },
  thumbs: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  thumb: {
    width: 38,
    height: 38,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: premium.border,
    opacity: 0.8,
  },
  thumbActive: { borderColor: premium.brand, opacity: 1 },
  thumbImage: { flex: 1 },
  thumbVideo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,16,16,0.7)',
  },
  thumbMore: { color: premium.text, fontFamily: fonts.bodyBold, fontSize: 11, paddingHorizontal: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  buy: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: premium.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  buyPressed: { backgroundColor: premium.brandPressed },
  buyLabel: { color: premium.text, fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 1.1 },
  shop: {
    height: 46,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: premium.border,
    backgroundColor: 'rgba(25,25,25,0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  shopPressed: { borderColor: premium.text },
  shopLabel: { color: premium.text, fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1 },
});
