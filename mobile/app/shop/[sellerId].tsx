import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ProductCard } from '../../src/components/product-card';
import {
  Avatar,
  Badge,
  EmptyState,
  ErrorState,
  Loading,
  Muted,
  Screen,
} from '../../src/components/ui';
import { catalog } from '../../src/lib/api';
import { useResource } from '../../src/lib/use-resource';
import { colors, radius, spacing, type } from '../../src/theme';
import type { Listing, SellerCard } from '../../src/lib/types';

/**
 * SHOP — a seller's storefront inside the app.
 *
 * Two real reads, both shared with the website: the public business record
 * (name, logo, rating, verification — it owns those privacy rules) and the
 * seller's live listings from `/api/mobile/catalog`. If a shop predates the
 * business entity there is no rating to show, so none is shown rather than a
 * fabricated zero-star score.
 */
export default function ShopScreen() {
  const { sellerId } = useLocalSearchParams<{ sellerId: string }>();
  const router = useRouter();

  const shop = useResource(() => catalog.business(String(sellerId)), [sellerId], {
    enabled: Boolean(sellerId),
  });
  const listings = useResource(() => catalog.shopListings(String(sellerId), 40), [sellerId], {
    enabled: Boolean(sellerId),
  });

  const business = shop.data?.business ?? null;
  const reviews = shop.data?.reviews ?? null;
  const seller = (shop.data?.seller ?? null) as SellerCard | null;
  const items = (listings.data?.listings ?? []) as Listing[];

  const header = (
    <View style={styles.header}>
      <View style={styles.identity}>
        <Avatar uri={business?.logoUrl || seller?.avatarUrl} name={business?.name || seller?.name} size={60} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.name}>{business?.name || seller?.shopName || seller?.name || 'Vidnov shop'}</Text>
          {business?.category ? <Muted>{business.category}</Muted> : null}
          <View style={styles.badges}>
            {business?.verified ? <Badge label="Verified" tone="success" /> : null}
            {reviews && reviews.count > 0 ? (
              <View style={styles.rating}>
                <Ionicons name="star" size={12} color={colors.warning} />
                <Text style={styles.ratingText}>
                  {Number(reviews.average).toFixed(1)} · {reviews.count}
                  {reviews.count === 1 ? ' review' : ' reviews'}
                </Text>
              </View>
            ) : (
              <Muted>No ratings yet</Muted>
            )}
          </View>
        </View>
      </View>

      {business?.description ? <Text style={styles.description}>{business.description}</Text> : null}

      {business?.area ? (
        <View style={styles.location}>
          <Ionicons name="location-outline" size={14} color={colors.textFaint} />
          <Text style={styles.locationText}>{business.area}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => router.push({ pathname: '/chat/[id]', params: { id: `new:${sellerId}` } })}
        accessibilityRole="button"
        style={({ pressed }) => [styles.message, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
        <Text style={styles.messageText}>Message this seller</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Listings</Text>
    </View>
  );

  return (
    <Screen>
      {listings.loading && !listings.data ? (
        <>
          {header}
          <Loading label="Loading the shop…" />
        </>
      ) : listings.error ? (
        <>
          {header}
          <ErrorState message={listings.error} onRetry={listings.reload} />
        </>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <ProductCard product={item} />}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState
              icon="storefront-outline"
              title="Nothing listed yet"
              body="This seller has not published a listing. Follow the shop and check back."
            />
          }
          refreshing={listings.loading}
          onRefresh={() => {
            listings.reload();
            shop.reload();
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  header: { gap: spacing.md, paddingBottom: spacing.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { color: colors.text, fontSize: 20, fontWeight: '800' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: colors.textMuted, ...type.caption },
  description: { color: colors.textMuted, ...type.body, lineHeight: 21 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { color: colors.textMuted, ...type.caption },
  message: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  messageText: { color: colors.primary, ...type.bodyStrong },
  sectionTitle: { color: colors.text, ...type.heading, marginTop: spacing.sm },
});
