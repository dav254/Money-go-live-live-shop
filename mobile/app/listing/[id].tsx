import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';

import {
  Avatar,
  Badge,
  Body,
  Button,
  Divider,
  ErrorState,
  Heading,
  Loading,
  Muted,
  Price,
  Screen,
} from '../../src/components/ui';
import { RemoteImage } from '../../src/components/remote-image';
import { catalog, saved as savedApi } from '../../src/lib/api';
import { apiUrl } from '../../src/lib/config';
import { useAuth } from '../../src/lib/auth';
import { money, shortDate } from '../../src/lib/format';
import { recordView } from '../../src/lib/recent';
import { useResource } from '../../src/lib/use-resource';
import { colors, HIT, radius, spacing, type } from '../../src/theme';
import type { Listing, SellerCard } from '../../src/lib/types';

/**
 * LISTING DETAIL — a native product/service page.
 *
 * Everything on this screen is drawn by React Native from the public listing
 * projection (`/api/mobile/listing/[id]`): image gallery, price, description,
 * seller card and the two real actions a buyer has. Nothing here opens a
 * browser tab, and nothing here is a placeholder — if the backend has no data,
 * the screen says so instead of inventing it.
 */
export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { status: authStatus, session } = useAuth();

  const { data, loading, error, reload } = useResource(
    () => catalog.listing(String(id)),
    [id],
    { enabled: Boolean(id) },
  );

  const listing = (data?.listing ?? null) as Listing | null;
  const seller = (data?.seller ?? null) as SellerCard | null;

  // Writing this device's history is the same act as opening the listing; it
  // is fire-and-forget so a slow disk never delays the page.
  React.useEffect(() => {
    if (!listing?.id || !session?.uid) return;
    void recordView(session.uid, listing);
  }, [listing, session?.uid]);

  if (loading && !data) {
    return (
      <Screen>
        <Loading label="Loading listing…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  if (!listing) {
    return (
      <Screen>
        <ErrorState message="This listing is no longer available." onRetry={reload} />
      </Screen>
    );
  }

  const images = [listing.imageUrl, ...(listing.imageUrls ?? [])].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );
  const uniqueImages = Array.from(new Set(images));
  const soldOut =
    listing.availabilityState === 'out_of_stock' ||
    listing.availabilityState === 'fully_booked' ||
    (listing.listingType !== 'service' && typeof listing.stock === 'number' && listing.stock <= 0);

  return (
    <Screen style={{ paddingTop: 0 }}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Gallery */}
        {uniqueImages.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.gallery}
          >
            {uniqueImages.map((uri, index) => (
              <RemoteImage
                key={uri}
                source={uri}
                style={{ width, height: width }}
                radius={0}
                label={`${listing.name || 'Listing'} photo ${index + 1}`}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.galleryFallback, { width, height: width }]}>
            <Ionicons name="image-outline" size={40} color={colors.textFaint} />
            <Muted>No photo yet</Muted>
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1, gap: 6 }}>
              <Heading style={styles.title}>{listing.name || 'Untitled listing'}</Heading>
              {listing.category ? <Muted>{listing.category}</Muted> : null}
            </View>
            {soldOut ? <Badge label="Sold out" tone="warning" /> : null}
            {listing.listingType === 'service' ? <Badge label="Service" tone="primary" /> : null}
          </View>

          <View style={styles.priceRow}>
            {listing.priceMode === 'quote' ? (
              <Text style={styles.priceText}>Ask for a quote</Text>
            ) : (
              <Price
                amount={listing.price ?? listing.localPrice}
                currency={listing.localCurrency}
                style={styles.priceText}
              />
            )}
            {typeof listing.wasPrice === 'number' && typeof listing.price === 'number' && listing.wasPrice > listing.price ? (
              <Text style={styles.wasPrice}>{money(listing.wasPrice, listing.localCurrency)}</Text>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            {listing.location || listing.vendorLocation ? (
              <Meta icon="location-outline" text={listing.location || listing.vendorLocation || ''} />
            ) : null}
            {listing.condition ? <Meta icon="pricetag-outline" text={listing.condition === 'new' ? 'New' : 'Used'} /> : null}
            {listing.uploadedAt ? <Meta icon="time-outline" text={shortDate(listing.uploadedAt)} /> : null}
            {typeof listing.stock === 'number' && listing.stock > 0 ? (
              <Meta icon="cube-outline" text={`${listing.stock} left`} />
            ) : null}
          </View>

          {listing.videoUrl ? <ListingVideo uri={listing.videoUrl} /> : null}

          {listing.description ? (
            <View style={styles.section}>
              <Subheading>About this listing</Subheading>
              <Body style={styles.description}>{listing.description}</Body>
            </View>
          ) : null}

          {seller ? (
            <>
              <Divider />
              <Subheading>Seller</Subheading>
              <Pressable
                onPress={() => router.push(`/shop/${seller.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${seller.shopName || seller.name || 'seller'}'s shop`}
                style={({ pressed }) => [styles.sellerCard, pressed && { opacity: 0.85 }]}
              >
                <Avatar uri={seller.avatarUrl} name={seller.shopName || seller.name} size={46} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sellerName}>{seller.shopName || seller.name || 'Vidnov seller'}</Text>
                  {seller.location ? <Muted>{seller.location}</Muted> : null}
                </View>
                {seller.verified ? <Badge label="Verified" tone="success" /> : null}
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </Pressable>
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* Actions stay pinned — a long description must never bury "Message". */}
      <View style={styles.actions}>
        <SaveButton listingId={listing.id} />
        <Button
          label={soldOut ? 'Message seller' : 'Message seller'}
          icon="chatbubble-ellipses-outline"
          onPress={() => {
            if (!listing.sellerId) return;
            router.push({ pathname: '/chat/[id]', params: { id: `new:${listing.sellerId}` } });
          }}
          style={{ flex: 1 }}
          disabled={!listing.sellerId}
        />
        {listing.sellerId ? (
          <Button
            label="Shop"
            variant="outline"
            icon="storefront-outline"
            onPress={() => router.push(`/shop/${listing.sellerId}`)}
          />
        ) : null}
      </View>

      {authStatus === 'signedOut' ? (
        <Pressable onPress={() => router.push('/sign-in')} style={styles.signInHint}>
          <Text style={styles.signInHintText}>Sign in to message the seller or save this listing</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

/** Native video playback for listings that carry one. */
function ListingVideo({ uri }: { uri: string }) {
  // A stored video reference is relative too — resolve it against the API host.
  const player = useVideoPlayer(apiUrl(uri), (instance) => {
    instance.loop = false;
  });

  return (
    <View style={styles.videoWrap}>
      <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
    </View>
  );
}

/**
 * Save / unsave. Local state is optimistic because the action is trivially
 * reversible, but a failure rolls the heart straight back rather than lying.
 */
function SaveButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const { status, getToken } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setSaveError] = useState<string | null>(null);

  const toggle = useCallback(async () => {
    if (status !== 'signedIn') {
      router.push('/sign-in');
      return;
    }
    if (busy) return;
    const next = !saved;
    setBusy(true);
    try {
      const token = await getToken();
      await savedApi.set(token, listingId, next);
      // Only flip the heart once the server confirms — a full heart that
      // silently failed to save is worse than a heart that did not move.
      setSaved(next);
    } catch {
      setSaveError('Could not update saved items.');
    } finally {
      setBusy(false);
    }
  }, [busy, getToken, listingId, router, saved, status]);

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from saved items' : 'Save this listing'}
      accessibilityState={{ selected: saved, busy }}
      style={[styles.save, error ? { borderColor: colors.danger } : null]}
    >
      {busy ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Ionicons
          name={saved ? 'heart' : 'heart-outline'}
          size={22}
          color={saved ? colors.primary : colors.text}
        />
      )}
    </Pressable>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={13} color={colors.textFaint} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

function Subheading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subheading}>{children}</Text>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  gallery: { backgroundColor: colors.surfaceRaised },
  galleryFallback: {
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  body: { padding: spacing.lg, gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { fontSize: 21, lineHeight: 27 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  priceText: { color: colors.text, fontSize: 24, fontWeight: '800' },
  wasPrice: {
    color: colors.textFaint,
    ...type.body,
    textDecorationLine: 'line-through',
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.textMuted, ...type.caption },
  section: { gap: spacing.xs, marginTop: spacing.sm },
  subheading: { color: colors.text, ...type.heading, marginTop: spacing.sm },
  description: { color: colors.textMuted, lineHeight: 22 },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
  },
  sellerName: { color: colors.text, ...type.bodyStrong },
  videoWrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
    marginTop: spacing.sm,
  },
  video: { width: '100%', aspectRatio: 16 / 9 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  save: {
    width: HIT,
    height: HIT,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInHint: { paddingBottom: spacing.md, paddingHorizontal: spacing.lg },
  signInHintText: { color: colors.textFaint, ...type.caption, textAlign: 'center' },
});
