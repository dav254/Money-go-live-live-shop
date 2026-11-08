import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  Muted,
  Screen,
} from '../src/components/ui';
import { RequireAuth } from '../src/components/require-auth';
import { useAuth } from '../src/lib/auth';
import { account, catalog, following, messageFor } from '../src/lib/api';
import { useAuthedResource } from '../src/lib/use-authed';
import { colors, spacing, type } from '../src/theme';

/**
 * MY SELLERS — the buyers' follow list.
 *
 * The data already exists on both sides: `POST /api/follow` writes
 * `userProfiles/{uid}.following` and increments `sellerShops/{sellerId}.followers`,
 * and `/api/auth/profile` returns that array. What was missing was a screen that
 * reads it back — the website grew one (`/app/buyer/sellers`), so the app gets
 * the same list over the same field.
 *
 * Each row resolves the seller's PUBLIC business record (`/api/public/business`)
 * rather than inventing a name: a shop that has no business entity shows as a
 * plain seller with a shop link, exactly as its shop page does.
 */

interface FollowedSeller {
  sellerId: string;
  name?: string;
  category?: string;
  area?: string | null;
  logoUrl?: string | null;
  verified?: boolean;
}

export default function MySellersScreen() {
  return (
    <RequireAuth>
      <MySellers />
    </RequireAuth>
  );
}

function MySellers() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, loading, error, reload } = useAuthedResource(async (token) => {
    const result = await account.profile(token);
    const ids: string[] = Array.isArray(result?.profile?.following)
      ? (result.profile.following as unknown[]).filter((id): id is string => typeof id === 'string')
      : [];

    // One public read per followed shop. A missing business is a normal state
    // (a shop that predates the entity), not an error worth failing the screen.
    const rows = await Promise.all(
      ids.slice(0, 40).map(async (sellerId): Promise<FollowedSeller> => {
        try {
          const publicRecord = await catalog.business(sellerId);
          const business = publicRecord?.business ?? null;
          return {
            sellerId,
            name: business?.name || undefined,
            category: business?.category || undefined,
            area: business?.areaName || business?.cityName || null,
            logoUrl: business?.logoUrl || null,
            verified: Boolean(business?.verified),
          };
        } catch {
          return { sellerId };
        }
      }),
    );

    return { rows };
  }, []);

  const unfollow = (seller: FollowedSeller) => {
    Alert.alert(
      'Unfollow this seller?',
      seller.name
        ? `Their new listings will stop appearing in your My sellers list.`
        : 'Their new listings will stop appearing in your My sellers list.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfollow',
          style: 'destructive',
          onPress: async () => {
            setBusyId(seller.sellerId);
            try {
              const token = await getToken();
              await following.set(token, seller.sellerId, 'unfollow');
              reload();
            } catch (thrown) {
              Alert.alert('Could not unfollow', messageFor(thrown));
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  if (loading && !data) {
    return (
      <Screen>
        <Loading label="Loading the sellers you follow…" />
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

  const rows = data?.rows ?? [];

  if (rows.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="storefront-outline"
          title="No sellers followed yet"
          body="Follow a shop from its page and it will be listed here, with its newest listings one tap away."
          action={
            <Button
              label="Find businesses nearby"
              variant="outline"
              onPress={() => router.push('/nearby')}
            />
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Muted>
          {rows.length} {rows.length === 1 ? 'shop' : 'shops'} you follow. Following is private to
          your account and works the same on the website.
        </Muted>

        {rows.map((seller) => (
          <Card key={seller.sellerId} style={styles.card}>
            <View style={styles.row}>
              <Avatar uri={seller.logoUrl ?? undefined} name={seller.name} size={46} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {seller.name || 'Vidnov seller'}
                </Text>
                <Muted numberOfLines={1}>
                  {[seller.category, seller.area].filter(Boolean).join(' · ') ||
                    'Shop on Vidnov'}
                </Muted>
                {seller.verified ? <Badge label="Verified" tone="success" /> : null}
              </View>
            </View>

            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Open shop"
                  variant="outline"
                  onPress={() => router.push(`/shop/${seller.sellerId}`)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={busyId === seller.sellerId ? 'Working…' : 'Unfollow'}
                  variant="ghost"
                  disabled={busyId === seller.sellerId}
                  onPress={() => unfollow(seller)}
                />
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { color: colors.text, ...type.bodyStrong },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
