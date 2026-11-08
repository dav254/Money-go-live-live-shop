import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { ProductCard } from '../src/components/product-card';
import { Button, EmptyState, Loading, Screen } from '../src/components/ui';
import { RequireAuth } from '../src/components/require-auth';
import { useAuth } from '../src/lib/auth';
import { clearRecent, listRecent, type RecentEntry } from '../src/lib/recent';
import { spacing } from '../src/theme';
import type { Product } from '../src/lib/types';

/**
 * RECENTLY VIEWED — the buyer drawer's sixth Shop destination.
 *
 * Same job as the website's `/app/buyer/recent`: show what this account opened
 * on this phone, newest first, so a listing found last night is one tap away
 * instead of a search. The store is on the device (`src/lib/recent.ts`), so the
 * screen renders with no network at all.
 */
export default function RecentScreen() {
  return (
    <RequireAuth>
      <RecentList />
    </RequireAuth>
  );
}

function RecentList() {
  const router = useRouter();
  const { session } = useAuth();
  const [items, setItems] = useState<RecentEntry[] | null>(null);

  // The list changes whenever a listing is opened, so it is re-read on focus
  // rather than on mount — coming back from a listing must show it at the top.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void listRecent(session?.uid ?? '').then((rows) => {
        if (alive) setItems(rows);
      });
      return () => {
        alive = false;
      };
    }, [session?.uid]),
  );

  const confirmClear = () => {
    Alert.alert('Clear history?', 'This removes the list from this phone. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          void clearRecent(session?.uid ?? '').then(() => setItems([]));
        },
      },
    ]);
  };

  if (items === null) {
    return (
      <Screen>
        <Loading label="Reading this device…" />
      </Screen>
    );
  }

  const cards: Product[] = items.map((row) => ({
    id: row.id,
    name: row.name,
    price: row.price ?? undefined,
    localCurrency: row.currency ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    listingType: row.listingType,
  }));

  return (
    <Screen>
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <ProductCard product={item} />}
        ListHeaderComponent={
          items.length > 0 ? (
            <Button label="Clear history" variant="outline" onPress={confirmClear} />
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyState
            icon="time-outline"
            title="Nothing viewed yet"
            body="Listings you open are kept here on this phone, newest first. This list never leaves the device."
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
