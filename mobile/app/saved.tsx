import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { ProductCard } from '../src/components/product-card';
import { Button, EmptyState, ErrorState, Loading, Screen } from '../src/components/ui';
import { RequireAuth } from '../src/components/require-auth';
import { saved } from '../src/lib/api';
import { useAuthedResource } from '../src/lib/use-authed';
import { spacing } from '../src/theme';
import type { Listing } from '../src/lib/types';

/**
 * SAVED ITEMS.
 *
 * Reads the same `wishlist` field the website's saved-items page shows, so a
 * listing saved on the website is already here when the app is opened — one
 * account, one list, no sync step and no duplicate store.
 */
export default function SavedScreen() {
  return (
    <RequireAuth>
      <SavedList />
    </RequireAuth>
  );
}

function SavedList() {
  const router = useRouter();
  const { data, loading, error, reload } = useAuthedResource((token) => saved.list(token), []);
  const items = (data?.items ?? []) as Listing[];

  if (loading && !data) {
    return (
      <Screen>
        <Loading label="Loading your saved items…" />
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

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <ProductCard product={item} />}
        refreshing={loading}
        onRefresh={reload}
        ListEmptyComponent={
          <EmptyState
            icon="heart-outline"
            title="Nothing saved yet"
            body="Tap the heart on any listing to keep it here. This list is private to your account."
            action={
              <Button
                label="Browse listings"
                variant="outline"
                onPress={() => router.push('/(tabs)/discover')}
              />
            }
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
});
