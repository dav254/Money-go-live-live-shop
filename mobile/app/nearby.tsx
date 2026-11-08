import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { RequireAuth } from '../src/components/require-auth';
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Heading,
  Loading,
  Muted,
  Screen,
} from '../src/components/ui';
import { nearby, type NearbyBusiness } from '../src/lib/api';
import { useAuthedResource } from '../src/lib/use-authed';
import { colors, radius, spacing, type } from '../src/theme';

/**
 * NEAR YOU.
 *
 * Runs the same `/api/nearby` the website uses. The area is taken from the
 * buyer's own profile server-side — the app never sends coordinates, and the
 * response only contains approximate locations, so a shop learns the area it
 * serves, not where the buyer is standing.
 *
 * The radius chips re-query rather than filter locally, because "within 25 km"
 * has to mean every shop, not the first page of them.
 */
const RADII = [5, 10, 25, 50] as const;

export default function NearbyScreen() {
  return (
    <RequireAuth>
      <NearbyList />
    </RequireAuth>
  );
}

function NearbyList() {
  const router = useRouter();
  const [radiusKm, setRadiusKm] = useState<number | null>(null);

  const { data, loading, error, reload } = useAuthedResource(
    (token) => nearby.list(token, radiusKm ?? undefined),
    [radiusKm],
  );

  if (loading && !data) {
    return (
      <Screen>
        <Loading label="Finding shops near you…" />
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

  const businesses = data?.businesses ?? [];

  return (
    <Screen>
      <View style={styles.header}>
        <Heading style={styles.title}>Near you</Heading>
        <Muted>
          {data?.yourArea
            ? `Showing shops that serve ${data.yourArea}.`
            : 'Shops that serve your area.'}
        </Muted>
        <View style={styles.chips}>
          <Chip label="Anywhere" active={radiusKm === null} onPress={() => setRadiusKm(null)} />
          {RADII.map((km) => (
            <Chip
              key={km}
              label={`${km} km`}
              active={radiusKm === km}
              onPress={() => setRadiusKm(km)}
            />
          ))}
        </View>
      </View>

      {data?.needsLocation ? (
        <EmptyState
          icon="location-outline"
          title="Tell us your area"
          body={
            data.message ??
            'Add your town in your profile and Vidnov will show the shops that deliver there.'
          }
          action={
            <Button
              label="Add my area"
              onPress={() => router.push('/profile/edit')}
            />
          }
        />
      ) : (
        <FlatList
          data={businesses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={reload}
          renderItem={({ item }) => (
            <BusinessCard business={item} onOpen={() => router.push(`/shop/${item.sellerId}`)} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="storefront-outline"
              title="No shops in range yet"
              body={
                radiusKm
                  ? 'Nothing within that distance. Try a wider radius.'
                  : 'No shop serves your area yet. New sellers join every week.'
              }
            />
          }
        />
      )}
    </Screen>
  );
}

function BusinessCard({ business, onOpen }: { business: NearbyBusiness; onOpen: () => void }) {
  const distance =
    typeof business.distanceKm === 'number'
      ? business.distanceKm < 1
        ? 'Less than 1 km away'
        : `${Math.round(business.distanceKm)} km away`
      : business.approximateLocation || 'Distance unavailable';

  const verified = business.verificationStatus === 'approved' || business.verificationStatus === 'verified';

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open ${business.name}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Ionicons name="storefront" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text numberOfLines={1} style={styles.name}>
            {business.name}
          </Text>
          <Muted numberOfLines={1}>
            {[business.category, distance].filter(Boolean).join(' · ')}
          </Muted>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </View>

      <View style={styles.badges}>
        {verified ? <Badge label="Verified" tone="success" /> : null}
        {typeof business.rating === 'number' ? (
          <Badge label={`${business.rating.toFixed(1)} ★`} tone="primary" />
        ) : null}
        {business.tier?.label || business.tier?.name ? (
          <Badge label={String(business.tier.label || business.tier.name)} tone="neutral" />
        ) : null}
        {business.completedTransactions ? (
          <Muted>{business.completedTransactions} completed</Muted>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  title: { fontSize: 26 },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', paddingVertical: spacing.xs },
  list: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: colors.text, ...type.bodyStrong },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
});
